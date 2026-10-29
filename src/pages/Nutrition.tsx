import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import FoodPicker from '../components/FoodPicker'
import { Icon, Modal } from '../components/ui'
import { deleteLog, listLogs, loadNutritionProfile, todayIso, updateLogGrams } from '../modules/nutrition/data'
import { formatGrams, mealForHour, MEALS, sumMacros, type FoodLog, type Macros, type Meal } from '../modules/nutrition/foods'
import { dailyTargets, type Targets } from '../modules/nutrition/targets'
import { listBodyWeights } from '../modules/training/data'
import { useAsync } from '../lib/useAsync'

const shift = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return todayIso(d)
}

function dayLabel(iso: string) {
  const today = todayIso()
  if (iso === today) return 'Hoje'
  if (iso === shift(today, -1)) return 'Ontem'
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

export default function Nutrition() {
  const [date, setDate] = useState(todayIso)
  const setup = useAsync(() => Promise.all([loadNutritionProfile(), listBodyWeights(1)]))
  const logs = useAsync(() => listLogs(date), [date])
  const [adding, setAdding] = useState<Meal | null>(null)
  const [editing, setEditing] = useState<FoodLog | null>(null)

  const [profile, weights] = setup.data ?? [null, []]
  const targets = profile ? dailyTargets(profile, weights.at(-1)?.weight_kg ?? null, new Date(date + 'T12:00:00')) : null
  const items = logs.data ?? []
  const total = sumMacros(items)
  const isToday = date === todayIso()

  return (
    <main className="page stack">
      <div className="page-head">
        <div>
          <span className="eyebrow">Diário alimentar</span>
          <h1>Nutrição</h1>
        </div>
        <Link to="/nutricao/metas" className="btn ghost small">
          Metas
        </Link>
      </div>

      <div className="day-nav">
        <button type="button" className="btn ghost icon" aria-label="Dia anterior" onClick={() => setDate(d => shift(d, -1))}>
          <Icon.back />
        </button>
        <strong>{dayLabel(date)}</strong>
        <button type="button" className="btn ghost icon" aria-label="Próximo dia" onClick={() => setDate(d => shift(d, 1))} disabled={isToday}>
          <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}>
            <Icon.back />
          </span>
        </button>
      </div>

      {setup.error && <p className="error">{setup.error}</p>}
      {logs.error && <p className="error">{logs.error}</p>}

      {setup.data && !targets && (
        <div className="empty">
          <h3>Defina suas metas</h3>
          <span className="muted small">Com seu peso, altura, idade e rotina eu calculo quantas calorias e quanto de proteína, carboidrato e gordura você precisa por dia.</span>
          <Link to="/nutricao/metas" className="btn primary">
            Calcular minhas metas
          </Link>
        </div>
      )}

      <Summary total={total} targets={targets} />

      {MEALS.map(meal => {
        const mealItems = items.filter(i => i.meal === meal.key)
        const mealTotal = sumMacros(mealItems)
        return (
          <section key={meal.key} className="card meal">
            <div className="spread">
              <div>
                <h3>{meal.label}</h3>
                {mealItems.length > 0 && (
                  <span className="muted tiny">
                    {fmt(mealTotal.kcal)} kcal · P {fmt(mealTotal.protein_g)} · C {fmt(mealTotal.carbs_g)} · G {fmt(mealTotal.fat_g)}
                  </span>
                )}
              </div>
              <button type="button" className="btn small" onClick={() => setAdding(meal.key)} aria-label={`Adicionar ao ${meal.label}`}>
                <Icon.plus /> Adicionar
              </button>
            </div>
            {mealItems.length > 0 && (
              <div className="meal-items">
                {mealItems.map(i => (
                  <button key={i.id} type="button" className="meal-item" onClick={() => setEditing(i)}>
                    <span className="grow ellipsis">{i.name}</span>
                    <span className="muted small">{formatGrams(i.grams)}</span>
                    <strong className="small">{fmt(i.kcal)} kcal</strong>
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {logs.data && items.length === 0 && isToday && (
        <button type="button" className="btn primary big block" onClick={() => setAdding(mealForHour(new Date().getHours()))}>
          <Icon.plus /> Registrar o que comi
        </button>
      )}

      {adding && <FoodPicker date={date} meal={adding} onClose={() => setAdding(null)} onAdded={logs.reload} />}
      {editing && (
        <EditLog
          log={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            logs.reload()
          }}
        />
      )}
    </main>
  )
}

function Ring({ value, max }: { value: number; max: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const over = max > 0 && value > max * 1.05
  return (
    <svg className="ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r={r} className="ring-track" />
      <circle cx="60" cy="60" r={r} className={`ring-fill ${over ? 'over' : ''}`} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
    </svg>
  )
}

function Summary({ total, targets }: { total: Macros; targets: Targets | null }) {
  const left = targets ? targets.kcal - total.kcal : null
  const macros: { label: string; key: keyof Omit<Macros, 'kcal'>; cls: string }[] = [
    { label: 'Proteína', key: 'protein_g', cls: 'p' },
    { label: 'Carboidrato', key: 'carbs_g', cls: 'c' },
    { label: 'Gordura', key: 'fat_g', cls: 'f' },
  ]
  return (
    <div className="card hero summary">
      <div className="ring-wrap">
        <Ring value={total.kcal} max={targets?.kcal ?? 0} />
        <div className="ring-label">
          {left == null ? (
            <>
              <strong>{fmt(total.kcal)}</strong>
              <span>kcal</span>
            </>
          ) : left >= 0 ? (
            <>
              <strong>{fmt(left)}</strong>
              <span>kcal restantes</span>
            </>
          ) : (
            <>
              <strong className="over">{fmt(-left)}</strong>
              <span>kcal acima</span>
            </>
          )}
        </div>
      </div>
      <div className="stack" style={{ gap: 12, minWidth: 0 }}>
        {targets && (
          <div className="muted small">
            {fmt(total.kcal)} de {fmt(targets.kcal)} kcal
          </div>
        )}
        {macros.map(m => {
          const goal = targets?.[m.key] ?? 0
          return (
            <div key={m.key}>
              <div className="spread small">
                <span style={{ fontWeight: 600 }}>{m.label}</span>
                <span className="muted">
                  {fmt(total[m.key])}
                  {goal > 0 && ` / ${fmt(goal)}`} g
                </span>
              </div>
              <div className="meter">
                <span className={`macro ${m.cls}`} style={{ width: `${goal > 0 ? Math.min((total[m.key] / goal) * 100, 100) : 0}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EditLog({ log, onClose, onSaved }: { log: FoodLog; onClose: () => void; onSaved: () => void }) {
  const [grams, setGrams] = useState(String(log.grams).replace('.', ','))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const g = Number(grams.replace(',', '.'))
  const valid = Number.isFinite(g) && g > 0 && g <= 5000
  const kcal = valid ? Math.round((log.kcal * g) / log.grams) : 0

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (valid) run(() => updateLogGrams(log, Math.round(g * 10) / 10))
  }

  return (
    <Modal title={log.name} onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
        <label className="field">
          <span>Quantidade (g)</span>
          <input className="input" inputMode="decimal" value={grams} onChange={e => setGrams(e.target.value)} />
        </label>
        <p className="muted small" style={{ margin: 0 }}>
          {fmt(kcal)} kcal com essa quantidade.
        </p>
        {error && <p className="error small">{error}</p>}
        <div className="grid-2">
          <button type="button" className="btn danger" disabled={busy} onClick={() => run(() => deleteLog(log.id))}>
            Remover
          </button>
          <button className="btn primary" disabled={!valid || busy}>
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}
