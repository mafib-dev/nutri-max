// Boneco 3D da tela Hoje: um personagem do Mixamo (homem ou mulher) com as animações do dia.
// Carregado sob demanda (three.js é pesado); se o 3D falhar, a tela usa o desenho em SVG.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { LoopRepeat, Vector3, type AnimationClip, type Group } from 'three'
import type { Pose } from './Avatar'

const BASE = '/avatar/'
const POSES: Pose[] = ['idle', 'wave', 'train', 'celebrate', 'sleep']
const CLIPS: Record<Pose, string> = { idle: 'idle.glb', wave: 'wave.glb', train: 'curl.glb', celebrate: 'victory.glb', sleep: 'sleep.glb' }
const HEIGHT = 1.8

function Model({ pose, female }: { pose: Pose; female: boolean }) {
  const group = useRef<Group>(null)
  const base = useGLTF(BASE + (female ? 'woman.glb' : 'man.glb'))
  const extra = useGLTF(POSES.map(p => BASE + CLIPS[p]))

  // Uma animação por pose, com o nome da pose; tira o deslocamento do quadril para o boneco não sair do lugar.
  const clips = useMemo(() => {
    const named = (clip: AnimationClip | undefined, name: Pose) => {
      if (!clip) return null
      const c = clip.clone()
      c.name = name
      c.tracks = c.tracks.filter(t => !/Hips\.position$/.test(t.name))
      return c
    }
    return POSES.map((p, i) => named(extra[i].animations[0], p)).filter((c): c is AnimationClip => !!c)
  }, [base, extra])

  // A caixa do modelo comprimido não é confiável; mede a altura pelos ossos (cabeça e pé).
  const fit = useMemo(() => {
    base.scene.updateMatrixWorld(true)
    let top = -Infinity
    let bottom = Infinity
    base.scene.traverse(o => {
      if (!(o as { isBone?: boolean }).isBone) return
      const y = o.getWorldPosition(new Vector3()).y
      top = Math.max(top, y)
      bottom = Math.min(bottom, y)
    })
    const h = Number.isFinite(top) && top > bottom ? top - bottom : HEIGHT
    const s = HEIGHT / h
    return { scale: s, y: -bottom * s }
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

export default function Avatar3D({ pose, female, size, onClick }: { pose: Pose; female: boolean; size: number; onClick?: () => void }) {
  return (
    <div style={{ width: size, height: size * 1.4, cursor: onClick ? 'pointer' : undefined }} onClick={onClick} role="img" aria-label="Seu personagem">
      <Canvas camera={{ position: [0, 0.05, 3.6], fov: 32 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 4]} intensity={1.6} />
        <directionalLight position={[-3, 2, -2]} intensity={0.6} />
        <Suspense fallback={null}>
          <Model pose={pose} female={female} />
        </Suspense>
      </Canvas>
    </div>
  )
}
