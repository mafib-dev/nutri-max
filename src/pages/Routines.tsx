import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { muscleName } from '../components/ExerciseDetail'
import { createRoutine, daysLabel, listRoutineOverview, loadCatalogue, onDay, WEEK_ORDER, WEEKDAYS, type Routine } from '../modules/training/data'
import { startRoutine } from '../modules/training/start'
import { useActiveSession } from '../modules/training/activeSession'
import { useAsync } from '../lib/useAsync'
import { formatDay } from '../lib/format'

export default function Routines() {
  const { data, error, loading } = useAsync(() => Promise.all([listRoutineOverview(), loadCatalogue()]))
  const navigate = useNavigate()
  const [active, setActive] = useActiveSession()
  const [busy, setBusy] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [today] = useState(() => new Date().getDay())

  const overview = data?.[0] ?? null
  const routines = useMemo(() => overview?.routines ?? [], [overview])
  const byId = useMemo(() => new Map((data?.[1] ?? []).map(e => [e.id, e])), [data])

  // Para cada rotina: quantos exercícios, quantas séries e os músculos principais (os mais trabalhados primeiro).
  const summary = useMemo(() => {
    const out = new Map<string, { exercises: number; sets: number; muscles: string[] }>()
    for (const r of routines) {
      const items = overview!.items.filter(i => i.routine_id === r.id)
      const count = new Map<string, number>()
      for (const it of items) for (const m of byId.get(it.exercise_id)?.primary_muscles ?? []) count.set(m, (count.get(m) ?? 0) + it.sets)
      out.set(r.id, {
        exercises: items.length,
        sets: items.reduce((a, i) => a + i.sets, 0),
        muscles: [...count].sort((a, b) => b[1] - a[1]).map(([m]) => muscleName(m)),
      })
    }
    return out
  }, [routines, overview, byId])

  async function create() {
    setBusy(true)
    setActionError(null)
    try {
      const routine = await createRoutine(`Treino ${String.fromCharCode(65 + routines.length)}`)
      navigate(`/rotinas/${routine.id}`)
    } catch (err) {
      setActionError((err as Error).message)
      setBusy(false)
    }
  }

  async function start(id: string) {
    if (active && !confirm('Já existe um treino em andamento. Descartar e começar outro?')) return
    setStarting(id)
    setActionError(null)
    try {
      setActive(await startRoutine(id))
      navigate('/treino')
    } catch (err) {
      setActionError((err as Error).message)
      setStarting(null)
    }
  }

  const byDay = (d: number) => routines.filter(r => onDay(r, d))
  const sorted = [...routines].sort((a, b) => order(a) - order(b))

  return (
    <main className="page stack">
      <div className="page-head">
        <h1>Treinos</h1>
        <div className="row" style={{ gap: 6 }}>
          <Link to="/exercicios" className="btn ghost small">
            Exercícios
          </Link>
          <button type="button" className="btn primary small" onClick={create} disabled={busy}>
            Nova rotina
          </button>
        </div>
      </div>
      {actionError && <p className="error">{actionError}</p>}
      {loading && <p className="muted">Carregando…</p>}
      {error && <p className="error">{error}</p>}

      {overview && routines.length === 0 && (
        <div className="empty">
          <h3>Você ainda não tem rotinas</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Crie uma para cada treino da semana (por exemplo, peito e tríceps na segunda) e escolha os exercícios.
          </p>
        </div>
      )}

      {routines.length > 0 && (
        <section className="week-plan" aria-label="Sua semana">
          {WEEK_ORDER.map(d => {
            const list = byDay(d)
            return (
              <div key={d} className={`week-day${d === today ? ' today' : ''}${list.length ? '' : ' rest'}`}>
                <span className="label">{WEEKDAYS[d].slice(0, 3)}</span>
                {list.length ? (
                  list.map(r => (
                    <Link key={r.id} to={`/rotinas/${r.id}`} className="week-routine">
                      {r.name}
                    </Link>
                  ))
                ) : (
                  <span className="muted small">Descanso</span>
                )}
              </div>
            )
          })}
        </section>
      )}

      {routines.length > 0 && (
        <div className="routine-grid">
          {sorted.map(r => {
            const s = summary.get(r.id)
            const last = overview!.lastDone.get(r.id)
            return (
              <article key={r.id} className={`card routine-card${onDay(r, today) ? ' today' : ''}`}>
                <Link to={`/rotinas/${r.id}`} className="routine-main">
                  <span className="label">
                    {daysLabel(r.weekdays)}
                    {onDay(r, today) ? ' · hoje' : ''}
                  </span>
                  <div className="title">{r.name}</div>
                  <div className="muted small">
                    {s?.exercises ? `${s.exercises} exercícios · ${s.sets} séries` : 'Nenhum exercício ainda'}
                    {last ? ` · último em ${formatDay(last)}` : ''}
                  </div>
                  {s && s.muscles.length > 0 && <div className="muted small ellipsis">{s.muscles.slice(0, 4).join(', ')}</div>}
                </Link>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className={`btn small${onDay(r, today) ? ' primary' : ''}`} onClick={() => start(r.id)} disabled={starting === r.id || !s?.exercises}>
                    {starting === r.id ? 'Preparando…' : 'Começar'}
                  </button>
                  <Link to={`/rotinas/${r.id}`} className="btn ghost small">
                    Editar
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}

// Rotinas na ordem da semana (segunda primeiro); as sem dia fixo vão para o fim.
const order = (r: Routine) => (r.weekdays.length ? Math.min(...r.weekdays.map(d => WEEK_ORDER.indexOf(d))) : 99)
