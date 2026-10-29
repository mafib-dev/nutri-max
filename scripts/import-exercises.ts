// Importa o catálogo do free-exercise-db (domínio público) para o Supabase:
// os exercícios na tabela public.exercises e as fotos no bucket exercise-images.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:exercises
//   npm run import:exercises -- --skip-images   (só os dados)
//
// Pode rodar de novo sem duplicar: exercícios entram com upsert pelo id e
// fotos já enviadas são sobrescritas.
import { createClient } from '@supabase/supabase-js'
import { toExerciseRow, type FreeExerciseDbExercise } from '../src/modules/training/catalogue'
import namesPt from './data/exercise-names-pt.json' with { type: 'json' }
import stepsPt from './data/exercise-instructions-pt.json' with { type: 'json' }

const SOURCE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main'
const BUCKET = 'exercise-images'
const BATCH = 200
const PARALLEL_UPLOADS = 8

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const skipImages = process.argv.includes('--skip-images')
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

async function main() {
  const res = await fetch(`${SOURCE}/dist/exercises.json`)
  if (!res.ok) throw new Error(`Falha ao baixar exercises.json: ${res.status}`)
  const exercises = (await res.json()) as FreeExerciseDbExercise[]
  console.log(`${exercises.length} exercícios encontrados.`)

  const names = namesPt as Record<string, string>
  const steps = stepsPt as Record<string, string[]>
  const rows = exercises.map(ex => toExerciseRow(ex, names[ex.id] ?? null, steps[ex.id] ?? null))
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from('exercises').upsert(rows.slice(i, i + BATCH), { onConflict: 'id' })
    if (error) throw new Error(`Falha ao gravar exercícios: ${error.message}`)
  }
  console.log(`${rows.length} exercícios gravados.`)

  if (skipImages) return
  const paths = exercises.flatMap(e => e.images)
  let done = 0
  const failed: string[] = []
  const queue = [...paths]
  await Promise.all(
    Array.from({ length: PARALLEL_UPLOADS }, async () => {
      for (let path = queue.shift(); path; path = queue.shift()) {
        try {
          await uploadImage(path)
        } catch (err) {
          failed.push(`${path}: ${(err as Error).message}`)
        }
        done += 1
        if (done % 100 === 0) console.log(`${done}/${paths.length} fotos`)
      }
    }),
  )
  console.log(`${paths.length - failed.length}/${paths.length} fotos enviadas.`)
  if (failed.length) {
    console.error(failed.join('\n'))
    process.exitCode = 1
  }
}

async function uploadImage(path: string) {
  const res = await fetch(`${SOURCE}/exercises/${path}`)
  if (!res.ok) throw new Error(`download ${res.status}`)
  const body = await res.arrayBuffer()
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) throw new Error(error.message)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
