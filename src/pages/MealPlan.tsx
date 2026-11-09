import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui'
import { createMealPlans, loadFirstName, loadFoods, loadMealPlans, loadNutritionProfile, logPlanMeal, todayIso, updateMealPlan, type SavedPlan } from '../modules/nutrition/data'
import { formatGrams } from '../modules/nutrition/foods'
import {
  arrangeSlots,
  DEFAULT_SETTINGS,
  diaryMeal,
  generatePlan,
  MEAL_PRESETS,
  planFoodChoices,
  shoppingList,
  swapItem,
  targetsChanged,
  trainingTimes,
  type MealPlan,
  type PlanMeal,
  type PlanSettings,
  type PlanSlot,
} from '../modules/nutrition/mealPlan'
import { assignWeekday, dayActivity, daysLabel, dayTypeOf, singleDayType, suggestDayTypes, typicalStrengthMin, weekSchedule, type DaySchedule, type DayType } from '../modules/nutrition/dayTypes'
import { ageOn, dailyTargets, fiberTarget, waterTarget, type NutritionProfile } from '../modules/nutrition/targets'
import { listBodyWeights, listRoutines, listWorkouts, WEEKDAYS } from '../modules/training/data'
import { lastDistanceByPlan, listCardioPlans } from '../modules/cardio/data'
import { useAsync } from '../lib/useAsync'

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')
const liters = (ml: number) => (ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const longDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
/** Revisão do plano duas semanas depois de gerado. */
const reviewDate = (iso: string) => {
  const d = new Date(iso)
  d.setDate(d.getDate() + 14)
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

/** O que o formulário devolve: as refeições, o que não come e os tipos de dia. */
interface PlanRequest {
  slots: PlanSlot[]
  excluded: string[]
  seed: number
  days: DayType[]
}

/** Os tipos de dia de um plano salvo, para refazer com outra semente ou metas novas. */
function daysOf(saved: SavedPlan[]): DayType[] {
  return saved.map((p, i) => ({
    id: `d${i + 1}`,
    name: p.day_name ?? 'Todos os dias',
    weekdays: p.weekdays,
    training_times: trainingTimes(p.settings),
    extra_kcal: p.settings.extra_kcal ?? 0,
  }))
}

const dayLabel = (p: SavedPlan) => (p.day_name ? `${p.day_name} · ${daysLabel(p.weekdays)}` : 'Todos os dias')

export default function MealPlanPage() {
  const navigate = useNavigate()
  const loaded = useAsync(() =>
    Promise.all([
      loadNutritionProfile(),
      listBodyWeights(1),
      loadMealPlans(),
      loadFoods(),
      loadFirstName(),
      listRoutines(),
      listCardioPlans(),
      lastDistanceByPlan(todayIso()),
      listWorkouts(20),
    ]),
  )
  // Até a primeira mudança na tela, o plano é o que veio do banco.
  const [changedPlans, setSaved] = useState<SavedPlan[] | undefined>(undefined)
  const saved = changedPlans ?? loaded.data?.[2] ?? []
  const [tab, setTab] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loaded.loading) return <main className="page muted">Carregando…</main>
  if (loaded.error || !loaded.data) return <main className="page error">{loaded.error}</main>

  const [profile, weights, , foods, firstName, routines, cardio, lastCardio, workouts] = loaded.data
  const weight = weights.at(-1)?.weight_kg ?? null
  const now = new Date()
  const schedule = weekSchedule({
    routines,
    cardio,
    lastCardioByPlan: lastCardio,
    strengthMin: typicalStrengthMin(workouts.filter(w => w.ended_at).map(w => (Date.parse(w.ended_at!) - Date.parse(w.started_at)) / 60000)),
    weightKg: weight,
    countKcal: profile.add_workout_kcal,
  })
  const baseTargets = dailyTargets(profile, weight, now)
  const fiber = fiberTarget(profile.sex, profile.birth_date ? ageOn(profile.birth_date, now) : null)
  const forDay = (day: Pick<DayType, 'weekdays' | 'extra_kcal'>) => dayGoals(profile, weight, now, schedule, day)

  async function generate(req: PlanRequest) {
    if (!baseTargets || !weight) return
    setBusy(true)
    setError(null)
    try {
      const days = req.days.filter(d => d.weekdays.length)
      const entries = days.map(day => {
        const goals = forDay(day)
        const settings: PlanSettings = { slots: req.slots, training_time: null, training_times: day.training_times, excluded: req.excluded, seed: req.seed, extra_kcal: day.extra_kcal }
        const plan = generatePlan({ targets: goals.targets!, weightKg: weight, goal: profile.goal ?? 'maintain', fiberTarget: fiber, waterMl: goals.water_ml, settings, foods })
        return { day_name: days.length > 1 ? day.name : null, weekdays: day.weekdays, settings, plan }
      })
      setSaved(await createMealPlans(entries))
      setTab(null)
      setEditing(false)
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  async function swap(planIdx: number, mealIdx: number, itemIdx: number, subId: string) {
    const current = saved[planIdx]
    if (!current) return
    const plan = swapItem(current.plan, mealIdx, itemIdx, subId, foods, current.settings.excluded)
    const previous = saved
    setSaved(saved.map((p, i) => (i === planIdx ? { ...p, plan } : p)))
    try {
      await updateMealPlan(current.id, plan)
    } catch (err) {
      setSaved(previous)
      setError((err as Error).message)
    }
  }

  const back = (
    <button type="button" className="btn ghost small no-print" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => navigate('/nutricao')}>
      <Icon.back /> Nutrição
    </button>
  )

  if (!baseTargets || !weight) {
    return (
      <main className="page stack">
        {back}
        <div className="empty">
          <h3>Primeiro, as metas</h3>
          <span className="muted small">O plano é montado em cima das suas calorias e macros. Preencha peso, altura, idade e rotina em Metas.</span>
          <Link to="/nutricao/metas" className="btn primary">
            Calcular minhas metas
          </Link>
        </div>
      </main>
    )
  }

  const first = saved[0]
  const request = (seedDelta = 0): PlanRequest => ({ slots: first.settings.slots, excluded: first.settings.excluded, seed: first.settings.seed + seedDelta, days: daysOf(saved) })

  if (!first || editing) {
    const suggested = suggestDayTypes(schedule)
    const initial: PlanRequest = first
      ? request()
      : { slots: DEFAULT_SETTINGS.slots, excluded: [], seed: 0, days: suggested.length > 1 ? suggested : [{ ...singleDayType(), training_times: suggested[0]?.training_times ?? [] }] }
    return (
      <main className="page stack">
        {back}
        <div>
          <span className="eyebrow">Cardápio com os alimentos da TACO</span>
          <h1>{first ? 'Ajustar o plano' : 'Plano alimentar'}</h1>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Monto as refeições para bater suas metas ({fmt(baseTargets.kcal)} kcal e {fmt(baseTargets.protein_g)} g de proteína num dia sem treino{profile.add_workout_kcal ? ', mais o gasto dos treinos de cada dia' : ''}), com medidas caseiras, opções de troca e a lista de compras da semana.
        </p>
        <SettingsForm initial={initial} schedule={schedule} suggested={suggested} goalsFor={forDay} busy={busy} onSubmit={generate} onCancel={first ? () => setEditing(false) : undefined} />
        {error && <p className="error">{error}</p>}
      </main>
    )
  }

  const todayIdx = Math.max(0, saved.findIndex(p => p.weekdays.includes(now.getDay())))
  const current = tab != null && saved[tab] ? tab : todayIdx
  const selected = saved[current]
  const { plan } = selected
  const goals = forDay({ weekdays: selected.weekdays, extra_kcal: selected.settings.extra_kcal ?? 0 })
  const changed = saved.some(p => targetsChanged(p.plan, forDay({ weekdays: p.weekdays, extra_kcal: p.settings.extra_kcal ?? 0 }).targets))
  // Lista de compras da semana: cada cardápio conta tantas vezes quantos dias ele tem.
  const shopping = shoppingList(
    saved.flatMap(p => p.plan.meals.map(m => ({ ...m, items: m.items.map(i => ({ ...i, grams: i.grams * p.weekdays.length })) }))),
    foods,
    1,
  )

  return (
    <>
      <main className="page stack no-print">
        {back}
        <div className="page-head">
          <div>
            <span className="eyebrow">Gerado em {shortDate(plan.generated_at)}</span>
            <h1>Plano alimentar</h1>
          </div>
          <button type="button" className="btn ghost small" style={{ whiteSpace: 'nowrap' }} onClick={() => window.print()}>
            PDF
          </button>
        </div>

        {saved.length > 1 && (
          <div className="chips wrap" role="tablist" aria-label="Tipos de dia">
            {saved.map((p, i) => (
              <button key={p.id} type="button" role="tab" aria-selected={i === current} className={`chip ${i === current ? 'on' : ''}`} onClick={() => setTab(i)}>
                {p.day_name}
                {i === todayIdx && p.weekdays.includes(now.getDay()) ? ' · hoje' : ''}
              </button>
            ))}
          </div>
        )}
        {saved.length > 1 && (
          <p className="muted small" style={{ margin: 0 }}>
            {daysLabel(selected.weekdays)}
            {trainingTimes(selected.settings).length ? ` · treinos às ${trainingTimes(selected.settings).join(' e ')}` : ' · sem treino'}
            {goals.activity_kcal ? ` · +${fmt(goals.activity_kcal)} kcal dos treinos` : ''}
            {selected.settings.extra_kcal ? ` · ${selected.settings.extra_kcal > 0 ? '+' : ''}${fmt(selected.settings.extra_kcal)} kcal de ajuste` : ''}
          </p>
        )}

        {changed && (
          <div className="card stack" style={{ gap: 10, borderColor: 'var(--warn)' }}>
            <span className="small">
              Suas metas ou seus treinos mudaram desde este plano{goals.targets ? `: hoje este dia pede ${fmt(goals.targets.kcal)} kcal e ${fmt(goals.targets.protein_g)} g de proteína (o plano usa ${fmt(plan.targets.kcal)} kcal e ${fmt(plan.targets.protein_g)} g)` : ''}.
            </span>
            <button type="button" className="btn primary small" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => generate(request())}>
              Refazer com as metas novas
            </button>
          </div>
        )}

        <PlanTotals plan={plan} />

        <div className="grid-2">
          <button type="button" className="btn" disabled={busy} onClick={() => generate(request(1))}>
            {busy ? 'Gerando…' : 'Outro cardápio'}
          </button>
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Preferências
          </button>
        </div>
        {error && <p className="error">{error}</p>}

        {plan.meals.map((m, mi) => (
          <PlanMealCard key={`${selected.id}-${mi}`} meal={m} onSwap={(ii, subId) => swap(current, mi, ii, subId)} />
        ))}

        <section className="stack" style={{ gap: 10 }}>
          <h2>Orientações</h2>
          {plan.guidance.map(g => (
            <details key={g.title} className="card guidance">
              <summary>{g.title}</summary>
              <p className="small">{g.text}</p>
            </details>
          ))}
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <h2>Lista de compras para 7 dias</h2>
          <div className="card stack" style={{ gap: 14 }}>
            {shopping.map(g => (
              <div key={g.title}>
                <span className="eyebrow">{g.title}</span>
                <div className="shopping">
                  {g.items.map(i => (
                    <div key={i.food_id} className="spread small">
                      <span>{i.name}</span>
                      <span style={{ textAlign: 'right' }}>
                        <strong>{i.amount}</strong>
                        {i.note && <span className="muted tiny block">{i.note}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="muted tiny" style={{ margin: 0 }}>
            Carnes, arroz e feijão aparecem crus, no peso de comprar; entre parênteses, quanto rende pronto.
            {saved.length > 1 ? ' Soma os cardápios de cada tipo de dia pelos dias da semana.' : ''} Trocar alimentos no cardápio atualiza a lista.
          </p>
        </section>

        <p className="muted tiny" style={{ margin: 0 }}>
          Orientação geral calculada pelo NutriMax com a tabela TACO. Não substitui a consulta com um nutricionista, principalmente se você tiver alguma condição de saúde.
        </p>
      </main>
      <PlanPrint plans={saved} shopping={shopping} name={firstName} />
    </>
  )
}

/** Metas de um tipo de dia: as do perfil mais o gasto dos treinos desses dias e o ajuste manual. */
function dayGoals(profile: NutritionProfile, weight: number | null, now: Date, schedule: DaySchedule[], day: Pick<DayType, 'weekdays' | 'extra_kcal'>) {
  const activity = dayActivity(day, schedule)
  return {
    targets: dailyTargets(profile, weight, now, activity.kcal + day.extra_kcal),
    water_ml: waterTarget(weight) + activity.water_ml,
    activity_kcal: activity.kcal,
  }
}

function PlanTotals({ plan }: { plan: MealPlan }) {
  const t = plan.targets
  const stats: [string, number, number, string][] = [
    ['Calorias', plan.total.kcal, t.kcal, 'kcal'],
    ['Proteína', plan.total.protein_g, t.protein_g, 'g'],
    ['Carbo', plan.total.carbs_g, t.carbs_g, 'g'],
    ['Gordura', plan.total.fat_g, t.fat_g, 'g'],
  ]
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="macro-grid">
        {stats.map(([label, value, target, unit]) => (
          <div key={label} className="stat">
            <span>{label}</span>
            <strong>{fmt(value)}</strong>
            <small className="muted tiny">
              meta {fmt(target)} {unit}
            </small>
          </div>
        ))}
      </div>
      <span className="muted tiny">
        {plan.meals.length} refeições · fibra {fmt(plan.total.fiber_g)} de {fmt(t.fiber_g)} g · água {(t.water_ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L por dia
      </span>
    </div>
  )
}

function PlanMealCard({ meal, onSwap }: { meal: PlanMeal; onSwap: (itemIdx: number, subId: string) => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function log() {
    setState('busy')
    setError(null)
    try {
      await logPlanMeal(todayIso(), diaryMeal(meal), meal.items)
      setState('done')
    } catch (err) {
      setError((err as Error).message)
      setState('idle')
    }
  }

  return (
    <section className="card meal">
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <span className="eyebrow">{meal.time}</span>
          <h3>{meal.label}</h3>
          <span className="muted tiny">
            {fmt(meal.total.kcal)} kcal · P {fmt(meal.total.protein_g)} · C {fmt(meal.total.carbs_g)} · G {fmt(meal.total.fat_g)}
          </span>
        </div>
        <button type="button" className={`btn small ${state === 'done' ? '' : 'primary'}`} disabled={state !== 'idle'} onClick={log}>
          {state === 'done' ? (
            <>
              <Icon.check /> No diário
            </>
          ) : state === 'busy' ? (
            'Lançando…'
          ) : (
            'Comi hoje'
          )}
        </button>
      </div>
      <div className="meal-items">
        {meal.items.map((i, ii) => (
          <div key={i.food_id + ii}>
            <button type="button" className="meal-item" aria-expanded={open === ii} onClick={() => setOpen(open === ii ? null : ii)}>
              <span className="grow">
                <span className="ellipsis block">{i.name}</span>
                <span className="muted tiny">{i.measure ? `${i.measure} · ${formatGrams(i.grams)}` : formatGrams(i.grams)}</span>
              </span>
              <strong className="small">{fmt(i.kcal)} kcal</strong>
              {i.subs.length > 0 && <span className="chev">{open === ii ? '−' : '⇄'}</span>}
            </button>
            {open === ii && i.subs.length > 0 && (
              <div className="subs">
                <span className="muted tiny">Pode trocar por:</span>
                <div className="chips wrap">
                  {i.subs.map(s => (
                    <button
                      key={s.food_id}
                      type="button"
                      className="chip"
                      onClick={() => {
                        setOpen(null)
                        onSwap(ii, s.food_id)
                      }}
                    >
                      {s.name} · {s.measure ?? formatGrams(s.grams)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {error && <p className="error small">{error}</p>}
    </section>
  )
}

function SettingsForm(props: {
  initial: PlanRequest
  schedule: DaySchedule[]
  suggested: DayType[]
  goalsFor: (day: Pick<DayType, 'weekdays' | 'extra_kcal'>) => ReturnType<typeof dayGoals>
  busy: boolean
  onSubmit: (r: PlanRequest) => void
  onCancel?: () => void
}) {
  const [slots, setSlots] = useState(props.initial.slots)
  const [days, setDays] = useState<DayType[]>(props.initial.days)
  const [excluded, setExcluded] = useState(new Set(props.initial.excluded))
  const byDay = days.length > 1
  const choices = planFoodChoices()
  const validTimes = slots.every(s => /^\d{2}:\d{2}$/.test(s.time)) && days.every(d => d.training_times.every(t => /^\d{2}:\d{2}$/.test(t)))
  const uncovered = [0, 1, 2, 3, 4, 5, 6].filter(w => !dayTypeOf(w, days))

  const toggle = (id: string) =>
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const patchDay = (id: string, patch: Partial<DayType>) => setDays(ds => ds.map(d => (d.id === id ? { ...d, ...patch } : d)))

  function setMode(perDay: boolean) {
    if (perDay === byDay) return
    if (perDay) setDays(props.suggested.length > 1 ? props.suggested : [{ ...singleDayType(), name: 'Dia de treino', weekdays: [1, 2, 3, 4, 5] }, { id: 'd2', name: 'Descanso', weekdays: [6, 0], training_times: [], extra_kcal: 0 }])
    else setDays([{ ...singleDayType(), training_times: days[0]?.training_times ?? [] }])
  }

  function addDay() {
    const id = `d${Date.now()}`
    setDays(ds => [...ds, { id, name: `Tipo ${ds.length + 1}`, weekdays: [], training_times: [], extra_kcal: 0 }])
  }

  return (
    <form
      className="stack"
      onSubmit={e => {
        e.preventDefault()
        if (!validTimes) return
        props.onSubmit({ slots, excluded: [...excluded], seed: props.initial.seed, days: days.map(d => ({ ...d, name: d.name.trim() || 'Dia' })) })
      }}
    >
      <div className="field">
        <span>Refeições por dia</span>
        <div className="chips wrap">
          {[3, 4, 5, 6].map(n => (
            <button key={n} type="button" className={`chip ${slots.length === n ? 'on' : ''}`} onClick={() => setSlots(MEAL_PRESETS[n])}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        {slots.map((s, i) => (
          <label key={i} className="spread">
            <span className="small" style={{ fontWeight: 600 }}>
              {s.label}
            </span>
            <input
              className="input time"
              type="time"
              value={s.time}
              onChange={e => setSlots(slots.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))}
              aria-label={`Horário do ${s.label}`}
            />
          </label>
        ))}
      </div>

      <div className="field">
        <span>Cardápio</span>
        <div className="chips wrap">
          <button type="button" className={`chip ${!byDay ? 'on' : ''}`} onClick={() => setMode(false)}>
            Igual todos os dias
          </button>
          <button type="button" className={`chip ${byDay ? 'on' : ''}`} onClick={() => setMode(true)}>
            Um para cada tipo de dia
          </button>
        </div>
        <small className="muted tiny">
          {byDay
            ? 'Dias com treinos diferentes ganham cardápios diferentes: mais comida nos dias de maior gasto, pré e pós-treino nos horários certos.'
            : 'Um cardápio só, com o treino no horário que você escolher.'}
        </small>
      </div>

      {days.map(d => (
        <DayCard
          key={d.id}
          day={d}
          byDay={byDay}
          goals={props.goalsFor(d)}
          slots={slots}
          onChange={patch => patchDay(d.id, patch)}
          onToggleWeekday={w => setDays(ds => (d.weekdays.includes(w) ? ds.map(x => (x.id === d.id ? { ...x, weekdays: x.weekdays.filter(y => y !== w) } : x)) : assignWeekday(ds, d.id, w)))}
          onRemove={byDay && days.length > 1 ? () => setDays(ds => ds.filter(x => x.id !== d.id)) : undefined}
        />
      ))}
      {byDay && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn ghost small" onClick={addDay}>
            + Tipo de dia
          </button>
          <button type="button" className="btn ghost small" onClick={() => setDays(props.suggested.length > 1 ? props.suggested : days)}>
            Sugerir pelos meus treinos
          </button>
        </div>
      )}
      {byDay && uncovered.length > 0 && (
        <p className="small" style={{ margin: 0, color: 'var(--warn)' }}>
          {uncovered.map(w => WEEKDAYS[w]).join(', ')} {uncovered.length === 1 ? 'está' : 'estão'} sem cardápio. Toque no dia em um dos tipos acima.
        </p>
      )}

      <div className="field">
        <span>O que você não come</span>
        <p className="muted tiny" style={{ margin: 0 }}>
          Toque para tirar do cardápio e das trocas.
        </p>
        {choices.map(g => (
          <div key={g.group} className="stack" style={{ gap: 6, marginTop: 8 }}>
            <span className="eyebrow">{g.group}</span>
            <div className="chips wrap">
              {g.foods.map(f => (
                <button key={f.id} type="button" className={`chip ${excluded.has(f.id) ? 'off' : ''}`} aria-pressed={excluded.has(f.id)} onClick={() => toggle(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="btn primary big block" disabled={props.busy || !validTimes || !days.some(d => d.weekdays.length)}>
        {props.busy ? 'Gerando…' : byDay ? `Gerar ${days.filter(d => d.weekdays.length).length} cardápios` : 'Gerar plano'}
      </button>
      {props.onCancel && (
        <button type="button" className="btn ghost block" onClick={props.onCancel}>
          Voltar ao plano
        </button>
      )}
    </form>
  )
}

/** Um tipo de dia no formulário: nome, dias da semana, horários de treino e ajuste de calorias. */
function DayCard(props: {
  day: DayType
  byDay: boolean
  goals: ReturnType<typeof dayGoals>
  slots: PlanSlot[]
  onChange: (patch: Partial<DayType>) => void
  onToggleWeekday: (w: number) => void
  onRemove?: () => void
}) {
  const { day, goals } = props
  const [newTime, setNewTime] = useState('')
  const preview = arrangeSlots(props.slots, day.training_times)
  const around = preview.filter(s => s.kind === 'pre_workout' || s.kind === 'post_workout')
  const extraText = day.extra_kcal ? String(day.extra_kcal) : ''

  return (
    <div className="card stack" style={{ gap: 12 }}>
      {props.byDay && (
        <div className="spread" style={{ gap: 8 }}>
          <input className="input" value={day.name} onChange={e => props.onChange({ name: e.target.value })} aria-label="Nome do tipo de dia" />
          {props.onRemove && (
            <button type="button" className="btn ghost icon" onClick={props.onRemove} aria-label={`Remover ${day.name}`}>
              <Icon.close />
            </button>
          )}
        </div>
      )}
      {props.byDay && (
        <div className="chips wrap" aria-label="Dias da semana">
          {[1, 2, 3, 4, 5, 6, 0].map(w => (
            <button key={w} type="button" className={`chip ${day.weekdays.includes(w) ? 'on' : ''}`} aria-pressed={day.weekdays.includes(w)} onClick={() => props.onToggleWeekday(w)}>
              {WEEKDAYS[w].slice(0, 3)}
            </button>
          ))}
        </div>
      )}
      <div className="field">
        <span>Horários de treino</span>
        <div className="chips wrap">
          {day.training_times.map(t => (
            <button key={t} type="button" className="chip on" onClick={() => props.onChange({ training_times: day.training_times.filter(x => x !== t) })} aria-label={`Tirar o treino das ${t}`}>
              {t} ✕
            </button>
          ))}
          {!day.training_times.length && <span className="muted small">Sem treino</span>}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <input className="input time" type="time" value={newTime} onChange={e => setNewTime(e.target.value)} aria-label="Novo horário de treino" />
          <button
            type="button"
            className="btn small"
            disabled={!/^\d{2}:\d{2}$/.test(newTime) || day.training_times.includes(newTime)}
            onClick={() => {
              props.onChange({ training_times: [...day.training_times, newTime].sort() })
              setNewTime('')
            }}
          >
            + Treino
          </button>
        </div>
        {around.length > 0 && (
          <small className="muted tiny" style={{ marginTop: 4 }}>
            {around.map(s => `${s.label} às ${s.time}`).join(', ')}.
          </small>
        )}
      </div>
      <label className="field">
        <span>Ajuste de calorias neste dia (opcional)</span>
        <input
          className="input"
          inputMode="numeric"
          placeholder="0"
          value={extraText}
          onChange={e => {
            const n = Number(e.target.value.replace(/[^\d-]/g, ''))
            props.onChange({ extra_kcal: Number.isFinite(n) ? Math.max(-1500, Math.min(1500, n)) : 0 })
          }}
        />
      </label>
      {goals.targets && (
        <small className="muted tiny">
          Meta deste dia: {fmt(goals.targets.kcal)} kcal, {fmt(goals.targets.protein_g)} g de proteína, {fmt(goals.targets.carbs_g)} g de carboidrato e {liters(goals.water_ml)} L de água
          {goals.activity_kcal ? ` (inclui ${fmt(goals.activity_kcal)} kcal dos treinos)` : ''}.
        </small>
      )}
    </div>
  )
}

/** Versão para imprimir ou salvar em PDF, no formato de um plano de consultório. */
function PlanPrint({ plans, shopping, name }: { plans: SavedPlan[]; shopping: ReturnType<typeof shoppingList>; name: string | null }) {
  const first = plans[0].plan
  // Orientações repetidas entre os dias aparecem uma vez só.
  const guidance = [...new Map(plans.flatMap(p => p.plan.guidance).map(g => [g.title, g])).values()]
  return (
    <div className="print-only plan-print">
      <header>
        <strong className="brand-print">NutriMax</strong>
        <span>Gerado em {longDate(first.generated_at)}</span>
      </header>
      <h1>Plano alimentar</h1>
      <p className="sub">
        {name ? `${name} · ` : ''}
        {plans.length > 1 ? `${plans.length} cardápios, um para cada tipo de dia` : `${first.meals.length} refeições por dia`} · revisar em {reviewDate(first.generated_at)}
      </p>

      {plans.map(p => (
        <PrintDay key={p.id} saved={p} title={plans.length > 1 ? dayLabel(p) : 'Cardápio do dia'} />
      ))}

      <h2>Orientações</h2>
      {guidance.map(g => (
        <div key={g.title} className="print-guidance">
          <strong>{g.title}</strong>
          <p>{g.text}</p>
        </div>
      ))}

      <h2>Lista de compras para 7 dias</h2>
      {shopping.map(g => (
        <div key={g.title} className="print-shopping">
          <strong>{g.title}</strong>
          {g.items.map(i => (
            <div key={i.food_id} className="row-print">
              <span>{i.name}</span>
              <span>
                {i.amount}
                {i.note ? ` (${i.note})` : ''}
              </span>
            </div>
          ))}
        </div>
      ))}

      <footer>Orientação geral calculada pelo NutriMax. Não substitui a consulta com um nutricionista, principalmente se você tiver alguma condição de saúde.</footer>
    </div>
  )
}

function PrintDay({ saved, title }: { saved: SavedPlan; title: string }) {
  const { plan } = saved
  const t = plan.targets
  const totals: [string, number, number, string][] = [
    ['Calorias', plan.total.kcal, t.kcal, 'kcal'],
    ['Proteína', plan.total.protein_g, t.protein_g, 'g'],
    ['Carboidrato', plan.total.carbs_g, t.carbs_g, 'g'],
    ['Gordura', plan.total.fat_g, t.fat_g, 'g'],
    ['Fibra', plan.total.fiber_g, t.fiber_g, 'g'],
  ]
  return (
    <>
      <h2>{title}</h2>
      <div className="totals">
        {totals.map(([label, v, target, unit]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {fmt(v)} {unit}
            </strong>
            <small>
              meta {fmt(target)} {unit}
            </small>
          </div>
        ))}
      </div>
      {plan.meals.map((m, i) => (
        <section key={i} className="print-meal">
          <div className="print-meal-head">
            <strong>
              {m.time} {m.label}
            </strong>
            <span>
              {fmt(m.total.kcal)} kcal · P {fmt(m.total.protein_g)} g · C {fmt(m.total.carbs_g)} g · G {fmt(m.total.fat_g)} g
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Alimento</th>
                <th>Quantidade</th>
                <th>Medida caseira</th>
                <th className="num">kcal</th>
                <th>Pode trocar por</th>
              </tr>
            </thead>
            <tbody>
              {m.items.map((it, j) => (
                <tr key={j}>
                  <td>{it.name}</td>
                  <td>{formatGrams(it.grams)}</td>
                  <td>{it.measure ?? '–'}</td>
                  <td className="num">{fmt(it.kcal)}</td>
                  <td>{it.subs.length ? it.subs.map(s => `${s.name} (${s.measure ?? formatGrams(s.grams)})`).join('; ') : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  )
}
