import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { Icon, TabPill } from '../components/ui'
import { GroupDot, GroupLegend, Kcal, MacroTiles, Macros } from '../components/FoodRow'
import { askPlanAi, loadFirstName, loadFoods, logPlanMeal, saveMealPlan, todayIso } from '../modules/nutrition/data'
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
import { MORE_FOODS, MORE_OPTIONS, RECIPES } from '../modules/nutrition/planFoodsMore'
import { assessment, CONDITIONS, nextReturn, redFlags, supplementProtocol, type Anamnesis, type Condition, type HabitMeal } from '../modules/nutrition/anamnesis'
import { ageOn, fiberTarget, waterTarget, type NutritionProfile } from '../modules/nutrition/targets'
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
  const [reading, setReading] = useState<'idle' | 'busy' | string>('idle')

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
            const next: SavedPlanWithAi = { ...current, settings, picks: {}, consultedAt: new Date().toISOString() }
            await persist(next)
            setEditing(false)
            // Como no consultório: depois da anamnese, o nutricionista personaliza o cardápio e dá o parecer.
            setReading('busy')
            try {
              const request = 'Consulta inicial: leia a anamnese e personalize o plano.'
              const result = await askPlanAi(request, aiContext(next, buildPlan(targets, next), targets, data.profile.goal))
              await persist(applyAiResult(next, result, request).saved)
              setReading('idle')
            } catch (err) {
              setReading(`O plano está pronto, mas a análise personalizada falhou: ${(err as Error).message}`)
            }
          }}
        />
      )}

      {data && targets && current && plan && !editing && (
        <PlanView
          reading={reading}
          profile={data.profile}
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
  ['Preparações', Object.keys(RECIPES) as FoodKey[]],
]

// Os alimentos extras da TACO, agrupados pelo papel em que entram no plano.
const moreOf = (...roles: Role[]) => [...new Set(Object.values(MORE_OPTIONS).flatMap(g => roles.flatMap(r => g[r] ?? [])))].filter(k => k in MORE_FOODS) as FoodKey[]
const MORE_GROUPS: [string, FoodKey[]][] = [
  ['Mais proteínas', moreOf('protein')],
  ['Mais carboidratos', moreOf('carb')],
  ['Mais feijões, verduras e legumes', moreOf('legume', 'salad', 'veg')],
  ['Mais frutas', moreOf('fruit')],
  ['Mais gorduras', moreOf('fat')],
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

const STEPS = [
  ['Rotina', 'Como é o seu dia, para encaixar as refeições nos seus horários.'],
  ['Treino', 'Com o horário, a duração e o tipo do treino eu ajusto o pré e o pós-treino.'],
  ['O que você come hoje', 'Conte como é um dia normal seu. Eu parto do que você já come para o plano ser fácil de seguir.'],
  ['Preferências', 'O que você gosta, tem em casa, não come ou não pode comer.'],
  ['Saúde', 'Algumas condições mudam o que eu recomendo. Fica só no seu perfil.'],
  ['Suplementos', 'O que você já usa, para entrar no plano com dose e horário.'],
] as const

const HABITS: [HabitMeal, string, string][] = [
  ['breakfast', 'Café da manhã', 'Ex.: café com leite e pão com manteiga'],
  ['lunch', 'Almoço', 'Ex.: arroz, feijão, frango e salada'],
  ['snacks', 'Lanches', 'Ex.: fruta à tarde, bolacha no trabalho'],
  ['dinner', 'Jantar', 'Ex.: o mesmo do almoço ou lanche'],
  ['night', 'Depois do jantar e beliscos', 'Ex.: doce depois do jantar, pipoca vendo série'],
]

function Consultation({ initial, powders, onSave, onCancel }: { initial: PlanSettings; powders: WheyFood[]; onSave: (s: PlanSettings) => Promise<void>; onCancel?: () => void }) {
  const [s, setS] = useState<PlanSettings>(initial)
  const [step, setStep] = useState(0)
  const [moreFoods, setMoreFoods] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof PlanSettings>(k: K, v: PlanSettings[K]) => setS(prev => ({ ...prev, [k]: v }))
  const an = s.anamnesis
  const setA = <K extends keyof Anamnesis>(k: K, v: Anamnesis[K]) => setS(prev => ({ ...prev, anamnesis: { ...prev.anamnesis, [k]: v } }))
  const setTraining = (patch: Partial<Anamnesis['training']>) => setA('training', { ...an.training, ...patch })
  const setSupp = (patch: Partial<Anamnesis['supplements']>) => setA('supplements', { ...an.supplements, ...patch })
  const toggleCondition = (c: Condition) => setA('conditions', an.conditions.includes(c) ? an.conditions.filter(x => x !== c) : [...an.conditions, c])
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
  const flags = redFlags(an)
  const last = step === STEPS.length - 1

  async function next() {
    if (!last) {
      setStep(n => n + 1)
      window.scrollTo({ top: 0 })
      return
    }
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
    <div className="stack form-width consult">
      <div className="onb-top">
        <span className="muted small">
          Consulta · {step + 1} de {STEPS.length}
        </span>
        {onCancel && (
          <button type="button" className="btn ghost small" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
      <div className="onb-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div>
        <h2>{STEPS[step][0]}</h2>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          {STEPS[step][1]}
        </p>
      </div>

      {step === 0 && (
        <>
          <div className="field">
            <span>Trabalho ou estudo</span>
            <Choice
              value={an.work}
              options={[
                ['office', 'Escritório'],
                ['remote', 'Home office'],
                ['physical', 'Trabalho físico'],
                ['shift', 'Turnos ou plantão'],
                ['student', 'Estudante'],
                ['none', 'Não trabalho fora'],
              ]}
              onChange={v => setA('work', v)}
            />
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
            <span>Quantas refeições por dia você consegue fazer?</span>
            <Choice value={s.meals} options={[[3, '3'], [4, '4'], [5, '5'], [6, '6']]} onChange={v => set('meals', v)} />
            <small className="muted tiny">5 costuma funcionar bem para quem treina: fica mais fácil bater a proteína e não passar fome.</small>
          </div>
          <div className="field">
            <span>Onde você almoça?</span>
            <Choice value={s.lunchAt} options={[['home', 'Em casa'], ['lunchbox', 'Marmita'], ['restaurant', 'Restaurante']]} onChange={v => set('lunchAt', v)} />
          </div>
          <div className="field">
            <span>Tempo para cozinhar</span>
            <Choice value={s.cooking} options={[['little', 'Pouco'], ['some', 'Médio'], ['plenty', 'Bastante']]} onChange={v => set('cooking', v)} />
          </div>
          <div className="field">
            <span>Orçamento com comida</span>
            <Choice value={s.budget} options={[['low', 'Apertado'], ['medium', 'Médio'], ['high', 'Folgado']]} onChange={v => set('budget', v)} />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="field">
            <span>Treino às</span>
            <div className="row" style={{ gap: 8 }}>
              <input className="input" type="time" value={s.train ?? ''} disabled={s.train == null} onChange={e => set('train', e.target.value || null)} aria-label="Horário do treino" />
              <label className="row small" style={{ gap: 6, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={s.train == null} onChange={e => set('train', e.target.checked ? null : '18:00')} /> Varia ou não treino
              </label>
            </div>
          </div>
          <div className="field">
            <span>Tipo de treino</span>
            <Choice
              value={an.training.type}
              options={[
                ['strength', 'Musculação'],
                ['mixed', 'Musculação e aeróbico'],
                ['endurance', 'Corrida, bike ou natação'],
                ['sport', 'Esporte ou luta'],
              ]}
              onChange={v => setTraining({ type: v })}
            />
          </div>
          <div className="field">
            <span>Quanto tempo dura</span>
            <Choice value={an.training.minutes} options={[[45, '45 min'], [60, '1 hora'], [90, '1h30'], [120, '2 horas ou mais']]} onChange={v => setTraining({ minutes: v })} />
          </div>
          {s.train && (
            <label className="row small" style={{ gap: 8 }}>
              <input type="checkbox" checked={an.training.fasted} onChange={e => setTraining({ fasted: e.target.checked })} /> Prefiro treinar em jejum
            </label>
          )}
          <small className="muted tiny">
            O pré-treino fica 30 a 60 minutos antes e o pós-treino logo depois do fim. Se você treina logo ao acordar, o café da manhã vira o pós-treino.
          </small>
        </>
      )}

      {step === 2 && (
        <>
          {HABITS.map(([k, label, hint]) => (
            <label key={k} className="field">
              <span>{label}</span>
              <textarea className="input" rows={2} maxLength={300} placeholder={hint} value={an.habits[k]} onChange={e => setA('habits', { ...an.habits, [k]: e.target.value })} />
            </label>
          ))}
          <div className="field">
            <span>Quando bate mais fome?</span>
            <Choice value={an.hungerPeak} options={[['morning', 'De manhã'], ['afternoon', 'À tarde'], ['night', 'À noite'], ['none', 'Sem horário']]} onChange={v => setA('hungerPeak', v)} />
          </div>
          <div className="grid-2">
            <label className="field">
              <span>Água por dia (litros)</span>
              <input className="input" inputMode="decimal" placeholder="Não sei" value={an.waterL == null ? '' : String(an.waterL).replace('.', ',')} onChange={e => { const n = Number(e.target.value.replace(',', '.')); setA('waterL', e.target.value.trim() && Number.isFinite(n) ? Math.min(n, 8) : null) }} />
            </label>
            <div className="field">
              <span>Doces</span>
              <Choice value={an.sweets} options={[['rare', 'Raramente'], ['some', 'Às vezes'], ['daily', 'Todo dia']]} onChange={v => setA('sweets', v)} />
            </div>
          </div>
          <div className="field">
            <span>Bebida alcoólica</span>
            <Choice value={an.alcohol} options={[['never', 'Não bebo'], ['rare', 'Raramente'], ['weekend', 'Fins de semana'], ['often', 'Várias vezes por semana']]} onChange={v => setA('alcohol', v)} />
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="field">
            <span>Alimentação</span>
            <Choice value={s.diet} options={[['omnivore', 'Como de tudo'], ['vegetarian', 'Vegetariana']]} onChange={v => set('diet', v)} />
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
          <label className="field">
            <span>Alergias ou intolerâncias</span>
            <input className="input" maxLength={200} placeholder="Ex.: camarão, amendoim. Deixe vazio se não tiver." value={an.allergies} onChange={e => setA('allergies', e.target.value)} />
          </label>
          <div className="field">
            <span>O que você tem e o que não come</span>
            <small className="muted tiny">
              Toque uma vez: <strong style={{ color: 'var(--accent)' }}>costumo ter</strong> (entra primeiro no plano). Duas vezes: <s>não como</s>. Três vezes: volta ao normal.
            </small>
            {[...FOOD_GROUPS, ...(moreFoods ? MORE_GROUPS : [])].map(([title, keys]) => (
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
            <button type="button" className="btn ghost small" style={{ justifySelf: 'start', marginTop: 4 }} onClick={() => setMoreFoods(m => !m)} aria-expanded={moreFoods}>
              {moreFoods ? 'Mostrar menos alimentos' : `Ver mais ${MORE_GROUPS.reduce((a, [, k]) => a + k.length, 0)} alimentos`}
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div className="field">
            <span>Você tem ou já teve</span>
            <div className="chips wrap">
              {CONDITIONS.map(([c, label]) => (
                <button key={c} type="button" className={`chip ${an.conditions.includes(c) ? 'on' : ''}`} aria-pressed={an.conditions.includes(c)} onClick={() => toggleCondition(c)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Remédios de uso contínuo</span>
            <input className="input" maxLength={200} placeholder="Ex.: levotiroxina 50 mcg, metformina. Deixe vazio se não usar." value={an.medications} onChange={e => setA('medications', e.target.value)} />
          </label>
          <div className="field">
            <span>Intestino</span>
            <Choice value={an.bowel} options={[['regular', 'Funciona bem'], ['constipated', 'Preso'], ['loose', 'Solto']]} onChange={v => setA('bowel', v)} />
          </div>
          <div className="field">
            <span>Sono</span>
            <Choice value={an.sleepQuality} options={[['good', 'Durmo bem'], ['ok', 'Mais ou menos'], ['bad', 'Durmo mal']]} onChange={v => setA('sleepQuality', v)} />
          </div>
          {flags.map(f => (
            <div key={f.title} className="card alert-card">
              <strong>{f.title}</strong>
              <p className="small" style={{ margin: '4px 0 0' }}>
                {f.text}
              </p>
            </div>
          ))}
        </>
      )}

      {step === 5 && (
        <div className="card stack" style={{ gap: 12 }}>
          <div className="field">
            <span>Whey por dia</span>
            <Choice value={s.whey.scoops} options={[[0, 'Não tomo'], [1, '1 scoop'], [2, '2 scoops']]} onChange={v => setWhey({ scoops: v })} />
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
                <select className="input" value={s.whey.food?.id ?? ''} onChange={e => setWhey({ food: powders.find(p => p.id === e.target.value) ?? null })}>
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
          {(
            [
              ['creatine', 'Creatina'],
              ['caffeine', 'Cafeína em cápsula'],
              ['preworkout', 'Pré-treino'],
              ['multivitamin', 'Multivitamínico'],
              ['omega3', 'Ômega-3'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="row small" style={{ gap: 8 }}>
              <input type="checkbox" checked={k === 'creatine' ? s.creatine : an.supplements[k]} onChange={e => (k === 'creatine' ? set('creatine', e.target.checked) : setSupp({ [k]: e.target.checked }))} /> {label}
            </label>
          ))}
          <label className="field">
            <span>Outro suplemento</span>
            <input className="input" maxLength={100} placeholder="Ex.: hipercalórico, vitamina D" value={an.supplements.other} onChange={e => setSupp({ other: e.target.value })} />
          </label>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="row" style={{ gap: 8 }}>
        {step > 0 && (
          <button type="button" className="btn" onClick={() => setStep(n => n - 1)} disabled={busy}>
            Voltar
          </button>
        )}
        <button type="button" className="btn primary big grow" onClick={next} disabled={busy}>
          {last ? (busy ? 'Montando seu plano…' : 'Finalizar consulta') : 'Continuar'}
        </button>
      </div>
    </div>
  )
}

// ---------- Plano ----------

function PlanView(props: {
  reading: string
  profile: NutritionProfile
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
  const [tab, setTab] = useState<'menu' | 'eval' | 'tips' | 'shop'>('menu')
  const an = saved.settings.anamnesis
  const flags = redFlags(an)
  const evaluation = assessment(props.profile, props.weight, targets)
  const back = nextReturn(saved.consultedAt, props.goal)
  const [now] = useState(() => Date.now())
  const due = !!back && back.getTime() <= now
  const supplements = supplementProtocol(an, { weightKg: props.weight, whey: saved.settings.whey, creatine: saved.settings.creatine, train: saved.settings.train, sleep: saved.settings.sleep })
  const t = plan.total
  const lowProtein = t.p < targets.protein_g * 0.9
  const tips = guidance({ goal: props.goal, targets, weightKg: props.weight, waterMl: waterTarget(props.weight), fiberG: props.fiberGoal, settings: saved.settings, meals: plan.meals.length })
  const [pdf, setPdf] = useState<'idle' | 'busy' | string>('idle')

  async function downloadPdf() {
    setPdf('busy')
    try {
      const [{ downloadPlanPdf }, name] = await Promise.all([import('../modules/nutrition/planPdf'), loadFirstName().catch(() => null)])
      await downloadPlanPdf({ name, plan, settings: saved.settings, targets, fiberGoal: props.fiberGoal, tips: [...(saved.ai?.tips ?? []), ...tips], supplements, nextReturn: back })
      setPdf('idle')
    } catch (err) {
      setPdf(`Não deu para gerar o PDF: ${(err as Error).message}`)
    }
  }

  return (
    <>
      <section className="panel plan-head">
        <div className="panel-row stack" style={{ gap: 8 }}>
          <span className="eyebrow">Seu dia</span>
          <div className="spread" style={{ alignItems: 'baseline' }}>
            <div className="stat">
              <strong>{fmt(t.kcal)} kcal</strong>
            </div>
            <span className="muted small">meta {fmt(targets.kcal)} kcal</span>
          </div>
          <MacroTiles
            items={[
              { label: 'Proteína', value: t.p, target: targets.protein_g, color: 'var(--protein)' },
              { label: 'Carboidrato', value: t.c, target: targets.carbs_g, color: 'var(--carbs)' },
              { label: 'Gordura', value: t.f, target: targets.fat_g, color: 'var(--fat)' },
              { label: 'Fibra', value: t.fiber, color: 'var(--accent)' },
            ]}
          />
          <div className="muted tiny">Nos dias de treino, as calorias extras entram como um lanche a mais ou porções maiores.</div>
          {lowProtein && (
            <p className="small" style={{ margin: 0, color: 'var(--warn)' }}>
              Com as suas restrições, a proteína ficou abaixo da meta. Um scoop de whey ou proteína de soja num lanche resolve.
            </p>
          )}
          {back && (
            <div className={`small ${due ? 'return-due' : 'muted'}`}>
              {due ? 'Está na hora do retorno: refaça a consulta com o peso de hoje.' : `Retorno em ${back.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}.`}
            </div>
          )}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn small" onClick={downloadPdf} disabled={pdf === 'busy'}>
              <Download size="1.1em" strokeWidth={1.75} aria-hidden="true" /> {pdf === 'busy' ? 'Gerando PDF…' : 'Baixar PDF'}
            </button>
            <button type="button" className="btn ghost small" onClick={props.onRedo}>
              {due ? 'Fazer o retorno' : 'Refazer a consulta'}
            </button>
          </div>
          {pdf !== 'idle' && pdf !== 'busy' && <p className="error small" style={{ margin: 0 }}>{pdf}</p>}
        </div>

        <AiAdjust plan={plan} saved={saved} targets={targets} goal={props.goal} onApply={props.onAi} onDone={() => setTab('menu')} />
      </section>

      {flags.map(f => (
        <div key={f.title} className="card alert-card">
          <strong>{f.title}</strong>
          <p className="small" style={{ margin: '4px 0 0' }}>
            {f.text}
          </p>
        </div>
      ))}
      {props.reading === 'busy' && <p className="card small reading">Lendo a sua anamnese e personalizando o cardápio…</p>}
      {props.reading !== 'busy' && props.reading !== 'idle' && <p className="error small">{props.reading}</p>}

      <div className="chips tabs" role="tablist">
        {(
          [
            ['menu', 'Cardápio'],
            ['eval', 'Avaliação'],
            ['tips', 'Orientações'],
            ['shop', 'Lista de compras'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {tab === k && <TabPill id="plan-tab" />}
            {label}
          </button>
        ))}
      </div>

      {tab === 'menu' && saved.settings.creatine && (
        <p className="card small" style={{ margin: 0 }}>
          <strong>Creatina:</strong> 3 a 5 g todo dia, junto com qualquer refeição.
        </p>
      )}
      {tab === 'menu' && <GroupLegend />}
      {tab === 'menu' && (
        <div className="grid-list">
          {plan.meals.map(m => <PlanMealCard key={m.key} meal={m} settings={saved.settings} onPick={(role, key) => props.onPick(m.key, role, key)} />)}
        </div>
      )}

      {tab === 'eval' && (
        <div className="stack">
          {saved.ai?.summary && saved.ai.history?.some(h => h.request.startsWith('Consulta inicial')) && (
            <div className="card ai-tip">
              <span className="eyebrow">Parecer</span>
              <p className="small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                {saved.ai.history.find(h => h.request.startsWith('Consulta inicial'))!.summary}
              </p>
            </div>
          )}
          {evaluation ? (
            <div className="card eval-grid">
              <EvalRow label="IMC" value={`${evaluation.bmi.toLocaleString('pt-BR')} kg/m²`} hint={evaluation.bmiClass} />
              <EvalRow label="Metabolismo basal" value={`${fmt(evaluation.bmr)} kcal`} hint="Mifflin-St Jeor" />
              <EvalRow label="Gasto do dia" value={`${fmt(evaluation.tdee)} kcal`} hint="basal × nível de atividade" />
              <EvalRow
                label="Sua meta"
                value={`${fmt(targets.kcal)} kcal`}
                hint={Math.abs(evaluation.balance) < 50 ? 'igual ao gasto' : `${evaluation.balance < 0 ? 'déficit' : 'superávit'} de ${fmt(Math.abs(evaluation.balance))} kcal`}
              />
              <EvalRow label="Proteína" value={`${targets.protein_g} g`} hint={`${evaluation.perKg.protein.toLocaleString('pt-BR')} g/kg · ${evaluation.percent.protein}% das kcal`} />
              <EvalRow label="Carboidrato" value={`${targets.carbs_g} g`} hint={`${evaluation.perKg.carbs.toLocaleString('pt-BR')} g/kg · ${evaluation.percent.carbs}% das kcal`} />
              <EvalRow label="Gordura" value={`${targets.fat_g} g`} hint={`${evaluation.perKg.fat.toLocaleString('pt-BR')} g/kg · ${evaluation.percent.fat}% das kcal`} />
              <EvalRow label="Água" value={`${(waterTarget(props.weight) / 1000).toLocaleString('pt-BR')} L`} hint="35 ml por kg" />
            </div>
          ) : (
            <p className="muted small">Complete peso, altura, nascimento e nível de atividade no Perfil para ver a avaliação.</p>
          )}
          {supplements.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '1.05rem' }}>Suplementos</h3>
              <div className="supp-list">
                {supplements.map(r => (
                  <div key={r.name} className="supp-row">
                    <strong className="small">{r.name}</strong>
                    <span className="small">{r.dose}</span>
                    <span className="muted tiny">{r.when}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="muted tiny">
            Os números saem da equação de Mifflin-St Jeor com o seu nível de atividade e o objetivo. No retorno, o peso dos últimos 15 dias mostra se a meta precisa de ajuste.
          </p>
        </div>
      )}

      {tab === 'tips' && (
        <div className="stack">
          <section className="panel">
            {(saved.ai?.tips ?? []).map(g => (
              <div key={`ai-${g.title}`} className="panel-row ai-tip">
              <span className="eyebrow">Para você</span>
              <h3 style={{ fontSize: '1.05rem', marginTop: 4 }}>{g.title}</h3>
              <p className="small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                {g.text}
              </p>
            </div>
          ))}
            {tips.map(g => (
              <div key={g.title} className="panel-row">
              <h3 style={{ fontSize: '1.05rem' }}>{g.title}</h3>
              <p className="small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                {g.text}
              </p>
            </div>
            ))}
          </section>
          <p className="muted tiny">Este plano é uma orientação geral calculada pelo app. Ele não substitui a consulta com um nutricionista, principalmente se você tiver alguma condição de saúde.</p>
        </div>
      )}

      {tab === 'shop' && (
        <div className="card">
          <p className="muted small" style={{ marginTop: 0 }}>
            Para 7 dias seguindo o cardápio como está.
          </p>
          <ShopList plan={plan} />
        </div>
      )}
    </>
  )
}

const SHOP_GROUPS: { title: string; roles: Role[] }[] = [
  { title: 'Proteínas', roles: ['protein'] },
  { title: 'Carboidratos e leguminosas', roles: ['carb', 'legume'] },
  { title: 'Frutas', roles: ['fruit'] },
  { title: 'Legumes e verduras', roles: ['veg', 'salad'] },
  { title: 'Gorduras', roles: ['fat'] },
]

function ShopList({ plan }: { plan: ReturnType<typeof buildPlan> }) {
  const list = shoppingList(plan)
  return (
    <div className="stack" style={{ gap: 16 }}>
      {SHOP_GROUPS.map(g => {
        const items = list.filter(i => g.roles.includes(i.role))
        if (!items.length) return null
        return (
          <div key={g.title}>
            <span className="eyebrow">{g.title}</span>
            <div className="food-list" style={{ marginTop: 4 }}>
              {items.map(i => (
                <div key={i.key} className="food-row">
                  <GroupDot role={i.role} />
                  <span className="food-main">
                    <span className="food-name">{i.food.name}</span>
                  </span>
                  <span className="food-kcal">
                    <b>{buyAmount(i.food, i.grams)}</b>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EvalRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="eval-row">
      <span className="label">{label}</span>
      <strong>{value}</strong>
      <span className="muted tiny">{hint}</span>
    </div>
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
      <div className="meal-sub">
        <span className="meal-head-kcal">
          <b>{fmt(meal.total.kcal)}</b> kcal
        </span>
        <Macros p={meal.total.p} c={meal.total.c} f={meal.total.f} />
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
        <GroupDot role={item.role} />
        <span className="food-main">
          <span className="food-name">{item.food.name}</span>
          <span className="food-detail">{portion(item.food, item.grams)}</span>
        </span>
        <Kcal value={itemMacros(item).kcal} />
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
  const [open, setOpen] = useState(false)

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
    <section className="panel-row stack ai-card" style={{ gap: 10 }} aria-label="Ajustar com IA">
      <div className="spread" style={{ alignItems: 'start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">Ajustar com IA</span>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {open
              ? 'Conte sua realidade: onde mora, o que encontra, rotina, gostos. A IA troca alimentos e escreve dicas; as quantidades continuam calculadas pelo app.'
              : 'Peça uma troca ou conte algo da sua rotina.'}
          </p>
        </div>
        <button type="button" className="btn ghost small" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          {open ? 'Fechar' : 'Ajustar'}
        </button>
      </div>
      {open && (
        <>
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
        </>
      )}
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
