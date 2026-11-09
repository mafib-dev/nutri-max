import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui'
import { createMealPlan, loadFirstName, loadFoods, loadMealPlan, loadNutritionProfile, logPlanMeal, todayIso, updateMealPlan, type SavedPlan } from '../modules/nutrition/data'
import { formatGrams } from '../modules/nutrition/foods'
import {
  arrangeSlots,
  DEFAULT_SETTINGS,
  diaryMeal,
  generatePlan,
  MEAL_PRESETS,
  planFoodChoices,
  swapItem,
  targetsChanged,
  type MealPlan,
  type PlanMeal,
  type PlanSettings,
} from '../modules/nutrition/mealPlan'
import { ageOn, dailyTargets, fiberTarget, waterTarget } from '../modules/nutrition/targets'
import { listBodyWeights } from '../modules/training/data'
import { useAsync } from '../lib/useAsync'

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')
const longDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
/** Revisão do plano duas semanas depois de gerado. */
const reviewDate = (iso: string) => {
  const d = new Date(iso)
  d.setDate(d.getDate() + 14)
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

export default function MealPlanPage() {
  const navigate = useNavigate()
  const loaded = useAsync(() => Promise.all([loadNutritionProfile(), listBodyWeights(1), loadMealPlan(), loadFoods(), loadFirstName()]))
  // Até a primeira mudança na tela, o plano é o que veio do banco.
  const [changedPlan, setSaved] = useState<SavedPlan | null | undefined>(undefined)
  const saved = changedPlan === undefined ? (loaded.data?.[2] ?? null) : changedPlan
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loaded.loading) return <main className="page muted">Carregando…</main>
  if (loaded.error || !loaded.data) return <main className="page error">{loaded.error}</main>

  const [profile, weights, , foods, firstName] = loaded.data
  const weight = weights.at(-1)?.weight_kg ?? null
  const now = new Date()
  const targets = dailyTargets(profile, weight, now)
  const fiber = fiberTarget(profile.sex, profile.birth_date ? ageOn(profile.birth_date, now) : null)

  async function generate(settings: PlanSettings) {
    if (!targets || !weight) return
    setBusy(true)
    setError(null)
    try {
      const plan = generatePlan({ targets, weightKg: weight, goal: profile.goal ?? 'maintain', fiberTarget: fiber, waterMl: waterTarget(weight), settings, foods })
      setSaved(await createMealPlan(settings, plan))
      setEditing(false)
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  async function swap(mealIdx: number, itemIdx: number, subId: string) {
    if (!saved) return
    const plan = swapItem(saved.plan, mealIdx, itemIdx, subId, foods, saved.settings.excluded)
    const previous = saved
    setSaved({ ...saved, plan })
    try {
      await updateMealPlan(saved.id, plan)
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

  if (!targets || !weight) {
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

  if (!saved || editing) {
    return (
      <main className="page stack">
        {back}
        <div>
          <span className="eyebrow">Cardápio com os alimentos da TACO</span>
          <h1>{saved ? 'Ajustar o plano' : 'Plano alimentar'}</h1>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Monto um dia de refeições para bater {fmt(targets.kcal)} kcal, {fmt(targets.protein_g)} g de proteína, {fmt(targets.carbs_g)} g de carboidrato e {fmt(targets.fat_g)} g de gordura, com medidas caseiras, opções de troca e a lista de compras da semana.
        </p>
        <SettingsForm initial={saved?.settings ?? DEFAULT_SETTINGS} busy={busy} onSubmit={generate} onCancel={saved ? () => setEditing(false) : undefined} />
        {error && <p className="error">{error}</p>}
      </main>
    )
  }

  const { plan, settings } = saved
  const changed = targetsChanged(plan, targets)

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

        {changed && (
          <div className="card stack" style={{ gap: 10, borderColor: 'var(--warn)' }}>
            <span className="small">
              Suas metas mudaram desde este plano: agora são {fmt(targets.kcal)} kcal e {fmt(targets.protein_g)} g de proteína (o plano usa {fmt(plan.targets.kcal)} kcal e {fmt(plan.targets.protein_g)} g).
            </span>
            <button type="button" className="btn primary small" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => generate(settings)}>
              Refazer com as metas novas
            </button>
          </div>
        )}

        <PlanTotals plan={plan} />

        <div className="grid-2">
          <button type="button" className="btn" disabled={busy} onClick={() => generate({ ...settings, seed: settings.seed + 1 })}>
            {busy ? 'Gerando…' : 'Outro cardápio'}
          </button>
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Preferências
          </button>
        </div>
        {error && <p className="error">{error}</p>}

        {plan.meals.map((m, mi) => (
          <PlanMealCard key={mi} meal={m} onSwap={(ii, subId) => swap(mi, ii, subId)} />
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
            {plan.shopping.map(g => (
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
            Carnes, arroz e feijão aparecem crus, no peso de comprar; entre parênteses, quanto rende pronto. Trocar alimentos no cardápio atualiza a lista.
          </p>
        </section>

        <p className="muted tiny" style={{ margin: 0 }}>
          Orientação geral calculada pelo NutriMax com a tabela TACO. Não substitui a consulta com um nutricionista, principalmente se você tiver alguma condição de saúde.
        </p>
      </main>
      <PlanPrint plan={plan} name={firstName} />
    </>
  )
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

function SettingsForm(props: { initial: PlanSettings; busy: boolean; onSubmit: (s: PlanSettings) => void; onCancel?: () => void }) {
  const [slots, setSlots] = useState(props.initial.slots)
  const [trains, setTrains] = useState(props.initial.training_time != null)
  const [trainingTime, setTrainingTime] = useState(props.initial.training_time ?? '18:00')
  const [excluded, setExcluded] = useState(new Set(props.initial.excluded))
  const choices = planFoodChoices()
  const preview = arrangeSlots(slots, trains ? trainingTime : null)
  const validTimes = slots.every(s => /^\d{2}:\d{2}$/.test(s.time)) && (!trains || /^\d{2}:\d{2}$/.test(trainingTime))

  const toggle = (id: string) =>
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <form
      className="stack"
      onSubmit={e => {
        e.preventDefault()
        if (!validTimes) return
        props.onSubmit({ slots, training_time: trains ? trainingTime : null, excluded: [...excluded], seed: props.initial.seed })
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
        <span>Treino</span>
        <div className="chips wrap">
          <button type="button" className={`chip ${trains ? 'on' : ''}`} onClick={() => setTrains(true)}>
            Treino em um horário fixo
          </button>
          <button type="button" className={`chip ${!trains ? 'on' : ''}`} onClick={() => setTrains(false)}>
            Sem horário fixo
          </button>
        </div>
        {trains && (
          <label className="spread" style={{ marginTop: 8 }}>
            <span className="small">Horário do treino</span>
            <input className="input time" type="time" value={trainingTime} onChange={e => setTrainingTime(e.target.value)} />
          </label>
        )}
        {trains && preview.some(s => s.kind === 'pre_workout') && (
          <p className="muted tiny" style={{ margin: '6px 0 0' }}>
            O lanche antes do treino vira pré-treino às {preview.find(s => s.kind === 'pre_workout')!.time}, leve e com pouca gordura.
          </p>
        )}
      </div>

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

      <button className="btn primary big block" disabled={props.busy || !validTimes}>
        {props.busy ? 'Gerando…' : 'Gerar plano'}
      </button>
      {props.onCancel && (
        <button type="button" className="btn ghost block" onClick={props.onCancel}>
          Voltar ao plano
        </button>
      )}
    </form>
  )
}

/** Versão para imprimir ou salvar em PDF, no formato de um plano de consultório. */
function PlanPrint({ plan, name }: { plan: MealPlan; name: string | null }) {
  const t = plan.targets
  const totals: [string, number, number, string][] = [
    ['Calorias', plan.total.kcal, t.kcal, 'kcal'],
    ['Proteína', plan.total.protein_g, t.protein_g, 'g'],
    ['Carboidrato', plan.total.carbs_g, t.carbs_g, 'g'],
    ['Gordura', plan.total.fat_g, t.fat_g, 'g'],
    ['Fibra', plan.total.fiber_g, t.fiber_g, 'g'],
  ]
  return (
    <div className="print-only plan-print">
      <header>
        <strong className="brand-print">NutriMax</strong>
        <span>Gerado em {longDate(plan.generated_at)}</span>
      </header>
      <h1>Plano alimentar</h1>
      <p className="sub">
        {name ? `${name} · ` : ''}
        {plan.meals.length} refeições por dia · revisar em {reviewDate(plan.generated_at)}
      </p>
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

      <h2>Cardápio do dia</h2>
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

      <h2>Orientações</h2>
      {plan.guidance.map(g => (
        <div key={g.title} className="print-guidance">
          <strong>{g.title}</strong>
          <p>{g.text}</p>
        </div>
      ))}

      <h2>Lista de compras para 7 dias</h2>
      {plan.shopping.map(g => (
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

