import { useMemo, useState } from 'react'
import type { ExerciseRow } from '../modules/training/catalogue'
import { NON_STRENGTH_CATEGORIES } from '../modules/training/catalogue'
import { exerciseName, imageUrl, loadCatalogue } from '../modules/training/data'
import { MUSCLES, MUSCLE_NAME_PT, type Muscle } from '../modules/training/muscles'
import { useAsync } from '../lib/useAsync'
import { ExerciseDetail, equipmentName, muscleName } from './ExerciseDetail'
import { Icon } from './ui'

export { equipmentName }

const PAGE = 60

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

interface Props {
  /** Quando presente, os detalhes ganham o botão de adicionar (e a lista, um atalho "+"). */
  onPick?: (exercise: ExerciseRow) => void
  pickLabel?: string
}

export default function ExerciseBrowser({ onPick, pickLabel = 'Adicionar à rotina' }: Props) {
  const { data, error, loading } = useAsync(loadCatalogue)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [detail, setDetail] = useState<ExerciseRow | null>(null)

  const results = useMemo(() => {
    if (!data) return []
    const q = normalize(query.trim())
    return data
      .filter(ex => {
        if (!showAll && (NON_STRENGTH_CATEGORIES as readonly string[]).includes(ex.category)) return false
        if (muscle && !ex.primary_muscles.includes(muscle)) return false
        if (q && !normalize(`${ex.name_pt ?? ''} ${ex.name}`).includes(q)) return false
        return true
      })
      .sort((a, b) => exerciseName(a).localeCompare(exerciseName(b), 'pt-BR'))
  }, [data, query, muscle, showAll])

  if (loading) return <p className="muted">Carregando exercícios…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <div className="stack">
      <label className="search">
        <Icon.search />
        <input
          className="input"
          type="search"
          placeholder="Buscar: supino, agachamento, rosca…"
          aria-label="Buscar exercício"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setLimit(PAGE)
          }}
        />
      </label>
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
      <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
          {results.length} exercícios
        </span>
        <label className="row small muted">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Alongamento, cardio e strongman
        </label>
      </div>
      <div className="list">
        {results.slice(0, limit).map(ex => (
          <div key={ex.id} className="row" style={{ gap: 6 }}>
            <button type="button" className="list-item" onClick={() => setDetail(ex)}>
              {ex.images[0] ? <img className="thumb" src={imageUrl(ex.images[0])} alt="" loading="lazy" /> : <div className="thumb" />}
              <div className="grow">
                <div className="title clamp-2">{exerciseName(ex)}</div>
                <div className="muted small ellipsis">
                  {ex.primary_muscles.map(muscleName).join(', ')} · {equipmentName(ex.equipment)}
                </div>
              </div>
              {!onPick && <span className="chev">›</span>}
            </button>
            {onPick && (
              <button type="button" className="btn icon primary" aria-label={`Adicionar ${exerciseName(ex)}`} onClick={() => onPick(ex)}>
                <Icon.plus />
              </button>
            )}
          </div>
        ))}
      </div>
      {results.length > limit && (
        <button type="button" className="btn load-more" onClick={() => setLimit(limit + PAGE)}>
          Mostrar mais
        </button>
      )}
      {detail && (
        <ExerciseDetail
          exercise={detail}
          top
          onClose={() => setDetail(null)}
          action={
            onPick && (
              <button
                type="button"
                className="btn primary block"
                onClick={() => {
                  onPick(detail)
                  setDetail(null)
                }}
              >
                <Icon.plus /> {pickLabel}
              </button>
            )
          }
        />
      )}
    </div>
  )
}
