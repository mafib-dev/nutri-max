// Boneco 3D da tela Hoje: o personagem "Beta" do Mixamo com as animações do dia.
// Carregado sob demanda (three.js é pesado); se o 3D falhar, a tela usa o desenho em SVG.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { Box3, LoopRepeat, Vector3, type AnimationClip, type Group } from 'three'
import type { Pose } from './Avatar'

const BASE = '/avatar/'
const CLIPS: Record<Pose, string> = { idle: 'beta.glb', wave: 'wave.glb', train: 'curl.glb', celebrate: 'victory.glb', sleep: 'sleep.glb' }
const HEIGHT = 1.8

function Model({ pose }: { pose: Pose }) {
  const group = useRef<Group>(null)
  const base = useGLTF(BASE + CLIPS.idle)
  const extra = useGLTF(['wave', 'train', 'celebrate', 'sleep'].map(p => BASE + CLIPS[p as Pose]))

  // Uma animação por pose, com o nome da pose; tira o deslocamento do quadril para o boneco não sair do lugar.
  const clips = useMemo(() => {
    const named = (clip: AnimationClip | undefined, name: Pose) => {
      if (!clip) return null
      const c = clip.clone()
      c.name = name
      c.tracks = c.tracks.filter(t => !/Hips\.position$/.test(t.name))
      return c
    }
    const list = [named(base.animations[0], 'idle'), ...(['wave', 'train', 'celebrate', 'sleep'] as Pose[]).map((p, i) => named(extra[i].animations[0], p))]
    return list.filter((c): c is AnimationClip => !!c)
  }, [base, extra])

  // Ajusta a escala para ~1,8 m e apoia os pés no chão, seja o modelo em cm ou em m.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(base.scene)
    const size = box.getSize(new Vector3())
    const s = HEIGHT / (size.y || 1)
    return { scale: s, y: -box.min.y * s }
  }, [base])

  const { actions } = useAnimations(clips, group)

  useEffect(() => {
    const action = actions[pose] ?? actions.idle
    if (!action) return
    action.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.35).play()
    return () => {
      action.fadeOut(0.35)
    }
  }, [pose, actions])

  return (
    <group ref={group} position={[0, fit.y - HEIGHT / 2, 0]} scale={fit.scale}>
      <primitive object={base.scene} />
    </group>
  )
}

export default function Avatar3D({ pose, size, onClick }: { pose: Pose; size: number; onClick?: () => void }) {
  return (
    <div style={{ width: size, height: size * 1.4, cursor: onClick ? 'pointer' : undefined }} onClick={onClick} role="img" aria-label="Seu personagem">
      <Canvas camera={{ position: [0, 0.05, 3.6], fov: 32 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 4]} intensity={1.6} />
        <directionalLight position={[-3, 2, -2]} intensity={0.6} />
        <Suspense fallback={null}>
          <Model pose={pose} />
        </Suspense>
      </Canvas>
    </div>
  )
}
