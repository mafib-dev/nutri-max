// Converte o Mixamo (FBX em assets/avatares) para o boneco 3D da home.
// Gera public/avatar/man.glb e woman.glb (personagens, texturas reduzidas) e um arquivo só
// com a animação para cada pose. Uso: npm run avatar
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions'
import sharp from 'sharp'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'

const SRC = process.argv[2] ?? 'assets/avatares'
const OUT = 'public/avatar'
// Arquivo de saída → nome do FBX (sem extensão) que o Mixamo baixou.
const CHARACTERS = { man: 'Man', woman: 'Woman' }
const CLIPS = { idle: 'Idle', wave: 'Waving', curl: 'Bicep Curl', victory: 'Victory', sleep: 'Sleeping Idle' }

const require = createRequire(import.meta.url)
const tool = path.join(path.dirname(require.resolve('fbx2gltf')), 'bin', os.type(), os.type() === 'Windows_NT' ? 'FBX2glTF.exe' : 'FBX2glTF')
if (os.type() !== 'Windows_NT') fs.chmodSync(tool, 0o755)

await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-'))
fs.mkdirSync(OUT, { recursive: true })

// Cada download do Mixamo numera o prefixo dos ossos (mixamorig6:, mixamorig7:...).
// Com o mesmo nome em todos, qualquer animação serve em qualquer personagem.
const normalize = doc => {
  for (const n of doc.getRoot().listNodes()) n.setName(n.getName().replace(/^mixamorig\d*:/, 'mixamorig:'))
}
const bones = doc => new Set(doc.getRoot().listNodes().map(n => n.getName()))

async function convert(name) {
  const fbx = path.join(SRC, `${name}.fbx`)
  if (!fs.existsSync(fbx)) throw new Error(`Faltou ${fbx}`)
  const raw = path.join(tmp, name.replace(/\W/g, '_'))
  execFileSync(tool, ['--binary', '--input', fbx, '--output', raw], { stdio: 'pipe' })
  const doc = await io.read(raw + '.glb')
  normalize(doc)
  return doc
}

async function save(doc, out) {
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
  const file = path.join(OUT, `${out}.glb`)
  await io.write(file, doc)
  return `${file}: ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`
}

let reference = null
for (const [out, name] of Object.entries(CHARACTERS)) {
  const doc = await convert(name)
  for (const a of doc.getRoot().listAnimations()) a.dispose()
  // No tamanho em que o boneco aparece, o mapa de relevo quase não muda nada e é o que mais pesa.
  for (const m of doc.getRoot().listMaterials()) {
    m.getNormalTexture()?.dispose()
    m.setNormalTexture(null)
  }
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )
  const names = bones(doc)
  if (!names.has('mixamorig:Hips')) throw new Error(`${name}: não achei o osso mixamorig:Hips`)
  if (reference) {
    const diff = [...reference].filter(n => n.startsWith('mixamorig:') && !names.has(n))
    if (diff.length) console.warn(`${name}: ossos que o outro personagem tem e este não: ${diff.slice(0, 5).join(', ')}`)
  }
  reference = names
  console.log(`${await save(doc, out)}, ${doc.getRoot().listTextures().length} texturas`)
}

for (const [out, name] of Object.entries(CLIPS)) {
  const doc = await convert(name)
  const anims = doc.getRoot().listAnimations().filter(a => a.listChannels().length)
  for (const a of doc.getRoot().listAnimations()) if (!anims.includes(a)) a.dispose()
  if (anims.length !== 1) throw new Error(`${name}: esperava 1 animação, veio ${anims.length}`)
  anims[0].setName(out)
  // Só a animação: o personagem vem do man.glb ou woman.glb.
  for (const m of doc.getRoot().listMeshes()) m.dispose()
  for (const s of doc.getRoot().listSkins()) s.dispose()
  for (const m of doc.getRoot().listMaterials()) m.dispose()
  for (const t of doc.getRoot().listTextures()) t.dispose()
  const missing = anims[0].listChannels().map(c => c.getTargetNode()?.getName()).filter(n => n && !reference.has(n))
  if (missing.length) throw new Error(`${name}: ossos que não existem no personagem: ${missing.slice(0, 5).join(', ')}`)
  await doc.transform(resample(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  const a = doc.getRoot().listAnimations()[0]
  const times = a.listSamplers().map(s => s.getInput()?.getMax([])[0] ?? 0)
  console.log(`${await save(doc, out)}, animação "${out}" de ${Math.max(...times).toFixed(1)} s`)
}
for (const old of ['beta.glb']) fs.rmSync(path.join(OUT, old), { force: true })
fs.rmSync(tmp, { recursive: true, force: true })
