import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui'
import { logPlanMeal, saveMealPlan, todayIso } from '../modules/nutrition/data'
import {
  buildPlan,
  buyAmount,
  DEFAULT_SETTINGS,
  guidance,
  itemMacros,
  optionsFor,
  PLAN_FOODS,
  portion,
  shoppingList,
  substitutes,
  type FoodKey,
  type PlanItem,
  type PlanMeal,
  type PlanSettings,
  type Role,
  type SavedPlan,
} from '../modules/nutrition/plan'
import { loadPlanContext } from '../modules/nutrition/planContext'
import { ageOn, fiberTarget, waterTarget } from '../modules/nutrition/targets'
import { useAsync } from '../lib/useAsync'

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')

const ROLE_LABEL: Record<Role, string> = {
  protein: 'Proteína',
  carb: 'Carboidrato',
  legume: 'Leguminosa',
  veg: 'Legume',
  salad: 'Salada',
  fruit: 'Fruta',
  fat: 'Gordura boa',
}

export default function MealPlan() {
  const navigate = useNavigate()
  const ctx = useAsync(loadPlanContext)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState<SavedPlan | null>(null)

  const data = ctx.data
  const current = saved ?? data?.saved ?? null
  const targets = data?.targets ?? null
  const plan = targets && current ? buildPlan(targets, current) : null

  async function persist(next: SavedPlan) {
    setSaved(next)
    await saveMealPlan(next)
  }

  return (
    <main className="page stack">
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => navigate('/nutricao')}>
        <Icon.back /> Nutrição
      </button>
      <div>
        <span className="eyebrow">O que comer, quanto e quando</span>
        <h1>Plano alimentar</h1>
      </div>

      {ctx.loading && !data && <p className="muted">Carregando…</p>}
      {ctx.error && <p className="error">{ctx.error}</p>}

      {data && !targets && (
        <div className="empty">
          <h3>Primeiro, suas metas</h3>
          <span className="muted small">O plano é montado em cima das suas calorias e macros. Preencha peso, altura, idade, rotina e objetivo.</span>
          <Link to="/nutricao/metas" className="btn primary">
            Calcular minhas metas
          </Link>
        </div>
      )}

      {data && targets && (!current || editing) && (
        <Consultation
          initial={current?.settings ?? DEFAULT_SETTINGS}
          onCancel={current ? () => setEditing(false) : undefined}
          onSave={async settings => {
            await persist({ settings, picks: {} })
            setEditing(false)
          }}
        />
      )}

      {data && targets && current && plan && !editing && (
        <PlanView
          plan={plan}
          saved={current}
          targets={targets}
          goal={data.profile.goal}
          weight={data.weight}
          fiberGoal={fiberTarget(data.profile.sex, data.profile.birth_date ? ageOn(data.profile.birth_date, new Date()) : null)}
          onPick={(slot, role, key) => persist({ ...current, picks: { ...current.picks, [slot]: { ...current.picks[slot], [role]: key } } })}
          onRedo={() => setEditing(true)}
        />
      )}
    </main>
  )
}

// ---------- Consulta ----------

const DISLIKE_GROUPS: [string, FoodKey[]][] = [
  ['Proteínas', ['frango', 'patinho', 'maminha', 'peru', 'lombo', 'merluza', 'sardinha', 'ovo', 'tofu', 'iogurte', 'ricota', 'minas', 'presunto', 'soja']],
  ['Carboidratos', ['arroz', 'integral', 'batataDoce', 'mandioca', 'batata', 'paoFrances', 'paoIntegral', 'aveia', 'cuscuz']],
  ['Feijões e legumes', ['feijao', 'feijaoPreto', 'lentilha', 'brocolis', 'cenoura', 'abobrinha', 'couveFlor']],
  ['Frutas e gorduras', ['banana', 'maca', 'mamao', 'laranja', 'morango', 'manga', 'castanha', 'amendoim', 'abacate']],
]

const short = (k: FoodKey) => PLAN_FOODS[k].name.replace(/ (grelhad[oa]|cozid[oa]|assad[oa])$/, '')

function Consultation({ initial, onSave, onCancel }: { initial: PlanSettings; onSave: (s: PlanSettings) => Promise<void>; onCancel?: () => void }) {
  const [s, setS] = useState<PlanSettings>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof PlanSettings>(k: K, v: PlanSettings[K]) => setS(prev => ({ ...prev, [k]: v }))
  const toggleDislike = (k: FoodKey) => set('dislikes', s.dislikes.includes(k) ? s.dislikes.filter(d => d !== k) : [...s.dislikes, k])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onSave(s)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <p className="muted small" style={{ margin: 0 }}>
        Responda como numa consulta. Com isso eu monto o cardápio do dia com as suas metas, os horários e as trocas possíveis.
      </p>

      <div className="field">
        <span>Quantas refeições por dia?</span>
        <div className="chips wrap">
          {([3, 4, 5, 6] as const).map(n => (
            <button key={n} type="button" className={`chip ${s.meals === n ? 'on' : ''}`} onClick={() => set('meals', n)}>
              {n}
            </button>
          ))}
        </div>
        <small className="muted tiny">5 costuma funcionar bem para quem treina: fica mais fácil bater a proteína e não passar fome.</small>
      </div>

      <div className="grid-2">
        <label className="field">
          <span>Acordo às</span>
          <input className="input" type="time" value={s.wake} onChange={e => set('wake', e.target.value || '07:00')} />
        </label>
        <label className="field">
          <span>Durmo às</span>
          <input className="input" type="time" value={s.sleep} onChange={e => set('sleep', e.target.value || '23:00')} />
        </label>
      </div>

      <div className="field">
        <span>Treino às</span>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" type="time" value={s.train ?? ''} disabled={s.train == null} onChange={e => set('train', e.target.value || null)} aria-label="Horário do treino" />
          <label className="row small" style={{ gap: 6, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={s.train == null} onChange={e => set('train', e.target.checked ? null : '18:00')} /> Varia
          </label>
        </div>
        <small className="muted tiny">Com horário fixo, o lanche antes vira pré-treino e o depois, pós-treino.</small>
      </div>

      <div className="field">
        <span>Alimentação</span>
        <div className="chips wrap">
          {(
            [
              ['omnivore', 'Como de tudo'],
              ['vegetarian', 'Vegetariana'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" className={`chip ${s.diet === v ? 'on' : ''}`} onClick={() => set('diet', v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Restrições</span>
        <div className="chips wrap">
          {(
            [
              ['noLactose', 'Sem lactose'],
              ['noGluten', 'Sem glúten'],
              ['noFish', 'Sem peixe'],
              ['noPork', 'Sem carne de porco'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={`chip ${s[k] ? 'on' : ''}`} aria-pressed={s[k]} onClick={() => set(k, !s[k])}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>O que você não come?</span>
        <small className="muted tiny">Toque para tirar do plano.</small>
        {DISLIKE_GROUPS.map(([title, keys]) => (
          <div key={title} className="stack" style={{ gap: 6, marginTop: 6 }}>
            <span className="muted tiny">{title}</span>
            <div className="chips wrap">
              {keys.map(k => (
                <button key={k} type="button" className={`chip ${s.dislikes.includes(k) ? 'off' : ''}`} aria-pressed={s.dislikes.includes(k)} onClick={() => toggleDislike(k)}>
                  {short(k)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      <button type="button" className="btn primary big block" onClick={submit} disabled={busy}>
        {busy ? 'Montando…' : 'Montar meu plano'}
      </button>
      {onCancel && (
        <button type="button" className="btn ghost block" onClick={onCancel}>
          Cancelar
        </button>
      )}
    </div>
  )
}

// ---------- Plano ----------

function PlanView(props: {
  plan: ReturnType<typeof buildPlan>
  saved: SavedPlan
  targets: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
  goal: Parameters<typeof guidance>[0]['goal']
  weight: number | null
  fiberGoal: number
  onPick: (slot: string, role: Role, key: FoodKey) => Promise<void>
  onRedo: () => void
}) {
  const { plan, targets, saved } = props
  const [tab, setTab] = useState<'menu' | 'tips' | 'shop'>('menu')
  const t = plan.total
  const lowProtein = t.p < targets.protein_g * 0.9
  const tips = guidance({ goal: props.goal, targets, weightKg: props.weight, waterMl: waterTarget(props.weight), fiberG: props.fiberGoal, settings: saved.settings, meals: plan.meals.length })

  return (
    <>
      <div className="card hero stack" style={{ gap: 8 }}>
        <span className="eyebrow">Seu dia</span>
        <div className="stat">
          <strong>{fmt(t.kcal)} kcal</strong>
        </div>
        <div className="muted small">
          Proteína {fmt(t.p)} g · Carboidrato {fmt(t.c)} g · Gordura {fmt(t.f)} g · Fibra {fmt(t.fiber)} g
        </div>
        <div className="muted tiny">
          Meta: {fmt(targets.kcal)} kcal, P {targets.protein_g} · C {targets.carbs_g} · G {targets.fat_g}. Nos dias de treino, as calorias extras entram como um lanche a mais ou porções maiores.
        </div>
        {lowProtein && (
          <p className="small" style={{ margin: 0, color: 'var(--warn)' }}>
            Com as suas restrições, a proteína ficou abaixo da meta. Um scoop de whey ou proteína de soja num lanche resolve.
          </p>
        )}
        <button type="button" className="btn ghost small" style={{ justifySelf: 'start' }} onClick={props.onRedo}>
          Refazer a consulta
        </button>
      </div>

      <div className="chips" role="tablist">
        {(
          [
            ['menu', 'Cardápio'],
            ['tips', 'Orientações'],
            ['shop', 'Lista de compras'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'menu' && plan.meals.map(m => <PlanMealCard key={m.key} meal={m} settings={saved.settings} onPick={(role, key) => props.onPick(m.key, role, key)} />)}

      {tab === 'tips' && (
        <div className="stack">
          {tips.map(g => (
            <div key={g.title} className="card">
              <h3 style={{ fontSize: '1.05rem' }}>{g.title}</h3>
              <p className="small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                {g.text}
              </p>
            </div>
          ))}
          <p className="muted tiny">Este plano é uma orientação geral calculada pelo app. Ele não substitui a consulta com um nutricionista, principalmente se você tiver alguma condição de saúde.</p>
        </div>
      )}

      {tab === 'shop' && (
        <div className="card">
          <p className="muted small" style={{ marginTop: 0 }}>
            Para 7 dias seguindo o cardápio como está.
          </p>
          <div className="shop-list">
            {shoppingList(plan).map(i => (
              <div key={i.key} className="spread small">
                <span>{i.food.name}</span>
                <strong>{buyAmount(i.food, i.grams)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function PlanMealCard({ meal, settings, onPick }: { meal: PlanMeal; settings: PlanSettings; onPick: (role: Role, key: FoodKey) => Promise<void> }) {
  const [open, setOpen] = useState<Role | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | string>('idle')

  async function log() {
    setState('busy')
    try {
      await logPlanMeal(todayIso(), meal)
      setState('done')
    } catch (err) {
      setState((err as Error).message)
    }
  }

  return (
    <section className="card meal plan-meal">
      <div className="spread">
        <div>
          <span className="eyebrow">{meal.time}</span>
          <h3>{meal.label}</h3>
          <span className="muted tiny">
            {fmt(meal.total.kcal)} kcal · P {fmt(meal.total.p)} · C {fmt(meal.total.c)} · G {fmt(meal.total.f)}
          </span>
        </div>
        <button type="button" className="btn small" onClick={log} disabled={state === 'busy' || state === 'done'}>
          {state === 'done' ? (
            <>
              <Icon.check /> Lançado
            </>
          ) : state === 'busy' ? (
            'Lançando…'
          ) : (
            'Comi isso'
          )}
        </button>
      </div>
      {state !== 'idle' && state !== 'busy' && state !== 'done' && <p className="error small">{state}</p>}
      <div className="meal-items">
        {meal.items.map(i => (
          <PlanItemRow key={i.role} item={i} kind={meal.kind} settings={settings} open={open === i.role} onToggle={() => setOpen(o => (o === i.role ? null : i.role))} onPick={k => onPick(i.role, k).then(() => setOpen(null))} />
        ))}
      </div>
    </section>
  )
}

function PlanItemRow(props: { item: PlanItem; kind: PlanMeal['kind']; settings: PlanSettings; open: boolean; onToggle: () => void; onPick: (k: FoodKey) => Promise<void> }) {
  const { item } = props
  const subs = substitutes(props.kind, item, props.settings, 6)
  const canSwap = subs.length > 0 && optionsFor(props.kind, item.role, props.settings).length > 1
  return (
    <div className="plan-item">
      <button type="button" className="meal-item" onClick={canSwap ? props.onToggle : undefined} aria-expanded={canSwap ? props.open : undefined} disabled={!canSwap}>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: 'block' }}>
            {item.food.name}
          </span>
          <span className="muted tiny">{portion(item.food, item.grams)}</span>
        </span>
        <strong className="small">{fmt(itemMacros(item).kcal)} kcal</strong>
        {canSwap && <span className="muted tiny">{props.open ? 'fechar' : 'trocar'}</span>}
      </button>
      {props.open && (
        <div className="subs">
          <span className="muted tiny">{ROLE_LABEL[item.role]}: troque por uma destas, na mesma quantidade de {item.role === 'protein' ? 'proteína' : item.role === 'fat' ? 'gordura' : 'carboidrato'}</span>
          {subs.map(s => (
            <button key={s.key} type="button" className="sub" onClick={() => props.onPick(s.key)}>
              <span className="grow">{s.food.name}</span>
              <span className="muted small">{portion(s.food, s.grams)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
