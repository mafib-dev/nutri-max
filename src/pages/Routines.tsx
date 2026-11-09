import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createRoutine, listRoutines, WEEKDAYS } from '../modules/training/data'
import { listCardioPlans } from '../modules/cardio/data'
import { daysLabel, describeTarget } from '../modules/cardio/cardio'
import { useAsync } from '../lib/useAsync'

export default function Routines() {
  const { data, error, loading } = useAsync(listRoutines)
  const cardio = useAsync(listCardioPlans)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function create() {
    setBusy(true)
    setCreateError(null)
    try {
      const routine = await createRoutine(`Treino ${String.fromCharCode(65 + (data?.length ?? 0))}`, null)
      navigate(`/rotinas/${routine.id}`)
    } catch (err) {
      setCreateError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <main className="page stack">
      <div className="page-head">
        <div>
          <span className="eyebrow">Seu plano</span>
          <h1>Rotinas</h1>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Link to="/exercicios" className="btn ghost small">
            Exercícios
          </Link>
          <button type="button" className="btn primary small" onClick={create} disabled={busy}>
            + Nova rotina
          </button>
        </div>
      </div>
      {createError && <p className="error">{createError}</p>}
      {loading && <p className="muted">Carregando…</p>}
      {error && <p className="error">{error}</p>}
      {data?.length === 0 && (
        <div className="empty">
          <h3>Você ainda não tem rotinas</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Crie uma para cada treino da semana (por exemplo, peito e tríceps na segunda) e escolha os exercícios.
          </p>
        </div>
      )}
      {data?.map(r => (
        <Link key={r.id} to={`/rotinas/${r.id}`} className="list-item" style={{ padding: 14 }}>
          <span className="day-badge">{r.weekday == null ? '—' : WEEKDAYS[r.weekday].slice(0, 3)}</span>
          <div className="grow">
            <div className="title">{r.name}</div>
            <div className="muted small">{r.weekday == null ? 'Sem dia fixo' : WEEKDAYS[r.weekday]}</div>
          </div>
          <span className="chev">›</span>
        </Link>
      ))}

      <div className="spread">
        <h2>Cardio</h2>
        <Link to="/cardio" className="btn ghost small">
          {cardio.data?.length ? 'Abrir' : '+ Planejar'}
        </Link>
      </div>
      {cardio.error && <p className="error">{cardio.error}</p>}
      {cardio.data?.length === 0 && <p className="muted small">Corrida, caminhada, bike, natação: planeje os dias, a distância e os intervalos, e registre o que fez.</p>}
      {cardio.data?.map(p => (
        <Link key={p.id} to="/cardio" className="list-item" style={{ padding: 14 }}>
          <span className="day-badge">{p.weekdays.length === 1 ? WEEKDAYS[p.weekdays[0]].slice(0, 3) : p.weekdays.length ? `${p.weekdays.length}×` : '—'}</span>
          <div className="grow">
            <div className="title">{p.name}</div>
            <div className="muted small ellipsis">
              {daysLabel(p.weekdays)} · {describeTarget(p.distance_m, p.duration_sec, p.intensity, p.intervals)}
            </div>
          </div>
          <span className="chev">›</span>
        </Link>
      ))}
    </main>
  )
}
