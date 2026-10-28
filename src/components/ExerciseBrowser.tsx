import { useMemo, useState } from 'react'
import type { ExerciseRow } from '../modules/training/catalogue'
import { NON_STRENGTH_CATEGORIES } from '../modules/training/catalogue'
import { exerciseName, imageUrl, loadCatalogue } from '../modules/training/data'
import { MUSCLES, MUSCLE_NAME_PT, type Muscle } from '../modules/training/muscles'
import { useAsync } from '../lib/useAsync'

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

export const equipmentName = (eq: string | null) => (eq ? EQUIPMENT_PT[eq] ?? eq : 'Sem equipamento')

const PAGE = 60

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

interface Props {
  /** Quando presente, tocar num exercício o escolhe em vez de abrir os detalhes. */
  onPick?: (exercise: ExerciseRow) => void
}

export default function ExerciseBrowser({ onPick }: Props) {
  const { data, error, loading } = useAsync(loadCatalogue)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [detail, setDetail] = useState<ExerciseRow | null>(null)

  const results = useMemo(() => {
    if (!data) return []
    const q = normalize(query.trim())
    return data.filter(ex => {
      if (!showAll && (NON_STRENGTH_CATEGORIES as readonly string[]).includes(ex.category)) return false
      if (muscle && !ex.primary_muscles.includes(muscle)) return false
      if (q && !normalize(`${ex.name} ${ex.name_pt ?? ''}`).includes(q)) return false
      return true
    })
  }, [data, query, muscle, showAll])

  if (loading) return <p className="muted">Carregando exercícios…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <div className="stack">
      <input
        className="input"
        type="search"
        placeholder="Buscar exercício (em inglês, por enquanto)"
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setLimit(PAGE)
        }}
      />
      <div className="chips" role="group" aria-label="Filtrar por músculo">
        <button type="button" className={`chip ${muscle === null ? 'on' : ''}`} onClick={() => setMuscle(null)}>
          Todos
        </button>
        {MUSCLES.map(m => (
          <button
            key={m}
            type="button"
            className={`chip ${muscle === m ? 'on' : ''}`}
            onClick={() => {
              setMuscle(muscle === m ? null : m)
              setLimit(PAGE)
            }}
          >
            {MUSCLE_NAME_PT[m]}
          </button>
        ))}
      </div>
      <label className="row small muted">
        <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
        Incluir alongamentos, cardio e strongman
      </label>
      <p className="muted small" style={{ margin: 0 }}>
        {results.length} exercícios
      </p>
      {results.slice(0, limit).map(ex => (
        <button key={ex.id} type="button" className="list-item" onClick={() => (onPick ? onPick(ex) : setDetail(ex))}>
          {ex.images[0] ? <img className="thumb" src={imageUrl(ex.images[0])} alt="" loading="lazy" /> : <div className="thumb" />}
          <div className="grow">
            <div className="ellipsis" style={{ fontWeight: 600 }}>
              {exerciseName(ex)}
            </div>
            <div className="muted small ellipsis">
              {ex.primary_muscles.map(m => MUSCLE_NAME_PT[m as Muscle] ?? m).join(', ')} · {equipmentName(ex.equipment)}
            </div>
          </div>
          {onPick && <span className="badge accent">Adicionar</span>}
        </button>
      ))}
      {results.length > limit && (
        <button type="button" className="btn" onClick={() => setLimit(limit + PAGE)}>
          Mostrar mais
        </button>
      )}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

export function ExerciseDetail({ exercise, onClose }: { exercise: ExerciseRow; onClose: () => void }) {
  const steps = exercise.instructions.pt ?? exercise.instructions.en
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet stack" role="dialog" aria-label={exerciseName(exercise)} onClick={e => e.stopPropagation()}>
        <div className="spread">
          <h2 style={{ margin: 0 }}>{exerciseName(exercise)}</h2>
          <button type="button" className="btn ghost small" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="row" style={{ overflowX: 'auto' }}>
          {exercise.images.map(path => (
            <img key={path} src={imageUrl(path)} alt="" style={{ width: '48%', borderRadius: 10 }} />
          ))}
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {exercise.primary_muscles.map(m => (
            <span key={m} className="badge accent">
              {MUSCLE_NAME_PT[m as Muscle] ?? m}
            </span>
          ))}
          {exercise.secondary_muscles.map(m => (
            <span key={m} className="badge">
              {MUSCLE_NAME_PT[m as Muscle] ?? m}
            </span>
          ))}
          <span className="badge">{equipmentName(exercise.equipment)}</span>
        </div>
        {steps.length > 0 && (
          <ol className="small" style={{ paddingLeft: 20, margin: 0 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {s}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
