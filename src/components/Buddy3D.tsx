// Mostra o boneco 3D quando ele carrega; antes disso, ou se o 3D falhar (sem WebGL, arquivo
// ausente), mostra o desenho em SVG no lugar.
import { Component, lazy, Suspense, type ReactNode } from 'react'
import { Avatar, type Pose } from './Avatar'
import type { Sex } from '../modules/nutrition/targets'
import type { AvatarLook } from '../modules/profile/look'

const Avatar3D = lazy(() => import('./Avatar3D'))

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const hasWebGL = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export function Buddy3D({ pose, size, sex, look }: { pose: Pose; size: number; sex: Sex | null; look?: AvatarLook }) {
  const flat = <Avatar sex={sex} look={look} pose={pose} size={size * 0.62} />
  if (!hasWebGL()) return flat
  return (
    <Fallback fallback={flat}>
      <Suspense fallback={<div style={{ width: size, height: size * 1.4 }} />}>
        <Avatar3D key={sex ?? 'male'} pose={pose} female={sex === 'female'} size={size} />
      </Suspense>
    </Fallback>
  )
}
