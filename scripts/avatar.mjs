// Converte as animações do Mixamo (FBX em assets/avatares) para o boneco 3D da home.
// Gera public/avatar/beta.glb (personagem + animação parado) e um arquivo só com a animação
// para cada pose. Uso: npm run avatar
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, resample } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'

const SRC = process.argv[2] ?? 'assets/avatares'
const OUT = 'public/avatar'
// Arquivo de saída → nome do FBX (sem extensão) que o Mixamo baixou.
const FILES = { beta: 'Idle', wave: 'Waving', curl: 'Bicep Curl', victory: 'Victory', sleep: 'Sleeping Idle' }

const require = createRequire(import.meta.url)
const tool = path.join(path.dirname(require.resolve('fbx2gltf')), 'bin', os.type(), os.type() === 'Windows_NT' ? 'FBX2glTF.exe' : 'FBX2glTF')
if (os.type() !== 'Windows_NT') fs.chmodSync(tool, 0o755)

await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-'))
fs.mkdirSync(OUT, { recursive: true })

const bones = doc => new Set(doc.getRoot().listNodes().map(n => n.getName()))
let reference = null

for (const [out, name] of Object.entries(FILES)) {
  const fbx = path.join(SRC, `${name}.fbx`)
  if (!fs.existsSync(fbx)) throw new Error(`Faltou ${fbx}`)
  const raw = path.join(tmp, out)
  execFileSync(tool, ['--binary', '--input', fbx, '--output', raw], { stdio: 'pipe' })
  const doc = await io.read(raw + '.glb')
  const anims = doc.getRoot().listAnimations().filter(a => a.listChannels().length)
  for (const a of doc.getRoot().listAnimations()) if (!anims.includes(a)) a.dispose()
  if (anims.length !== 1) throw new Error(`${name}: esperava 1 animação, veio ${anims.length}`)
  anims[0].setName(out === 'beta' ? 'idle' : out)

  if (out === 'beta') reference = bones(doc)
  else {
    // Só a animação: o personagem já vem no beta.glb.
    for (const m of doc.getRoot().listMeshes()) m.dispose()
    for (const s of doc.getRoot().listSkins()) s.dispose()
    for (const m of doc.getRoot().listMaterials()) m.dispose()
    for (const t of doc.getRoot().listTextures()) t.dispose()
    const missing = anims[0].listChannels().map(c => c.getTargetNode()?.getName()).filter(n => n && !reference.has(n))
    if (missing.length) throw new Error(`${name}: ossos que não existem no personagem: ${missing.slice(0, 5).join(', ')}`)
  }

  await doc.transform(resample(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
  const file = path.join(OUT, `${out}.glb`)
  await io.write(file, doc)
  const a = doc.getRoot().listAnimations()[0]
  const times = a.listSamplers().map(s => s.getInput()?.getMax([])[0] ?? 0)
  console.log(`${file}: ${(fs.statSync(file).size / 1e6).toFixed(2)} MB, animação "${a.getName()}" de ${Math.max(...times).toFixed(1)} s`)
}
fs.rmSync(tmp, { recursive: true, force: true })
