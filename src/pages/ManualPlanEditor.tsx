// Cardápio montado pela pessoa: ela escolhe as refeições, os horários e os alimentos; o app só
// soma e mostra quanto falta ou sobra para as metas do dia.
import { useState } from 'react'
import FoodPicker from '../components/FoodPicker'
import { Kcal, MacroTiles, Macros } from '../components/FoodRow'
import { Icon } from '../components/ui'
import { formatGrams, MEALS, type Meal } from '../modules/nutrition/foods'
import { itemFromFood, itemTotals, logForTime, mealTotals, moveWeekday, newId, type ManualDay, type ManualItem, type ManualMeal, type ManualPlan } from '../modules/nutrition/manualPlan'
import type { Targets } from '../modules/nutrition/targets'
import { WEEK_ORDER, WEEKDAYS } from '../modules/training/data'
import { todayIso } from '../modules/nutrition/data'

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')

export default function ManualPlanEditor(props: {
  plan: ManualPlan
  /** Metas do dia para os dias da semana deste cardápio. */
  targetsFor: (weekdays: number[]) => Targets | null
  onChange: (plan: ManualPlan) => Promise<void>
  onHelp: () => void
}) {
  const { plan } = props
  const today = new Date().getDay()
  const [dayId, setDayId] = useState<string | null>(null)
  const day = plan.days.find(d => d.id === dayId) ?? plan.days.find(d => d.weekdays.includes(today)) ?? plan.days[0]
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = (next: ManualPlan) => props.onChange(next).catch(err => setError((err as Error).message))
  const editDay = (fn: (d: ManualDay) => ManualDay) => save({ days: plan.days.map(d => (d.id === day.id ? fn(d) : d)) })
  const editMeal = (mealId: string, fn: (m: ManualMeal) => ManualMeal) => editDay(d => ({ ...d, meals: d.meals.map(m => (m.id === mealId ? fn(m) : m)) }))

  const targets = props.targetsFor(day.weekdays)
  const total = mealTotals(day.meals.flatMap(m => m.items))
  const meals = [...day.meals].sort((a, b) => a.time.localeCompare(b.time))
  const unassigned = WEEK_ORDER.filter(w => !plan.days.some(d => d.weekdays.includes(w)))

  function newDay() {
    // Começa como cópia do cardápio aberto: quase sempre o outro dia muda pouco.
    const copy: ManualDay = { id: newId(), name: 'Outro dia', weekdays: [], meals: day.meals.map(m => ({ ...m, id: newId(), items: m.items.map(i => ({ ...i, id: newId() })) })) }
    setDayId(copy.id)
    save({ days: [...plan.days, copy] })
  }

  function removeDay() {
    if (!window.confirm(`Apagar o cardápio "${day.name}"? Os dias dele passam para o primeiro cardápio.`)) return
    const rest = plan.days.filter(d => d.id !== day.id)
    rest[0] = { ...rest[0], weekdays: [...new Set([...rest[0].weekdays, ...day.weekdays])].sort((a, b) => a - b) }
    setDayId(null)
    save({ days: rest })
  }

  function addMeal() {
    const time = '10:00'
    editDay(d => ({ ...d, meals: [...d.meals, { id: newId(), name: 'Lanche', time, log: logForTime(time), items: [] }] }))
  }

  return (
    <div className="stack">
      <div className="chips wrap" role="tablist" aria-label="Cardápios">
        {plan.days.map(d => (
          <button key={d.id} type="button" role="tab" aria-selected={d.id === day.id} className={`chip ${d.id === day.id ? 'on' : ''}`} onClick={() => setDayId(d.id)}>
            {d.name}
            {d.weekdays.includes(today) ? ' · hoje' : ''}
          </button>
        ))}
        <button type="button" className="chip" onClick={newDay}>
          + Cardápio para outros dias
        </button>
      </div>

      <section className="card stack" style={{ gap: 10 }}>
        {plan.days.length > 1 && (
          <>
            <label className="field">
              <span>Nome deste cardápio</span>
              <TextInput value={day.name} onCommit={name => editDay(d => ({ ...d, name: name.trim() || d.name }))} placeholder="Dia de treino" />
            </label>
            <div className="field">
              <span>Vale para</span>
              <div className="chips wrap">
                {WEEK_ORDER.map(w => (
                  <button key={w} type="button" className={`chip ${day.weekdays.includes(w) ? 'on' : ''}`} aria-pressed={day.weekdays.includes(w)} onClick={() => !day.weekdays.includes(w) && save(moveWeekday(plan, day.id, w))}>
                    {WEEKDAYS[w].slice(0, 3)}
                  </button>
                ))}
              </div>
              <small className="muted tiny">
                Toque num dia para trazê-lo para este cardápio.
                {unassigned.length ? ` Sem cardápio: ${unassigned.map(w => WEEKDAYS[w].slice(0, 3)).join(', ')}.` : ''}
              </small>
            </div>
          </>
        )}
        <div className="spread" style={{ alignItems: 'baseline' }}>
          <strong style={{ fontSize: '1.4rem' }}>{fmt(total.kcal)} kcal</strong>
          {targets && (
            <span className={`small ${Math.abs(total.kcal - targets.kcal) <= targets.kcal * 0.05 ? '' : 'muted'}`}>
              meta {fmt(targets.kcal)} kcal · {total.kcal > targets.kcal ? `sobram ${fmt(total.kcal - targets.kcal)}` : `faltam ${fmt(targets.kcal - total.kcal)}`}
            </span>
          )}
        </div>
        <MacroTiles
          items={[
            { label: 'Proteína', value: total.p, target: targets?.protein_g, color: 'var(--protein)' },
            { label: 'Carboidrato', value: total.c, target: targets?.carbs_g, color: 'var(--carbs)' },
            { label: 'Gordura', value: total.f, target: targets?.fat_g, color: 'var(--fat)' },
            { label: 'Fibra', value: total.fiber, color: 'var(--accent)' },
          ]}
        />
        {plan.days.length > 1 && (
          <button type="button" className="btn ghost small danger" style={{ justifySelf: 'start' }} onClick={removeDay}>
            Apagar este cardápio
          </button>
        )}
      </section>

      {error && <p className="error small">{error}</p>}

      <div className="grid-list">
        {meals.map(m => (
          <MealEditor
            key={m.id}
            meal={m}
            onChange={fn => editMeal(m.id, fn)}
            onRemove={() => window.confirm(`Tirar "${m.name}" do cardápio?`) && editDay(d => ({ ...d, meals: d.meals.filter(x => x.id !== m.id) }))}
            onAdd={() => setAdding(m.id)}
          />
        ))}
      </div>

      <button type="button" className="btn block" style={{ borderStyle: 'dashed' }} onClick={addMeal}>
        <Icon.plus /> Adicionar refeição
      </button>

      <button type="button" className="btn ghost small" style={{ justifySelf: 'start' }} onClick={props.onHelp}>
        Preciso de ajuda para montar
      </button>

      {adding && (
        <FoodPicker
          date={todayIso()}
          meal={day.meals.find(m => m.id === adding)?.log ?? 'snack'}
          title={`Adicionar em ${day.meals.find(m => m.id === adding)?.name ?? 'refeição'}`}
          onClose={() => setAdding(null)}
          onAdded={() => {}}
          onPick={(food, grams, measure) => editMeal(adding, m => ({ ...m, items: [...m.items, itemFromFood(food, grams, measure)] }))}
        />
      )}
    </div>
  )
}

function MealEditor(props: { meal: ManualMeal; onChange: (fn: (m: ManualMeal) => ManualMeal) => void; onRemove: () => void; onAdd: () => void }) {
  const { meal } = props
  const t = mealTotals(meal.items)
  return (
    <section className="card meal stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8, alignItems: 'end' }}>
        <label className="field" style={{ width: 110, flexShrink: 0 }}>
          <span>Horário</span>
          <TextInput type="time" value={meal.time} onCommit={time => /^\d{2}:\d{2}$/.test(time) && props.onChange(m => ({ ...m, time }))} />
        </label>
        <label className="field grow">
          <span>Refeição</span>
          <TextInput value={meal.name} onCommit={name => props.onChange(m => ({ ...m, name: name.trim() || m.name }))} />
        </label>
      </div>
      <div className="field">
        <span>Entra no diário como</span>
        <div className="chips wrap">
          {MEALS.map(x => (
            <button key={x.key} type="button" className={`chip ${meal.log === x.key ? 'on' : ''}`} onClick={() => props.onChange(m => ({ ...m, log: x.key as Meal }))}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      {meal.items.length > 0 && (
        <div className="meal-sub">
          <span className="meal-head-kcal">
            <b>{fmt(t.kcal)}</b> kcal
          </span>
          <Macros p={t.p} c={t.c} f={t.f} />
        </div>
      )}
      <div className="meal-items">
        {meal.items.map(i => (
          <ItemRow
            key={i.id}
            item={i}
            onGrams={g => props.onChange(m => ({ ...m, items: m.items.map(x => (x.id === i.id ? { ...x, grams: g, measure: g === x.grams ? x.measure : null } : x)) }))}
            onRemove={() => props.onChange(m => ({ ...m, items: m.items.filter(x => x.id !== i.id) }))}
          />
        ))}
        {meal.items.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nenhum alimento ainda.</p>}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn small" onClick={props.onAdd}>
          <Icon.plus /> Alimento
        </button>
        <button type="button" className="btn ghost small danger" onClick={props.onRemove}>
          Tirar refeição
        </button>
      </div>
    </section>
  )
}

function ItemRow({ item, onGrams, onRemove }: { item: ManualItem; onGrams: (g: number) => void; onRemove: () => void }) {
  const t = itemTotals(item)
  return (
    <div className="meal-item" style={{ gap: 8 }}>
      <span className="food-main grow" style={{ minWidth: 0 }}>
        <span className="food-name">{item.name}</span>
        <span className="food-detail">{item.measure ? `${item.measure} · ${formatGrams(item.grams)}` : formatGrams(item.grams)}</span>
      </span>
      <TextInput
        className="input"
        style={{ width: 76 }}
        inputMode="decimal"
        aria-label={`Gramas de ${item.name}`}
        value={String(item.grams).replace('.', ',')}
        onCommit={v => {
          const g = Number(v.replace(',', '.'))
          if (Number.isFinite(g) && g > 0 && g <= 5000 && g !== item.grams) onGrams(Math.round(g * 10) / 10)
        }}
      />
      <Kcal value={t.kcal} />
      <button type="button" className="btn ghost icon" aria-label={`Tirar ${item.name}`} onClick={onRemove}>
        <Icon.close />
      </button>
    </div>
  )
}

/** Campo que só salva ao sair dele (ou Enter), para não gravar a cada tecla. */
function TextInput({ value, onCommit, className = 'input', ...rest }: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft != null && draft !== value) onCommit(draft)
    setDraft(null)
  }
  return (
    <input
      {...rest}
      className={className}
      value={draft ?? value}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}
