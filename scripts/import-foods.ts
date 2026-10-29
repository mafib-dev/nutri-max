// Importa os 597 alimentos da TACO (Tabela Brasileira de Composição de Alimentos, 4ª edição,
// NEPA/UNICAMP) para a tabela public.foods. Valores por 100 g; traços e valores não
// analisados entram como 0 nos macros e como nulos em fibra e sódio.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:foods
//
// Pode rodar de novo sem duplicar: os alimentos entram com upsert pelo id.
import { createClient } from '@supabase/supabase-js'
import foods from './data/taco-foods.json' with { type: 'json' }

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const rows = foods.map(f => ({ ...f, source: 'taco', owner_id: null }))
const { error } = await supabase.from('foods').upsert(rows, { onConflict: 'id' })
if (error) {
  console.error(`Falha ao gravar alimentos: ${error.message}`)
  process.exit(1)
}
console.log(`${rows.length} alimentos gravados.`)
