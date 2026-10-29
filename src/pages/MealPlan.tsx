import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui'
import { askPlanAi, loadFoods, logPlanMeal, saveMealPlan, todayIso } from '../modules/nutrition/data'
import { aiContext, applyAiResult, type SavedPlanWithAi } from '../modules/nutrition/planAi'
import {
  buildPlan,
  buyAmount,
  DEFAULT_SETTINGS,
  withDefaults,
  type WheyFood,
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
} from '../modules/nutrition/plan'
import { loadPlanContext } from '../modules/nutrition/planContext'
import { ageOn, fiberTarget, waterTarget } from '../modules/nutrition/targets'
import { useAsync } from '../lib/useAsync'
import { useDataChanged } from '../lib/events'

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
  useDataChanged(ctx.reload)
  // Proteínas em pó que a pessoa cadastrou (pelo rótulo ou código de barras) para usar como o whey do plano.
  const powders = useAsync(async () => (await loadFoods()).filter(f => f.source === 'custom' && /whey|prote[ií]na|isolad|albumina/i.test(f.name)))
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState<SavedPlanWithAi | null>(null)

  const data = ctx.data
  const raw = (saved ?? data?.saved ?? null) as SavedPlanWithAi | null
  const current = raw ? { ...raw, settings: withDefaults(raw.settings) } : null
  const targets = data?.targets ?? null
  const plan = targets && current ? buildPlan(targets, current) : null

  async function persist(next: SavedPlanWithAi) {
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
          initial={withDefaults(current?.settings ?? DEFAULT_SETTINGS)}
          powders={(powders.data ?? []).map(f => ({ id: f.id, name: f.name, kcal: f.kcal, p: f.protein_g, c: f.carbs_g, f: f.fat_g }))}
          onCancel={current ? () => setEditing(false) : undefined}
          onSave={async settings => {
            await persist({ ...current, settings, picks: {} })
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
          onAi={persist}
        />
      )}
    </main>
  )
}

// ---------- Consulta ----------

const FOOD_GROUPS: [string, FoodKey[]][] = [
  ['Proteínas', ['frango', 'coxa', 'patinho', 'carneMoida', 'maminha', 'peru', 'lombo', 'merluza', 'sardinha', 'atum', 'ovo', 'tofu', 'iogurte', 'ricota', 'minas', 'prato', 'presunto', 'soja']],
  ['Carboidratos', ['arroz', 'integral', 'batataDoce', 'mandioca', 'batata', 'macarrao', 'polenta', 'milho', 'paoFrances', 'paoIntegral', 'aveia', 'cuscuz']],
  ['Feijões, verduras e legumes', ['feijao', 'feijaoPreto', 'lentilha', 'ervilha', 'alface', 'repolho', 'brocolis', 'cenoura', 'abobrinha', 'couveFlor', 'abobora', 'beterraba', 'chuchu']],
  ['Frutas', ['banana', 'maca', 'mamao', 'laranja', 'mexerica', 'morango', 'manga', 'goiaba', 'melancia', 'abacaxi', 'uva']],
  ['Gorduras boas', ['castanha', 'caju', 'amendoim', 'abacate', 'linhaca']],
]

function Choice<T extends string | number>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="chips wrap">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" className={`chip ${value === v ? 'on' : ''}`} aria-pressed={value === v} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

const short = (k: FoodKey) => PLAN_FOODS[k].name.replace(/ (grelhad[oa]|cozid[oa]|assad[oa])$/, '')

function Consultation({ initial, powders, onSave, onCancel }: { initial: PlanSettings; powders: WheyFood[]; onSave: (s: PlanSettings) => Promise<void>; onCancel?: () => void }) {
  const [s, setS] = useState<PlanSettings>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof PlanSettings>(k: K, v: PlanSettings[K]) => setS(prev => ({ ...prev, [k]: v }))
  // Cada toque: neutro → tenho em casa → não como → neutro.
  const cycle = (k: FoodKey) =>
    setS(prev =>
      prev.likes.includes(k)
        ? { ...prev, likes: prev.likes.filter(x => x !== k), dislikes: [...prev.dislikes, k] }
        : prev.dislikes.includes(k)
          ? { ...prev, dislikes: prev.dislikes.filter(x => x !== k) }
          : { ...prev, likes: [...prev.likes, k] },
    )
  const setWhey = (patch: Partial<PlanSettings['whey']>) => setS(prev => ({ ...prev, whey: { ...prev.whey, ...patch } }))

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
        <span>Suplementos</span>
        <div className="card stack" style={{ gap: 12 }}>
          <div className="field">
            <span>Whey por dia</span>
            <Choice
              value={s.whey.scoops}
              options={[
                [0, 'Não tomo'],
                [1, '1 scoop'],
                [2, '2 scoops'],
              ]}
              onChange={v => setWhey({ scoops: v })}
            />
          </div>
          {s.whey.scoops > 0 && (
            <>
              <div className="grid-2">
                <label className="field">
                  <span>Scoop (g)</span>
                  <input className="input" inputMode="numeric" value={String(s.whey.scoopG)} onChange={e => setWhey({ scoopG: Math.min(80, Math.max(10, Number(e.target.value.replace(/\D/g, '')) || 30)) })} />
                </label>
                <div className="field">
                  <span>Quando</span>
                  <select className="input" value={s.whey.when} onChange={e => setWhey({ when: e.target.value as PlanSettings['whey']['when'] })}>
                    <option value="post">Depois do treino</option>
                    <option value="breakfast">No café da manhã</option>
                    <option value="snack">Num lanche</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <span>Qual whey</span>
                <select
                  className="input"
                  value={s.whey.food?.id ?? ''}
                  onChange={e => setWhey({ food: powders.find(p => p.id === e.target.value) ?? null })}
                >
                  <option value="">Whey concentrado comum (24 g de proteína a cada 30 g)</option>
                  {powders.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <small className="muted tiny">Cadastre o seu pelo código de barras ou pelo rótulo em Nutrição e ele aparece aqui com os valores certos.</small>
              </div>
            </>
          )}
          <label className="row small" style={{ gap: 8 }}>
            <input type="checkbox" checked={s.creatine} onChange={e => set('creatine', e.target.checked)} /> Tomo creatina
          </label>
        </div>
      </div>

      <div className="field">
        <span>Onde você almoça?</span>
        <Choice
          value={s.lunchAt}
          options={[
            ['home', 'Em casa'],
            ['lunchbox', 'Marmita'],
            ['restaurant', 'Restaurante'],
          ]}
          onChange={v => set('lunchAt', v)}
        />
      </div>

      <div className="field">
        <span>Tempo para cozinhar</span>
        <Choice
          value={s.cooking}
          options={[
            ['little', 'Pouco'],
            ['some', 'Médio'],
            ['plenty', 'Bastante'],
          ]}
          onChange={v => set('cooking', v)}
        />
      </div>

      <div className="field">
        <span>Orçamento com comida</span>
        <Choice
          value={s.budget}
          options={[
            ['low', 'Apertado'],
            ['medium', 'Médio'],
            ['high', 'Folgado'],
          ]}
          onChange={v => set('budget', v)}
        />
      </div>

      <div className="field">
        <span>O que você tem e o que não come</span>
        <small className="muted tiny">
          Toque uma vez: <strong style={{ color: 'var(--accent)' }}>costumo ter</strong> (entra primeiro no plano). Duas vezes: <s>não como</s>. Três vezes: volta ao normal.
        </small>
        {FOOD_GROUPS.map(([title, keys]) => (
          <div key={title} className="stack" style={{ gap: 6, marginTop: 6 }}>
            <span className="muted tiny">{title}</span>
            <div className="chips wrap">
              {keys.map(k => {
                const state = s.likes.includes(k) ? 'on' : s.dislikes.includes(k) ? 'off' : ''
                return (
                  <button key={k} type="button" className={`chip ${state}`} aria-label={`${short(k)}${state === 'on' ? ', costumo ter' : state === 'off' ? ', não como' : ''}`} onClick={() => cycle(k)}>
                    {short(k)}
                  </button>
                )
              })}
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
  saved: SavedPlanWithAi
  targets: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
  goal: Parameters<typeof guidance>[0]['goal']
  weight: number | null
  fiberGoal: number
  onPick: (slot: string, role: Role, key: FoodKey) => Promise<void>
  onRedo: () => void
  onAi: (next: SavedPlanWithAi) => Promise<void>
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

      <AiAdjust plan={plan} saved={saved} targets={targets} goal={props.goal} onApply={props.onAi} onDone={() => setTab('menu')} />

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

      {tab === 'menu' && saved.settings.creatine && (
        <p className="card small" style={{ margin: 0 }}>
          <strong>Creatina:</strong> 3 a 5 g todo dia, junto com qualquer refeição.
        </p>
      )}
      {tab === 'menu' && plan.meals.map(m => <PlanMealCard key={m.key} meal={m} settings={saved.settings} onPick={(role, key) => props.onPick(m.key, role, key)} />)}

      {tab === 'tips' && (
        <div className="stack">
          {(saved.ai?.tips ?? []).map(g => (
            <div key={`ai-${g.title}`} className="card ai-tip">
              <span className="eyebrow">Para você</span>
              <h3 style={{ fontSize: '1.05rem', marginTop: 4 }}>{g.title}</h3>
              <p className="small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                {g.text}
              </p>
            </div>
          ))}
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
  const [open, setOpen] = useState<FoodKey | null>(null)
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
      {meal.note && <p className="muted tiny" style={{ margin: '8px 0 0' }}>{meal.note}</p>}
      {state !== 'idle' && state !== 'busy' && state !== 'done' && <p className="error small">{state}</p>}
      <div className="meal-items">
        {meal.items.map(i => (
          <PlanItemRow key={`${i.role}-${i.key}`} item={i} kind={meal.kind} settings={settings} open={open === i.key} onToggle={() => setOpen(o => (o === i.key ? null : i.key))} onPick={k => onPick(i.role, k).then(() => setOpen(null))} />
        ))}
      </div>
    </section>
  )
}

function PlanItemRow(props: { item: PlanItem; kind: PlanMeal['kind']; settings: PlanSettings; open: boolean; onToggle: () => void; onPick: (k: FoodKey) => Promise<void> }) {
  const { item } = props
  const subs = substitutes(props.kind, item, props.settings, 6)
  // O whey vem da consulta: muda-se lá, não aqui.
  const canSwap = item.key !== 'whey' && subs.length > 0 && optionsFor(props.kind, item.role, props.settings).length > 1
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

const EXAMPLES = [
  'Moro no interior e aqui é difícil achar peixe e frutas vermelhas.',
  'Almoço no restaurante por quilo de segunda a sexta.',
  'Troca o jantar por algo mais rápido de fazer.',
  'Tomo 2 scoops de whey, um de manhã e um depois do treino.',
]

function AiAdjust(props: { plan: ReturnType<typeof buildPlan>; saved: SavedPlanWithAi; targets: Parameters<typeof aiContext>[2]; goal: Parameters<typeof aiContext>[3]; onApply: (next: SavedPlanWithAi) => Promise<void>; onDone: () => void }) {
  const [request, setRequest] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const last = props.saved.ai?.history?.[0]

  async function submit() {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const result = await askPlanAi(request, aiContext(props.saved, props.plan, props.targets, props.goal))
      const { saved, discarded } = applyAiResult(props.saved, result, request)
      await props.onApply(saved)
      setDone(saved.ai!.summary + (discarded ? ` (${discarded} sugestão${discarded > 1 ? 'ões' : ''} fora das opções do app ${discarded > 1 ? 'foram ignoradas' : 'foi ignorada'}.)` : ''))
      setRequest('')
      props.onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack ai-card" style={{ gap: 10 }} aria-label="Ajustar com IA">
      <div>
        <span className="eyebrow">Ajustar com IA</span>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          Conte sua realidade: onde mora, o que encontra, rotina, gostos. A IA troca alimentos e escreve dicas; as quantidades continuam calculadas pelo app.
        </p>
      </div>
      <textarea
        className="input"
        rows={3}
        maxLength={1000}
        placeholder={EXAMPLES[0]}
        value={request}
        onChange={e => setRequest(e.target.value)}
        aria-label="O que você quer ajustar no plano"
      />
      {!request && (
        <div className="chips wrap">
          {EXAMPLES.slice(1).map(x => (
            <button key={x} type="button" className="chip small-chip" onClick={() => setRequest(x)}>
              {x}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn primary" onClick={submit} disabled={busy || request.trim().length < 5}>
        {busy ? 'Pensando…' : 'Ajustar meu plano'}
      </button>
      {error && <p className="error small" style={{ margin: 0 }}>{error}</p>}
      {(done ?? last?.summary) && (
        <p className="small" style={{ margin: 0 }}>
          <strong>{done ? 'Feito: ' : 'Último ajuste: '}</strong>
          {done ?? last!.summary}
        </p>
      )}
    </section>
  )
}
