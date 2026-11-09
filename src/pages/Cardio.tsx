import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CardioLogModal, CardioPlanModal, type LogStart } from '../components/CardioForms'
import { Icon } from '../components/ui'
import { ACTIVITIES, daysLabel, describeTarget, formatDistance, formatDuration, logSummary, sessionTarget, totalsByActivity, type CardioLog, type CardioPlan } from '../modules/cardio/cardio'
import { lastDistanceByPlan, listCardioLogs, listCardioPlans } from '../modules/cardio/data'
import { listBodyWeights, loadLightWeek } from '../modules/training/data'
import { lightWeekStatus } from '../modules/training/lightWeek'
import { todayIso } from '../modules/nutrition/data'
import { useAsync } from '../lib/useAsync'

/** Segunda-feira da semana de `iso`. */
function weekStart(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return todayIso(d)
}

type Editing = { kind: 'plan'; plan?: CardioPlan } | { kind: 'log'; log?: CardioLog; from?: LogStart } | null

export default function Cardio() {
  const navigate = useNavigate()
  const today = todayIso()
  const data = useAsync(() => Promise.all([listCardioPlans(), listCardioLogs(null, null, 60), lastDistanceByPlan(today), listBodyWeights(1), loadLightWeek()]))
  const [editing, setEditing] = useState<Editing>(null)

  const [plans, logs, last, weights, lightSettings] = data.data ?? [[], [], new Map<string, number | null>(), [], null]
  const light = lightSettings ? lightWeekStatus(lightSettings, today).active : false
  const weight = weights.at(-1)?.weight_kg ?? null
  const week = totalsByActivity(logs.filter(l => l.date >= weekStart(today)))

  function startFrom(plan: CardioPlan) {
    setEditing({ kind: 'log', from: { plan, ...sessionTarget(plan, last.get(plan.id) ?? null, light) } })
  }

  const saved = () => {
    setEditing(null)
    data.reload()
  }

  return (
    <main className="page stack">
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => navigate('/rotinas')}>
        <Icon.back /> Treinos
      </button>
      <div className="page-head">
        <div>
          <span className="eyebrow">Corrida, bike, natação…</span>
          <h1>Cardio</h1>
        </div>
        <button type="button" className="btn primary small" onClick={() => setEditing({ kind: 'log' })}>
          + Registrar
        </button>
      </div>

      {data.loading && <p className="muted">Carregando…</p>}
      {data.error && <p className="error">{data.error}</p>}

      {week.length > 0 && (
        <div className="card stack" style={{ gap: 6 }}>
          <span className="eyebrow">Esta semana</span>
          {week.map(w => (
            <div key={w.activity} className="spread small">
              <span style={{ fontWeight: 600 }}>
                {ACTIVITIES[w.activity].label} · {w.sessions} {w.sessions === 1 ? 'sessão' : 'sessões'}
              </span>
              <span className="muted">{[w.distance_m ? formatDistance(w.distance_m) : null, formatDuration(w.duration_sec)].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
        </div>
      )}

      <div className="spread">
        <h2>Planos</h2>
        <button type="button" className="btn ghost small" onClick={() => setEditing({ kind: 'plan' })}>
          + Novo plano
        </button>
      </div>
      {data.data && plans.length === 0 && (
        <div className="empty">
          <span className="muted small">
            Monte o cardio da semana: uma corrida leve na terça, tiros na quinta, um longão no sábado, bike no domingo. Cada plano pode ter distância, tempo,
            intervalos e uma progressão.
          </span>
        </div>
      )}
      {plans.map(p => {
        const t = sessionTarget(p, last.get(p.id) ?? null, light)
        return (
          <div key={p.id} className="card spread" style={{ gap: 10 }}>
            <button type="button" className="grow" style={{ minWidth: 0, padding: 0, border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit' }} onClick={() => setEditing({ kind: 'plan', plan: p })}>
              <div className="title ellipsis" style={{ fontWeight: 700 }}>
                {p.name}
              </div>
              <div className="muted small ellipsis">
                {daysLabel(p.weekdays)}
                {p.time ? ` · ${p.time}` : ''} · {describeTarget(t.distance_m, p.duration_sec, t.intensity, t.intervals)}
              </div>
              {p.progression.step_m && (
                <div className="muted tiny">
                  +{formatDistance(p.progression.step_m)} por sessão{p.progression.max_m ? ` até ${formatDistance(p.progression.max_m)}` : ''}
                </div>
              )}
            </button>
            <button type="button" className="btn small" onClick={() => startFrom(p)}>
              Registrar
            </button>
          </div>
        )
      })}

      <h2>Registros</h2>
      {data.data && logs.length === 0 && <p className="muted small">Nenhuma atividade registrada ainda.</p>}
      {logs.map(l => (
        <button key={l.id} type="button" className="list-item" style={{ padding: 14, width: '100%', textAlign: 'left' }} onClick={() => setEditing({ kind: 'log', log: l })}>
          <div className="grow">
            <div className="title">{l.name}</div>
            <div className="muted small">{logSummary(l)}</div>
          </div>
          <span className="chev">›</span>
        </button>
      ))}

      {editing?.kind === 'plan' && <CardioPlanModal plan={editing.plan} onClose={() => setEditing(null)} onSaved={saved} />}
      {editing?.kind === 'log' && <CardioLogModal log={editing.log} from={editing.from} date={today} weightKg={weight} onClose={() => setEditing(null)} onSaved={saved} />}
    </main>
  )
}
