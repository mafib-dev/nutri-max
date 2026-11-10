import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import FoodPicker, { MacroInputs, parseMacroInputs } from '../components/FoodPicker'
import { AnimatePresence, motion } from 'motion/react'
import { Icon, Modal } from '../components/ui'
import { listItem } from '../lib/motion'
import { Kcal, Macros } from '../components/FoodRow'
import NutritionSummary from '../components/NutritionSummary'
import { deleteLog, getWater, logPlanMeal, listLogs, loadNutritionProfile, saveMeal, setWater, todayIso, updateLogGrams, updateQuickLog, workoutMinutesOn } from '../modules/nutrition/data'
import { formatGrams, mealForHour, MEALS, sumMacros, sumMicros, type FoodLog, type Meal } from '../modules/nutrition/foods'
import { dayCardio } from '../modules/cardio/cardio'
import { loadCardioDay } from '../modules/cardio/data'
import { ageOn, dailyTargets, fiberTarget, kcalFloor, SODIUM_LIMIT_MG, waterTarget, workoutKcal } from '../modules/nutrition/targets'
import { listBodyWeights } from '../modules/training/data'
import { useAsync } from '../lib/useAsync'
import { useDataChanged } from '../lib/events'
import { loadPlanContext, planForWeekday } from '../modules/nutrition/planContext'
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

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

interface Section {
  key: string
  label: string
  time: string | null
  log: Meal
  plan: PlanMeal | null
  items: FoodLog[]
}

/**
 * Seções do diário: com plano no dia, exatamente as refeições dele, na ordem dos horários; o que
 * foi lançado sem refeição do plano (ou de outro plano) cai na primeira refeição do mesmo tipo,
 * e o que não couber em nenhuma vai para "Outros". Sem plano, as quatro de sempre.
 */
export function diarySections(meals: PlanMeal[], logs: FoodLog[]): Section[] {
  if (!meals.length) return MEALS.map(m => ({ key: m.key, label: m.label, time: null, log: m.key, plan: null, items: logs.filter(l => l.meal === m.key) }))
  const sections: Section[] = meals.map(m => ({ key: m.key, label: m.label, time: m.time, log: m.log, plan: m, items: [] }))
  const byKey = new Map(sections.map(x => [x.key, x]))
  const others: FoodLog[] = []
  for (const l of logs) {
    const sec = (l.plan_meal && byKey.get(l.plan_meal)) || sections.find(x => x.log === l.meal)
    if (sec) sec.items.push(l)
    else others.push(l)
  }
  if (others.length) sections.push({ key: 'outros', label: 'Outros', time: null, log: 'snack', plan: null, items: others })
  return sections
}

const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

export default function Nutrition() {
  const [date, setDate] = useState(todayIso)
  const setup = useAsync(() => Promise.all([loadNutritionProfile(), listBodyWeights(1)]))
  const logs = useAsync(() => listLogs(date), [date])
  const day = useAsync(() => Promise.all([workoutMinutesOn(date), getWater(date), loadCardioDay(date)]), [date])
  const planCtx = useAsync(loadPlanContext)
  useDataChanged(() => {
    setup.reload()
    logs.reload()
    day.reload()
    planCtx.reload()
  })
  const [adding, setAdding] = useState<{ meal: Meal; planMeal: string | null; title?: string } | null>(null)
  const [planBusy, setPlanBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<FoodLog | null>(null)
  const [saving, setSaving] = useState<{ meal: string; items: FoodLog[] } | null>(null)
  const [water, setWaterState] = useState<{ date: string; ml: number } | null>(null)

  const [profile, weights] = setup.data ?? [null, []]
  const weight = weights.at(-1)?.weight_kg ?? null
  const on = new Date(date + 'T12:00:00')
  // Corrida, bike etc. do dia: calorias na meta (se ligado) e água a mais. Dias passados não contam o que ficou só no plano.
  const cardioData = day.data?.[2]
  const cardio = cardioData ? dayCardio(date >= todayIso() ? cardioData.plans : [], on.getDay(), cardioData.logs, cardioData.last) : null
  const trainingKcal =
    profile?.add_workout_kcal && weight ? (day.data?.[0] ?? []).reduce((a, m) => a + workoutKcal(m, weight), 0) + (cardio?.creditKcal ?? 0) : 0
  const targets = profile ? dailyTargets(profile, weight, on, trainingKcal) : null
  const items = logs.data ?? []
  const total = sumMacros(items)
  const micros = sumMicros(items)
  const isToday = date === todayIso()
  // O cardápio do dia aberto (cada dia da semana pode ter o seu).
  const dayPlan = planCtx.data ? planForWeekday(planCtx.data, on.getDay()) : null
  const sections = diarySections(dayPlan?.plan.meals ?? [], items)
  // "Registrar o que comi" vai para a refeição do plano mais perto da hora (ou a seção da hora).
  const addNow = () => {
    const now = new Date().getHours() * 60 + new Date().getMinutes()
    const near = sections.filter(x => x.plan && x.time).sort((a, b) => Math.abs(toMin(a.time!) - now) - Math.abs(toMin(b.time!) - now))[0]
    return near ? { meal: near.log, planMeal: near.plan!.key, title: `Adicionar em ${near.label}` } : { meal: mealForHour(new Date().getHours()), planMeal: null }
  }
  const waterMl = water?.date === date ? water.ml : (day.data?.[1] ?? 0)
  const waterGoal = waterTarget(weight) + (cardio?.waterMl ?? 0)
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
          {dayPlan && dayPlan.plan.meals.length > 0 && (
            <Link to="/nutricao/plano" className="card stack" style={{ gap: 6, textDecoration: 'none', color: 'inherit' }}>
              <div className="spread">
                <span className="eyebrow">{isToday ? 'Plano de hoje' : `Plano de ${WEEKDAY_NAMES[on.getDay()]}`}</span>
                <span className="muted small">{fmt(dayPlan.plan.total.kcal)} kcal</span>
              </div>
              {dayPlan.name && <strong>{dayPlan.name}</strong>}
              <div className="muted small">{dayPlan.plan.meals.map(m => `${m.time} ${m.label}`).join(' · ')}</div>
            </Link>
          )}
          {sections.map(sec => {
            const mealItems = sec.items
            const mealTotal = sumMacros(mealItems)
            return (
              <section key={sec.key} className="card meal">
                <div className="spread">
                  <div>
                    {sec.time && <span className="time-badge">{sec.time}</span>}
                    <h3>{sec.label}</h3>
                  </div>
                  <button type="button" className="btn small" onClick={() => setAdding({ meal: sec.log, planMeal: sec.plan?.key ?? null, title: `Adicionar em ${sec.label}` })} aria-label={`Adicionar em ${sec.label}`}>
                    <Icon.plus /> Adicionar
                  </button>
                </div>
                {mealItems.length > 0 && (
                  <div className="meal-sub">
                    <span className="meal-head-kcal">
                      <b>{fmt(mealTotal.kcal)}</b> kcal
                    </span>
                    <Macros p={mealTotal.protein_g} c={mealTotal.carbs_g} f={mealTotal.fat_g} />
                  </div>
                )}
                {mealItems.length === 0 && sec.plan && (
                  <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                    <span className="eyebrow">O que comer · {fmt(sec.plan.total.kcal)} kcal</span>
                    <div className="meal-items planned">
                      {sec.plan.items.map(i => (
                        <div key={i.key} className="meal-item" style={{ opacity: 0.85 }}>
                          <span className="food-main grow">
                            <span className="food-name">{i.food.name}</span>
                            <span className="food-detail">{formatGrams(i.grams)}</span>
                          </span>
                          <Kcal value={Math.round((i.food.kcal * i.grams) / 100)} />
                        </div>
                      ))}
                      {sec.plan.items.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nenhum alimento nesta refeição do plano.</p>}
                    </div>
                    {sec.plan.items.length > 0 && (
                      <button type="button" className="btn small" style={{ justifySelf: 'start' }} onClick={() => followPlan(sec.plan!)} disabled={planBusy != null}>
                        {planBusy === sec.plan.key ? 'Lançando…' : 'Comi isso'}
                      </button>
                    )}
                  </div>
                )}
                {mealItems.length > 0 && (
                  <div className="meal-items">
                    <AnimatePresence initial={false}>
                      {mealItems.map(i => (
                        <motion.button key={i.id} {...listItem} type="button" className="meal-item" onClick={() => setEditing(i)}>
                          <span className="food-main grow">
                            <span className="food-name">{i.name}</span>
                            <span className="food-detail">{i.grams == null ? 'Lançamento rápido' : (i.measure ?? formatGrams(i.grams))}</span>
                          </span>
                          <Kcal value={i.kcal} />
                        </motion.button>
                      ))}
                    </AnimatePresence>
                    <motion.button layout="position" type="button" className="btn ghost small save-meal" onClick={() => setSaving({ meal: sec.label, items: mealItems })}>
                      Salvar como refeição
                    </motion.button>
                  </div>
                )}
              </section>
            )
          })}

          {logs.data && items.length === 0 && isToday && (
            <button type="button" className="btn primary big block" onClick={() => setAdding(addNow())}>
              <Icon.plus /> Registrar o que comi
            </button>
          )}

        </div>
      </div>
      {adding && <FoodPicker date={date} meal={adding.meal} planMeal={adding.planMeal} title={adding.title} onClose={() => setAdding(null)} onAdded={logs.reload} />}
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
