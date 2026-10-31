import { useState, type ReactNode } from 'react'
import type { ExerciseRow } from '../modules/training/catalogue'
import { exerciseName, imageUrl } from '../modules/training/data'
import { MUSCLE_NAME_PT, toMuscle, type Muscle } from '../modules/training/muscles'
import { Modal } from './ui'

const EQUIPMENT_PT: Record<string, string> = {
  barbell: 'Barra',
  dumbbell: 'Halter',
  cable: 'Cabo',
  machine: 'Máquina',
  'body only': 'Peso corporal',
  kettlebells: 'Kettlebell',
  bands: 'Elástico',
  'e-z curl bar': 'Barra W',
  'medicine ball': 'Medicine ball',
  'exercise ball': 'Bola suíça',
  'foam roll': 'Rolo',
  other: 'Outro',
}

const LEVEL_PT = { beginner: 'Iniciante', intermediate: 'Intermediário', expert: 'Avançado' } as const
const MECHANIC_PT = { compound: 'Multiarticular', isolation: 'Isolado' } as const
const FORCE_PT = { push: 'Empurrar', pull: 'Puxar', static: 'Isométrico' } as const

export const equipmentName = (eq: string | null) => (eq ? EQUIPMENT_PT[eq] ?? eq : 'Sem equipamento')
export const muscleName = (m: string) => MUSCLE_NAME_PT[(toMuscle(m) ?? m) as Muscle] ?? m

/** As duas fotos do exercício se alternando, como uma animação do movimento. Toque pausa. */
export function ExerciseDemo({ exercise }: { exercise: ExerciseRow }) {
  const [paused, setPaused] = useState(false)
  const [a, b] = exercise.images
  if (!a) return null
  return (
    <div
      className={`demo ${paused ? 'paused' : ''}`}
      role="img"
      aria-label={`Demonstração: ${exerciseName(exercise)}`}
      onClick={() => setPaused(!paused)}
    >
      <img src={imageUrl(a)} alt="" />
      {b && <img src={imageUrl(b)} alt="" />}
      {b && <span className="demo-tag">{paused ? 'Pausado · toque para animar' : 'Início ↔ fim do movimento'}</span>}
    </div>
  )
}

/** Detalhes do exercício numa janela: demonstração, músculos, ficha e passo a passo. */
export function ExerciseDetail(props: { exercise: ExerciseRow; onClose: () => void; action?: ReactNode; top?: boolean; children?: ReactNode }) {
  const ex = props.exercise
  const pt = ex.instructions.pt
  const steps = pt?.length ? pt : ex.instructions.en

  return (
    <Modal title={exerciseName(ex)} onClose={props.onClose} footer={props.action} top={props.top}>
      <div className="stack" style={{ gap: 16 }}>
        <ExerciseDemo exercise={ex} />
        {props.children}
        <div className="chips wrap">
          {ex.primary_muscles.map(m => (
            <span key={m} className="badge accent">
              {muscleName(m)}
            </span>
          ))}
          {ex.secondary_muscles.map(m => (
            <span key={m} className="badge">
              {muscleName(m)}
            </span>
          ))}
        </div>
        <div className="facts">
          <div className="fact">
            <span>Equipamento</span>
            <strong>{equipmentName(ex.equipment)}</strong>
          </div>
          {ex.level && (
            <div className="fact">
              <span>Nível</span>
              <strong>{LEVEL_PT[ex.level]}</strong>
            </div>
          )}
          {ex.mechanic && (
            <div className="fact">
              <span>Tipo</span>
              <strong>{MECHANIC_PT[ex.mechanic]}</strong>
            </div>
          )}
          {ex.force && (
            <div className="fact">
              <span>Força</span>
              <strong>{FORCE_PT[ex.force]}</strong>
            </div>
          )}
        </div>
        {steps.length > 0 && (
          <div className="stack">
            <h2 style={{ margin: '4px 0 0' }}>Como fazer</h2>
            {!pt?.length && <p className="muted tiny" style={{ margin: 0 }}>Passo a passo ainda em inglês.</p>}
            <ol className="steps">
              {steps.map((s, i) => (
                <li key={i}>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {ex.name_pt && <p className="muted tiny" style={{ margin: 0 }}>Nome original: {ex.name}</p>}
      </div>
    </Modal>
  )
}
