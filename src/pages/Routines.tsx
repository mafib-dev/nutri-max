import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createRoutine, listRoutines, loadLightWeek, saveLightWeek, WEEKDAYS } from '../modules/training/data'
import { lightWeekStatus, mondayOf, type LightWeekSettings } from '../modules/training/lightWeek'
import { todayIso } from '../modules/nutrition/data'
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
              {daysLabel(p.weekdays)} · {describeTarget(p.distance_m, p.duration_sec, p.intensity, p.intervals)}
            </div>
          </div>
          <span className="chev">›</span>
        </Link>
      ))}
    </main>
  )
}

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
