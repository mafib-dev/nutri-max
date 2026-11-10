import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { muscleName } from '../components/ExerciseDetail'
import { createRoutine, daysLabel, listRoutineOverview, loadCatalogue, loadLightWeek, saveLightWeek, onDay, WEEK_ORDER, WEEKDAYS, type Routine } from '../modules/training/data'
import { startRoutine } from '../modules/training/start'
import { useActiveSession } from '../modules/training/activeSession'
import { lightWeekStatus, mondayOf, type LightWeekSettings } from '../modules/training/lightWeek'
import { todayIso } from '../modules/nutrition/data'
import { listCardioPlans } from '../modules/cardio/data'
import { daysLabel as cardioDays, describeTarget } from '../modules/cardio/cardio'
import { useAsync } from '../lib/useAsync'
import { formatDay } from '../lib/format'

export default function Routines() {
  const cardio = useAsync(listCardioPlans)
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
                  {s?.exercises ? (
                    <div className="meta-chips" style={{ marginTop: 8 }}>
                      <span className="meta-chip">
                        <b>{s.exercises}</b> exercícios
                      </span>
                      <span className="meta-chip">
                        <b>{s.sets}</b> séries
                      </span>
                      {[...new Set(s.muscles)].slice(0, 3).map(m => (
                        <span key={m} className="meta-chip">
                          {m}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="muted small">Nenhum exercício ainda</div>
                  )}
                  {last && <div className="muted tiny" style={{ marginTop: 8 }}>Último treino: {formatDay(last)}</div>}
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

      <LightWeekCard />

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
              {cardioDays(p.weekdays)} · {describeTarget(p.distance_m, p.duration_sec, p.intensity, p.intervals)}
            </div>
          </div>
          <span className="chev">›</span>
        </Link>
      ))}
    </main>
  )
}

// Rotinas na ordem da semana (segunda primeiro); as sem dia fixo vão para o fim.
const order = (r: Routine) => (r.weekdays.length ? Math.min(...r.weekdays.map(d => WEEK_ORDER.indexOf(d))) : 99)

const longDay = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const plusDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return todayIso(d)
}

/** Semana leve: ligar agora ou programar a cada N semanas. */
function LightWeekCard() {
  const loaded = useAsync(loadLightWeek)
  const [local, setLocal] = useState<LightWeekSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const s = local ?? loaded.data
  if (!s) return loaded.error ? <p className="error">{loaded.error}</p> : null
  const today = todayIso()
  const status = lightWeekStatus(s, today)

  async function save(patch: Partial<LightWeekSettings>) {
    const next = { ...s!, ...patch }
    setLocal(next)
    setError(null)
    try {
      await saveLightWeek(patch)
    } catch (err) {
      setLocal(s)
      setError((err as Error).message)
    }
  }

  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="spread">
        <h3>Semana leve</h3>
        {status.active && <span className="badge accent">Agora</span>}
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {status.active
          ? `Até ${longDay(status.until!)}: um terço a menos de séries e 10% a menos de carga, e cardio leve, sem tiros nem aumento de distância.`
          : 'De tempos em tempos, uma semana com menos séries e carga e cardio leve ajuda o corpo a se recuperar e voltar a progredir.'}
      </p>
      <div className="field">
        <span>Automática</span>
        <div className="chips wrap">
          {[null, 3, 4, 5, 6, 8].map(n => (
            <button
              key={String(n)}
              type="button"
              className={`chip ${s.light_week_every === n ? 'on' : ''}`}
              // O ciclo começa nesta semana: com "a cada 4", a 4ª semana a partir de agora é a leve.
              onClick={() => save({ light_week_every: n, light_week_start: n ? mondayOf(today) : null })}
            >
              {n ? `A cada ${n} semanas` : 'Desligada'}
            </button>
          ))}
        </div>
        {s.light_week_every && status.next && <small className="muted tiny">Próxima: semana de {longDay(status.next)}.</small>}
      </div>
      {status.reason === 'manual' ? (
        <button type="button" className="btn small" style={{ justifySelf: 'start' }} onClick={() => save({ light_week_until: null })}>
          Encerrar semana leve
        </button>
      ) : (
        !status.active && (
          <button type="button" className="btn small" style={{ justifySelf: 'start' }} onClick={() => save({ light_week_until: plusDays(today, 6) })}>
            Fazer semana leve a partir de hoje
          </button>
        )
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
