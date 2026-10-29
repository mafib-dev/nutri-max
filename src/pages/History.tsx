import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteWorkout, exerciseName, WEEKDAYS } from '../modules/training/data'
import { loadHistory } from '../modules/history/data'
import type { DayHistory } from '../modules/history/days'
import { MEALS, sumMacros } from '../modules/nutrition/foods'
import { todayIso } from '../modules/nutrition/data'
import { waterTarget } from '../modules/nutrition/targets'
import type { OgWorkout } from '../modules/training/state'
import type { ExerciseRow } from '../modules/training/catalogue'
import { useAsync } from '../lib/useAsync'
import { formatDuration, formatKg } from '../lib/format'

const PAGE = 30
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const liters = (ml: number) => (ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })

function dayTitle(iso: string, today: string) {
  const d = new Date(iso + 'T12:00:00')
  const yesterday = new Date(today + 'T12:00:00')
  yesterday.setDate(yesterday.getDate() - 1)
  const date = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
  if (iso === today) return `Hoje, ${date}`
  if (iso === todayIso(yesterday)) return `Ontem, ${date}`
  return `${WEEKDAYS[d.getDay()]}, ${date}`
}

export default function History() {
  const [days, setDays] = useState(PAGE)
  const [today] = useState(() => todayIso())
  const history = useAsync(() => loadHistory(days), [days])
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const data = history.data
  const byId = useMemo(() => new Map((data?.catalogue ?? []).map(e => [e.id, e])), [data])
  const detail = useMemo(() => new Map((data?.state.workouts ?? []).map(w => [w.id, w])), [data])

  async function remove(id: string) {
    if (!confirm('Apagar este treino do histórico?')) return
    try {
      await deleteWorkout(id)
      history.reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <main className="page stack">
      <div>
        <h1>Histórico</h1>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          Cada dia com o treino, a alimentação, a água e o peso.
        </p>
      </div>
      {history.loading && !data && <p className="muted">Carregando…</p>}
      {(history.error || error) && <p className="error">{history.error ?? error}</p>}
      {data && data.days.length === 0 && <p className="muted">Nada registrado nos últimos {days} dias.</p>}

      <div className="day-list">
        {data?.days.map(d => (
          <DayCard key={d.date} day={d} title={dayTitle(d.date, today)} open={open === d.date} onToggle={() => setOpen(open === d.date ? null : d.date)} detail={detail} byId={byId} onRemove={remove} />
        ))}
      </div>

      {data && (
        <button type="button" className="btn block" onClick={() => setDays(n => n + PAGE)} disabled={history.loading}>
          {history.loading ? 'Carregando…' : `Ver mais ${PAGE} dias`}
        </button>
      )}
    </main>
  )
}

function DayCard(props: {
  day: DayHistory
  title: string
  open: boolean
  onToggle: () => void
  detail: Map<string, OgWorkout>
  byId: Map<string, ExerciseRow>
  onRemove: (id: string) => void
}) {
  const { day, open } = props
  const t = day.targets
  const waterGoal = waterTarget(day.knownWeightKg)
  const hasFood = day.logs.length > 0

  return (
    <article className="card day-card">
      <button type="button" className="day-head" onClick={props.onToggle} aria-expanded={open}>
        <span className="title">{props.title}</span>
        <span className="muted small">{open ? 'Fechar' : 'Detalhes'}</span>
      </button>

      <div className="day-stats">
        <Stat label="Treino" value={day.workouts.length ? day.workouts.map(w => w.name ?? 'Treino').join(' + ') : 'Descanso'} hint={day.workouts.length ? `${fmt(day.trainingMin)} min · ${day.workouts.reduce((a, w) => a + w.sets, 0)} séries` : undefined} />
        <Stat
          label="Calorias"
          value={hasFood ? fmt(day.eaten.kcal) : '–'}
          hint={hasFood && t ? `de ${fmt(t.kcal)} kcal` : hasFood ? 'kcal' : 'nada lançado'}
          ratio={hasFood && t ? day.eaten.kcal / t.kcal : undefined}
        />
        <Stat
          label="Proteína"
          value={hasFood ? `${fmt(day.eaten.protein_g)} g` : '–'}
          hint={hasFood && t ? `de ${fmt(t.protein_g)} g` : undefined}
          ratio={hasFood && t ? day.eaten.protein_g / t.protein_g : undefined}
        />
        <Stat label="Água" value={day.waterMl ? `${liters(day.waterMl)} L` : '–'} hint={day.waterMl ? `de ${liters(waterGoal)} L` : undefined} ratio={day.waterMl ? day.waterMl / waterGoal : undefined} />
        {day.weightKg != null && <Stat label="Peso" value={formatKg(day.weightKg)} />}
      </div>

      {open && (
        <div className="day-detail">
          <section>
            <h3>Alimentação</h3>
            {!hasFood && <p className="muted small">Nada lançado neste dia.</p>}
            {hasFood && (
              <p className="muted small" style={{ margin: '2px 0 8px' }}>
                P {fmt(day.eaten.protein_g)} g · C {fmt(day.eaten.carbs_g)} g · G {fmt(day.eaten.fat_g)} g
                {t ? ` (metas: ${fmt(t.protein_g)} · ${fmt(t.carbs_g)} · ${fmt(t.fat_g)} g)` : ''}
              </p>
            )}
            {MEALS.map(m => {
              const items = day.logs.filter(l => l.meal === m.key)
              if (!items.length) return null
              return (
                <div key={m.key} className="day-meal">
                  <div className="spread small">
                    <strong>{m.label}</strong>
                    <span className="muted">{fmt(sumMacros(items).kcal)} kcal</span>
                  </div>
                  <ul>
                    {items.map(l => (
                      <li key={l.id} className="small">
                        {l.name}
                        <span className="muted">
                          {l.grams ? ` · ${fmt(l.grams)} g` : ''} · {fmt(l.kcal)} kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </section>

          <section>
            <h3>Treino</h3>
            {!day.workouts.length && <p className="muted small">Sem treino neste dia.</p>}
            {day.workouts.map(w => {
              const og = props.detail.get(w.id)
              return (
                <div key={w.id} className="day-workout">
                  <div className="spread small">
                    <strong>{w.name ?? 'Treino'}</strong>
                    <span className="muted">
                      {w.ended_at ? `${formatDuration(w.started_at, w.ended_at)} · ` : ''}
                      {w.sets} séries · {formatKg(w.volume)}
                    </span>
                  </div>
                  {og?.entries.map((e, i) => (
                    <div key={i} className="small">
                      <Link to={`/progresso/${e.id}`}>{exerciseName(props.byId.get(e.id))}</Link>
                      <div className="muted">
                        {e.sets.map(s => `${s.phase === 'warmup' ? 'A ' : ''}${s.w.toLocaleString('pt-BR')}×${s.r}${s.rir != null ? ` (RIR ${s.rir})` : ''}`).join(' · ')}
                      </div>
                    </div>
                  ))}
                  <button type="button" className="btn ghost small danger" style={{ justifySelf: 'start' }} onClick={() => props.onRemove(w.id)}>
                    Apagar treino
                  </button>
                </div>
              )
            })}
          </section>
        </div>
      )}
    </article>
  )
}

function Stat({ label, value, hint, ratio }: { label: string; value: string; hint?: string; ratio?: number }) {
  // Perto da meta (90 a 110%) fica verde; muito acima, amarelo.
  const tone = ratio == null ? '' : ratio > 1.1 ? 'over' : ratio >= 0.9 ? 'hit' : ''
  return (
    <div className="day-stat">
      <span className="label">{label}</span>
      <div className={`value ellipsis ${tone}`}>{value}</div>
      {hint && <div className="muted tiny">{hint}</div>}
      {ratio != null && (
        <div className="meter thin">
          <span className={tone || 'base'} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
        </div>
      )}
    </div>
  )
}
