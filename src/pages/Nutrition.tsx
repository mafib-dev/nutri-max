import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import FoodPicker, { MacroInputs, parseMacroInputs } from '../components/FoodPicker'
import { Icon, Modal } from '../components/ui'
import NutritionSummary from '../components/NutritionSummary'
import { deleteLog, getWater, logPlanMeal, listLogs, loadNutritionProfile, saveMeal, setWater, todayIso, updateLogGrams, updateQuickLog, workoutMinutesOn } from '../modules/nutrition/data'
import { formatGrams, mealForHour, MEALS, sumMacros, sumMicros, type FoodLog, type Meal } from '../modules/nutrition/foods'
import { ageOn, dailyTargets, fiberTarget, kcalFloor, SODIUM_LIMIT_MG, waterTarget, workoutKcal } from '../modules/nutrition/targets'
import { listBodyWeights } from '../modules/training/data'
import { useAsync } from '../lib/useAsync'
import { useDataChanged } from '../lib/events'
import { loadPlanContext } from '../modules/nutrition/planContext'
import type { PlanMeal } from '../modules/nutrition/plan'

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
  const day = useAsync(() => Promise.all([workoutMinutesOn(date), getWater(date)]), [date])
  const planCtx = useAsync(loadPlanContext)
  useDataChanged(() => {
    setup.reload()
    logs.reload()
    day.reload()
    planCtx.reload()
  })
  const [adding, setAdding] = useState<Meal | null>(null)
  const [planBusy, setPlanBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<FoodLog | null>(null)
  const [saving, setSaving] = useState<{ meal: string; items: FoodLog[] } | null>(null)
  const [water, setWaterState] = useState<{ date: string; ml: number } | null>(null)

  const [profile, weights] = setup.data ?? [null, []]
  const weight = weights.at(-1)?.weight_kg ?? null
  const on = new Date(date + 'T12:00:00')
  const trainingKcal = profile?.add_workout_kcal && weight ? (day.data?.[0] ?? []).reduce((a, m) => a + workoutKcal(m, weight), 0) : 0
  const targets = profile ? dailyTargets(profile, weight, on, trainingKcal) : null
  const items = logs.data ?? []
  const total = sumMacros(items)
  const micros = sumMicros(items)
  const isToday = date === todayIso()
  const waterMl = water?.date === date ? water.ml : (day.data?.[1] ?? 0)
  const waterGoal = waterTarget(weight)
  const fiberGoal = fiberTarget(profile?.sex ?? null, profile?.birth_date ? ageOn(profile.birth_date, on) : null)
  const lowKcal = targets && profile && !profile.kcal_target && targets.kcal - trainingKcal < kcalFloor(profile.sex)

  async function addWater(delta: number) {
    const next = Math.max(0, waterMl + delta)
    setWaterState({ date, ml: next })
    try {
      await setWater(date, next)
    } catch {
      setWaterState({ date, ml: waterMl })
    }
  }

  async function followPlan(m: PlanMeal) {
    setPlanBusy(m.key)
    try {
      await logPlanMeal(date, m)
      logs.reload()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setPlanBusy(null)
    }
  }

  return (
    <main className="page stack">
      <div className="page-head">
        <div>
          <span className="eyebrow">Diário alimentar</span>
          <h1>Nutrição</h1>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <Link to="/nutricao/plano" className="btn ghost small">
            Plano
          </Link>
          <Link to="/nutricao/metas" className="btn ghost small">
            Metas
          </Link>
        </div>
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

      <div className="cols">
        <div className="col sticky-col">
          <NutritionSummary total={total} targets={targets} trainingKcal={trainingKcal} />
          {lowKcal && (
            <p className="small" style={{ margin: 0, color: 'var(--warn)' }}>
              Sua meta está abaixo de {fmt(kcalFloor(profile!.sex))} kcal. Fica difícil bater vitaminas e minerais; considere um ritmo mais leve em Metas.
            </p>
          )}

          <div className="card day-extras">
            <div>
              <div className="spread small">
                <span style={{ fontWeight: 600 }}>Água</span>
                <span className="muted">
                  {(waterMl / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} / {(waterGoal / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L
                </span>
              </div>
              <div className="meter">
                <span className="macro w" style={{ width: `${Math.min((waterMl / waterGoal) * 100, 100)}%` }} />
              </div>
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button type="button" className="btn small" onClick={() => addWater(250)} disabled={!day.data}>
                  + Copo 250 ml
                </button>
                <button type="button" className="btn small" onClick={() => addWater(500)} disabled={!day.data}>
                  + Garrafa 500 ml
                </button>
                <button type="button" className="btn ghost small" onClick={() => addWater(-250)} disabled={!day.data || waterMl === 0} aria-label="Tirar um copo">
                  −
                </button>
              </div>
            </div>
            <div className="micros">
              <div>
                <div className="spread small">
                  <span style={{ fontWeight: 600 }}>Fibra</span>
                  <span className="muted">
                    {fmt(micros.fiber_g)} / {fiberGoal} g
                  </span>
                </div>
                <div className="meter">
                  <span className="macro c" style={{ width: `${Math.min((micros.fiber_g / fiberGoal) * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="spread small">
                  <span style={{ fontWeight: 600 }}>Sódio</span>
                  <span className={micros.sodium_mg > SODIUM_LIMIT_MG ? 'small' : 'muted'} style={micros.sodium_mg > SODIUM_LIMIT_MG ? { color: 'var(--warn)' } : undefined}>
                    {fmt(micros.sodium_mg)} / {fmt(SODIUM_LIMIT_MG)} mg
                  </span>
                </div>
                <div className="meter">
                  <span className={`macro ${micros.sodium_mg > SODIUM_LIMIT_MG ? 'f' : 'p'}`} style={{ width: `${Math.min((micros.sodium_mg / SODIUM_LIMIT_MG) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

        </div>
        <div className="col">
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
                {mealItems.length === 0 &&
                  (planCtx.data?.plan?.meals ?? [])
                    .filter(m => m.log === meal.key)
                    .map(m => (
                      <button key={m.key} type="button" className="btn ghost small follow-plan" onClick={() => followPlan(m)} disabled={planBusy != null}>
                        {planBusy === m.key ? 'Lançando…' : `Seguir o plano: ${m.label} · ${fmt(m.total.kcal)} kcal`}
                      </button>
                    ))}
                {mealItems.length > 0 && (
                  <div className="meal-items">
                    {mealItems.map(i => (
                      <button key={i.id} type="button" className="meal-item" onClick={() => setEditing(i)}>
                        <span className="grow ellipsis">{i.name}</span>
                        <span className="muted small">{i.grams == null ? 'rápido' : formatGrams(i.grams)}</span>
                        <strong className="small">{fmt(i.kcal)} kcal</strong>
                      </button>
                    ))}
                    <button type="button" className="btn ghost small save-meal" onClick={() => setSaving({ meal: meal.label, items: mealItems })}>
                      Salvar como refeição
                    </button>
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

        </div>
      </div>
      {adding && <FoodPicker date={date} meal={adding} onClose={() => setAdding(null)} onAdded={logs.reload} />}
      {saving && <SaveMeal {...saving} onClose={() => setSaving(null)} />}
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

function EditLog({ log, onClose, onSaved }: { log: FoodLog; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const footer = (valid: boolean) => (
    <>
      {error && <p className="error small">{error}</p>}
      <div className="grid-2">
        <button type="button" className="btn danger" disabled={busy} onClick={() => run(() => deleteLog(log.id))}>
          Remover
        </button>
        <button className="btn primary" disabled={!valid || busy}>
          Salvar
        </button>
      </div>
    </>
  )

  return (
    <Modal title={log.name} onClose={onClose}>
      {log.grams == null ? <EditQuick log={log} run={run} footer={footer} /> : <EditGrams log={{ ...log, grams: log.grams }} run={run} footer={footer} />}
    </Modal>
  )
}

type EditProps<L> = { log: L; run: (action: () => Promise<void>) => void; footer: (valid: boolean) => ReactNode }

function EditGrams({ log, run, footer }: EditProps<FoodLog & { grams: number }>) {
  const [grams, setGrams] = useState(String(log.grams).replace('.', ','))
  const g = Number(grams.replace(',', '.'))
  const valid = Number.isFinite(g) && g > 0 && g <= 5000
  const kcal = valid ? Math.round((log.kcal * g) / log.grams) : 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (valid) run(() => updateLogGrams(log, Math.round(g * 10) / 10))
  }

  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
      <label className="field">
        <span>Quantidade (g)</span>
        <input className="input" inputMode="decimal" value={grams} onChange={e => setGrams(e.target.value)} />
      </label>
      <p className="muted small" style={{ margin: 0 }}>
        {fmt(kcal)} kcal com essa quantidade.
      </p>
      {footer(valid)}
    </form>
  )
}

function EditQuick({ log, run, footer }: EditProps<FoodLog>) {
  const [values, setValues] = useState({ kcal: String(log.kcal), protein_g: String(log.protein_g), carbs_g: String(log.carbs_g), fat_g: String(log.fat_g) })
  const parsed = parseMacroInputs(values)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (parsed) run(() => updateQuickLog(log.id, parsed))
  }

  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
      <MacroInputs values={values} onChange={setValues} />
      {footer(!!parsed)}
    </form>
  )
}

function SaveMeal({ meal, items, onClose }: { meal: string; items: FoodLog[]; onClose: () => void }) {
  const [name, setName] = useState(`Meu ${meal.toLowerCase()}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await saveMeal(name.trim(), items)
      setDone(true)
      setTimeout(onClose, 900)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Salvar refeição" onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
        <p className="muted small" style={{ margin: 0 }}>
          {items.length} {items.length === 1 ? 'item' : 'itens'}, {fmt(sumMacros(items).kcal)} kcal. Depois é só escolher em “Refeições salvas” ao adicionar.
        </p>
        <label className="field">
          <span>Nome</span>
          <input className="input" autoFocus value={name} onChange={e => setName(e.target.value)} />
        </label>
        {error && <p className="error small">{error}</p>}
        <button className="btn primary big block" disabled={busy || done || !name.trim()}>
          {done ? (
            <>
              <Icon.check /> Salva
            </>
          ) : busy ? (
            'Salvando…'
          ) : (
            'Salvar'
          )}
        </button>
      </form>
    </Modal>
  )
}
