import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createRoutine, listRoutines, WEEKDAYS } from '../modules/training/data'
import { useAsync } from '../lib/useAsync'

export default function Routines() {
  const { data, error, loading } = useAsync(listRoutines)
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
    </main>
  )
}
