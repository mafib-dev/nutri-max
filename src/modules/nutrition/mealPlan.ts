// Plano alimentar: monta o cardápio do dia com alimentos da TACO para bater as metas,
// em medidas caseiras, com trocas equivalentes, orientações e lista de compras.
// Tudo aqui é cálculo puro; a tela grava o resultado em meal_plans.
import { macrosFor, microsFor, sumMacros, type Food, type Macros, type Meal } from './foods'
import { describeGrams, measureText, portionsOf, type Portion } from './portions'
import { GOALS, type Goal, type Targets } from './targets'

export type SlotKind = 'breakfast' | 'snack' | 'main' | 'pre_workout' | 'post_workout' | 'supper'

export interface PlanSlot {
  kind: SlotKind
  label: string
  /** "HH:MM" */
  time: string
}

export interface PlanSettings {
  slots: PlanSlot[]
  /** Horário do treino ("HH:MM") ou null para quem não treina. Planos antigos; os novos usam training_times. */
  training_time: string | null
  /** Horários dos treinos do dia (musculação, corrida…), quando há mais de um. */
  training_times?: string[]
  /** Calorias a mais (ou a menos) neste tipo de dia, somadas à meta antes de montar o cardápio. */
  extra_kcal?: number
  /** Alimentos que a pessoa não come: ficam fora do cardápio e das trocas. */
  excluded: string[]
  /** Muda a escolha dos alimentos para gerar outro cardápio com as mesmas regras. */
  seed: number
}

export type Role =
  | 'fruit'
  | 'protein_breakfast'
  | 'protein_snack'
  | 'protein_pre'
  | 'carb_breakfast'
  | 'carb_quick'
  | 'fat_snack'
  | 'leaves'
  | 'cooked_veg'
  | 'beans'
  | 'protein_main'
  | 'carb_main'
  | 'oil'

export interface PlanSub {
  food_id: string
  name: string
  grams: number
  measure: string | null
}

export interface PlanItem extends Macros {
  food_id: string
  name: string
  role: Role
  grams: number
  measure: string | null
  fiber_g: number | null
  sodium_mg: number | null
  subs: PlanSub[]
}

export interface PlanMeal {
  kind: SlotKind
  label: string
  time: string
  items: PlanItem[]
  total: Macros
}

export interface ShoppingItem {
  food_id: string
  name: string
  amount: string
  /** Ex.: "≈ 1,8 kg cozido" quando a compra é do alimento cru. */
  note: string | null
}

export interface ShoppingGroup {
  title: string
  items: ShoppingItem[]
}

export interface Guidance {
  title: string
  text: string
}

export interface PlanTargets extends Targets {
  fiber_g: number
  water_ml: number
}

export interface MealPlan {
  generated_at: string
  goal: Goal
  weight_kg: number
  targets: PlanTargets
  meals: PlanMeal[]
  total: Macros & { fiber_g: number }
  guidance: Guidance[]
  shopping: ShoppingGroup[]
}

interface Candidate {
  id: string
  label: string
  /** Teto em gramas por refeição, para alimentos que não fazem sentido em grande quantidade (queijo, presunto). */
  max?: number
}

type Key = 'protein_g' | 'carbs_g' | 'fat_g' | 'kcal' | 'grams'

interface RoleDef {
  /** Macro que as trocas mantêm igual (ou o mesmo peso, para verduras e legumes). */
  key: Key
  group: 'Proteínas' | 'Carboidratos e leguminosas' | 'Frutas' | 'Legumes e verduras' | 'Gorduras'
  min: number
  max: number
  /** Quantos dos primeiros candidatos entram no rodízio do cardápio; os outros só como troca. */
  pool: number
  candidates: Candidate[]
}

const c = (id: number, label: string, max?: number): Candidate => ({ id: `taco-${id}`, label, ...(max ? { max } : {}) })

/** Alimentos que o plano usa, por papel na refeição, do mais comum para o menos. */
export const ROLES: Record<Role, RoleDef> = {
  fruit: {
    key: 'kcal',
    group: 'Frutas',
    min: 80,
    max: 300,
    pool: 6,
    candidates: [
      c(226, 'Mamão papaia'),
      c(182, 'Banana prata'),
      c(222, 'Maçã fuji'),
      c(214, 'Laranja pera'),
      c(238, 'Mexerica'),
      c(239, 'Morango'),
      c(235, 'Melancia'),
      c(231, 'Manga'),
      c(256, 'Uva itália'),
      c(164, 'Abacaxi'),
      c(207, 'Kiwi'),
      c(200, 'Goiaba vermelha'),
    ],
  },
  protein_breakfast: {
    key: 'protein_g',
    group: 'Proteínas',
    min: 30,
    max: 300,
    pool: 3,
    candidates: [c(488, 'Ovo cozido'), c(461, 'Queijo minas frescal', 90), c(469, 'Ricota', 120), c(439, 'Presunto magro', 60), c(449, 'Iogurte natural desnatado')],
  },
  protein_snack: {
    key: 'protein_g',
    group: 'Proteínas',
    min: 30,
    max: 500,
    pool: 3,
    candidates: [c(449, 'Iogurte natural desnatado'), c(488, 'Ovo cozido'), c(469, 'Ricota', 120), c(461, 'Queijo minas frescal', 90), c(439, 'Presunto magro', 60), c(448, 'Iogurte natural')],
  },
  // Antes do treino: proteína magra, para não pesar.
  protein_pre: {
    key: 'protein_g',
    group: 'Proteínas',
    min: 30,
    max: 400,
    pool: 2,
    candidates: [c(449, 'Iogurte natural desnatado'), c(439, 'Presunto magro', 60), c(469, 'Ricota', 120), c(488, 'Ovo cozido')],
  },
  carb_breakfast: {
    key: 'carbs_g',
    group: 'Carboidratos e leguminosas',
    min: 20,
    max: 250,
    pool: 3,
    candidates: [c(53, 'Pão francês'), c(52, 'Pão integral de forma'), c(533, 'Cuscuz de milho'), c(7, 'Aveia em flocos')],
  },
  carb_quick: {
    key: 'carbs_g',
    group: 'Carboidratos e leguminosas',
    min: 20,
    max: 300,
    pool: 2,
    candidates: [c(53, 'Pão francês'), c(182, 'Banana prata'), c(88, 'Batata-doce cozida'), c(7, 'Aveia em flocos'), c(52, 'Pão integral de forma')],
  },
  fat_snack: {
    key: 'fat_g',
    group: 'Gorduras',
    min: 5,
    max: 40,
    pool: 3,
    candidates: [c(557, 'Amendoim'), c(589, 'Castanha-do-pará'), c(588, 'Castanha de caju'), c(163, 'Abacate'), c(594, 'Linhaça'), c(597, 'Nozes')],
  },
  leaves: {
    key: 'grams',
    group: 'Legumes e verduras',
    min: 50,
    max: 200,
    pool: 3,
    candidates: [c(78, 'Salada de folhas (alface)'), c(149, 'Salada de repolho'), c(157, 'Salada de tomate'), c(152, 'Salada de rúcula'), c(75, 'Salada de agrião'), c(142, 'Salada de pepino')],
  },
  cooked_veg: {
    key: 'grams',
    group: 'Legumes e verduras',
    min: 40,
    max: 200,
    pool: 4,
    candidates: [
      c(100, 'Brócolis cozido'),
      c(109, 'Cenoura cozida'),
      c(70, 'Abobrinha cozida'),
      c(118, 'Couve-flor cozida'),
      c(112, 'Chuchu cozido'),
      c(97, 'Beterraba cozida'),
      c(64, 'Abóbora cabotiá cozida'),
      c(95, 'Berinjela cozida'),
    ],
  },
  beans: {
    key: 'carbs_g',
    group: 'Carboidratos e leguminosas',
    min: 40,
    max: 200,
    pool: 2,
    candidates: [c(561, 'Feijão carioca cozido'), c(567, 'Feijão preto cozido'), c(577, 'Lentilha cozida'), c(560, 'Ervilha em conserva'), c(563, 'Feijão fradinho cozido')],
  },
  protein_main: {
    key: 'protein_g',
    group: 'Proteínas',
    min: 60,
    max: 300,
    pool: 4,
    candidates: [
      c(410, 'Peito de frango grelhado'),
      c(377, 'Patinho grelhado'),
      c(301, 'Filé de merluza assado'),
      c(326, 'Carne moída (acém) cozida'),
      c(368, 'Maminha grelhada'),
      c(432, 'Lombo de porco assado'),
      c(398, 'Coxa de frango cozida'),
      c(317, 'Salmão grelhado'),
      c(346, 'Contra-filé grelhado'),
      c(293, 'Corvina assada'),
      c(488, 'Ovo cozido'),
      c(584, 'Tofu'),
    ],
  },
  carb_main: {
    key: 'carbs_g',
    group: 'Carboidratos e leguminosas',
    min: 50,
    max: 400,
    pool: 2,
    candidates: [
      c(3, 'Arroz branco cozido'),
      c(1, 'Arroz integral cozido'),
      c(88, 'Batata-doce cozida'),
      c(129, 'Mandioca cozida'),
      c(91, 'Batata inglesa cozida'),
      c(86, 'Mandioquinha cozida'),
      c(102, 'Cará cozido'),
    ],
  },
  oil: { key: 'fat_g', group: 'Gorduras', min: 3, max: 15, pool: 1, candidates: [c(260, 'Azeite de oliva')] },
}

const SHOPPING_ORDER: RoleDef['group'][] = ['Proteínas', 'Carboidratos e leguminosas', 'Frutas', 'Legumes e verduras', 'Gorduras']

/** Alimento cozido → o mesmo cru, para a lista de compras dizer quanto comprar. */
const RAW_OF: Record<string, string> = {
  'taco-3': 'taco-4',
  'taco-1': 'taco-2',
  'taco-561': 'taco-562',
  'taco-567': 'taco-568',
  'taco-577': 'taco-578',
  'taco-563': 'taco-564',
  'taco-410': 'taco-409',
  'taco-377': 'taco-376',
  'taco-301': 'taco-302',
  'taco-326': 'taco-327',
  'taco-368': 'taco-367',
  'taco-432': 'taco-433',
  'taco-398': 'taco-399',
  'taco-317': 'taco-316',
  'taco-346': 'taco-345',
}

type Step = { role: Role } & ({ grams: number } | { solve: 'protein_g' | 'carbs_g' | 'fat_g' })

/** O que vai em cada tipo de refeição: quantidades fixas e o que é calculado para bater a meta. */
const TEMPLATES: Record<SlotKind, Step[]> = {
  breakfast: [{ role: 'fruit', grams: 140 }, { role: 'protein_breakfast', solve: 'protein_g' }, { role: 'carb_breakfast', solve: 'carbs_g' }],
  snack: [{ role: 'protein_snack', solve: 'protein_g' }, { role: 'fruit', grams: 140 }, { role: 'fat_snack', solve: 'fat_g' }],
  main: [
    { role: 'leaves', grams: 100 },
    { role: 'cooked_veg', grams: 80 },
    { role: 'beans', grams: 90 },
    { role: 'protein_main', solve: 'protein_g' },
    { role: 'carb_main', solve: 'carbs_g' },
    { role: 'oil', solve: 'fat_g' },
  ],
  pre_workout: [{ role: 'protein_pre', solve: 'protein_g' }, { role: 'carb_quick', solve: 'carbs_g' }],
  post_workout: [{ role: 'protein_snack', solve: 'protein_g' }, { role: 'carb_quick', solve: 'carbs_g' }],
  supper: [{ role: 'protein_snack', solve: 'protein_g' }, { role: 'fruit', grams: 140 }],
}

/** Peso de cada refeição nas calorias, na proteína e na gordura do dia. */
const SHARE: Record<SlotKind, { kcal: number; protein: number; fat: number }> = {
  breakfast: { kcal: 1, protein: 1, fat: 1.2 },
  snack: { kcal: 0.7, protein: 0.8, fat: 1 },
  main: { kcal: 1.4, protein: 1.3, fat: 1 },
  // Pouca gordura antes do treino para não pesar.
  pre_workout: { kcal: 0.55, protein: 0.6, fat: 0.2 },
  // Depois do treino: proteína e carboidrato, pouca gordura.
  post_workout: { kcal: 0.7, protein: 1.1, fat: 0.2 },
  supper: { kcal: 0.5, protein: 0.8, fat: 0.6 },
}

export const KIND_LABEL: Record<SlotKind, string> = {
  breakfast: 'Café da manhã',
  snack: 'Lanche',
  main: 'Refeição principal',
  pre_workout: 'Pré-treino',
  post_workout: 'Pós-treino',
  supper: 'Ceia',
}

/** Rotina sugerida para cada número de refeições. */
export const MEAL_PRESETS: Record<number, PlanSlot[]> = {
  3: [
    { kind: 'breakfast', label: 'Café da manhã', time: '07:30' },
    { kind: 'main', label: 'Almoço', time: '12:30' },
    { kind: 'main', label: 'Jantar', time: '20:00' },
  ],
  4: [
    { kind: 'breakfast', label: 'Café da manhã', time: '07:30' },
    { kind: 'main', label: 'Almoço', time: '12:30' },
    { kind: 'snack', label: 'Lanche da tarde', time: '16:00' },
    { kind: 'main', label: 'Jantar', time: '20:00' },
  ],
  5: [
    { kind: 'breakfast', label: 'Café da manhã', time: '07:30' },
    { kind: 'snack', label: 'Lanche da manhã', time: '10:00' },
    { kind: 'main', label: 'Almoço', time: '12:30' },
    { kind: 'snack', label: 'Lanche da tarde', time: '16:00' },
    { kind: 'main', label: 'Jantar', time: '20:00' },
  ],
  6: [
    { kind: 'breakfast', label: 'Café da manhã', time: '07:30' },
    { kind: 'snack', label: 'Lanche da manhã', time: '10:00' },
    { kind: 'main', label: 'Almoço', time: '12:30' },
    { kind: 'snack', label: 'Lanche da tarde', time: '16:00' },
    { kind: 'main', label: 'Jantar', time: '20:00' },
    { kind: 'supper', label: 'Ceia', time: '22:00' },
  ],
}

export const DEFAULT_SETTINGS: PlanSettings = { slots: MEAL_PRESETS[5], training_time: null, excluded: [], seed: 0 }

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Horários de treino do dia, de planos novos (vários) ou antigos (um só). */
export function trainingTimes(settings: Pick<PlanSettings, 'training_time' | 'training_times'>): string[] {
  const times = settings.training_times ?? (settings.training_time ? [settings.training_time] : [])
  return [...new Set(times.filter(t => /^\d{2}:\d{2}$/.test(t)))].sort((a, b) => minutes(a) - minutes(b))
}

/** Duração presumida de cada treino, para saber quando ele termina. */
const SESSION_MIN = 60

/**
 * Põe as refeições em ordem e, para cada treino do dia:
 * - transforma o último lanche antes dele (até 4 horas antes) em pré-treino, uma hora antes;
 * - se não houver refeição entre 30 min e 2h30 depois do início, põe um pós-treino
 *   (ou transforma o lanche que estiver nessa janela).
 */
export function arrangeSlots(slots: PlanSlot[], training: string | null | string[]): PlanSlot[] {
  let sorted = [...slots].sort((a, b) => minutes(a.time) - minutes(b.time)).map(s => ({ ...s }))
  const times = Array.isArray(training) ? trainingTimes({ training_time: null, training_times: training }) : training ? [training] : []
  for (const time of times) {
    const t = minutes(time)
    let idx = -1
    sorted.forEach((s, i) => {
      if ((s.kind === 'snack' || s.kind === 'pre_workout') && minutes(s.time) < t && t - minutes(s.time) <= 240) idx = i
    })
    if (idx >= 0) {
      const before = idx > 0 ? minutes(sorted[idx - 1].time) : 0
      sorted[idx] = { kind: 'pre_workout', label: 'Pré-treino', time: hhmm(Math.max(minutes(sorted[idx].time), t - 60, before + 30)) }
    }
    const after = sorted.filter(s => minutes(s.time) >= t + 30 && minutes(s.time) <= t + 150)
    if (after.some(s => s.kind !== 'snack')) continue
    const snack = after.find(s => s.kind === 'snack')
    if (snack) Object.assign(snack, { kind: 'post_workout', label: 'Pós-treino' })
    else sorted = [...sorted, { kind: 'post_workout' as const, label: 'Pós-treino', time: hhmm(Math.min(t + SESSION_MIN + 15, 23 * 60 + 30)) }]
    sorted.sort((a, b) => minutes(a.time) - minutes(b.time))
  }
  return sorted
}

/** Em que refeição do diário cai cada refeição do plano. */
export function diaryMeal(slot: Pick<PlanSlot, 'kind' | 'time'>): Meal {
  if (slot.kind === 'breakfast') return 'breakfast'
  if (slot.kind === 'main') return minutes(slot.time) < 16 * 60 ? 'lunch' : 'dinner'
  return 'snack'
}

const per100 = (food: Food, key: Key) => (key === 'grams' ? 100 : Number(food[key]))

/** Papéis com quantidade fixa, que ficam na medida caseira redonda (1 concha, 1 metade). */
const BY_MEASURE: Role[] = ['fruit', 'leaves', 'cooked_veg', 'beans']

/**
 * Arredonda para a medida caseira: inteiros para o que se conta, meias medidas para frutas,
 * verduras e feijão, senão de 5 em 5 g (1 g no azeite).
 */
export function roundToPortion(food: Food, grams: number, role?: Role): number {
  const portions = portionsOf(food)
  const whole = portions.find(p => p.whole)
  if (whole) return Math.max(1, Math.round(grams / whole.g)) * whole.g
  if (role && BY_MEASURE.includes(role) && portions[0]) return Math.max(0.5, Math.round((grams / portions[0].g) * 2) / 2) * portions[0].g
  if (role === 'oil' || grams < 20) return Math.max(1, Math.round(grams))
  const step = grams < 150 ? 5 : 10
  return Math.max(step, Math.round(grams / step) * step)
}

/** Texto da medida: a unidade para o que se conta; senão a medida caseira mais próxima. */
export function measureFor(food: Food, grams: number): string | null {
  const portions = portionsOf(food)
  const whole = portions.find(p => p.whole)
  if (whole && Math.abs(grams / whole.g - Math.round(grams / whole.g)) < 0.01) return measureText(whole, Math.round(grams / whole.g))
  return describeGrams(portions.filter((p: Portion) => !p.whole), grams)
}

function makeItem(food: Food, label: string, role: Role, grams: number, subs: PlanSub[]): PlanItem {
  const g = Math.round(grams * 10) / 10
  return { food_id: food.id, name: label, role, grams: g, measure: measureFor(food, g), ...macrosFor(food, g), ...microsFor(food, g), subs }
}

/** Quanto de outro alimento do mesmo grupo equivale à porção (mesma proteína, mesmo carboidrato…). */
export function equivalentGrams(from: Food, grams: number, to: Food, role: Role): number {
  const key = ROLES[role].key
  const a = per100(from, key)
  const b = per100(to, key)
  if (!(a > 0) || !(b > 0)) return roundToPortion(to, grams, role)
  return roundToPortion(to, (grams * a) / b, role)
}

function available(role: Role, byId: Map<string, Food>, excluded: Set<string>) {
  return ROLES[role].candidates.filter(x => byId.has(x.id) && !excluded.has(x.id))
}

function subsFor(role: Role, chosen: Food, grams: number, byId: Map<string, Food>, excluded: Set<string>, n = 3): PlanSub[] {
  if (role === 'oil') return []
  return available(role, byId, excluded)
    .filter(x => x.id !== chosen.id)
    .slice(0, n)
    .map(x => {
      const food = byId.get(x.id)!
      const g = equivalentGrams(chosen, grams, food, role)
      return { food_id: food.id, name: x.label, grams: g, measure: measureFor(food, g) }
    })
}

/** Lista de compras para alguns dias, somando o cardápio e convertendo o que é comprado cru. */
export function shoppingList(meals: PlanMeal[], foods: Food[], days = 7): ShoppingGroup[] {
  const byId = new Map(foods.map(f => [f.id, f]))
  const totals = new Map<string, { name: string; grams: number; role: Role }>()
  for (const m of meals)
    for (const i of m.items) {
      const t = totals.get(i.food_id) ?? { name: i.name, grams: 0, role: i.role }
      t.grams += i.grams * days
      totals.set(i.food_id, t)
    }
  const groups = new Map<string, ShoppingItem[]>()
  for (const [id, t] of totals) {
    const food = byId.get(id)
    const raw = RAW_OF[id] ? byId.get(RAW_OF[id]) : undefined
    let amount: string
    let note: string | null = null
    const whole = food ? portionsOf(food).find(p => p.whole) : undefined
    if (whole) {
      amount = measureText(whole, Math.ceil(t.grams / whole.g - 0.01))
    } else if (food && raw && raw.kcal > 0 && food.kcal > 0) {
      amount = `${formatWeight((t.grams * food.kcal) / raw.kcal)} cru`
      const done = t.name.match(/(cozid|grelhad|assad)[oa]$/)?.[0] ?? 'pronto'
      note = `≈ ${formatWeight(t.grams)} ${done}`
    } else {
      amount = formatWeight(t.grams)
    }
    const group = ROLES[t.role].group
    groups.set(group, [...(groups.get(group) ?? []), { food_id: id, name: t.name, amount, note }])
  }
  return SHOPPING_ORDER.filter(g => groups.has(g)).map(title => ({ title, items: groups.get(title)! }))
}

/** "650 g", "1,8 kg": de 10 em 10 g até 100 g, de 50 em 50 até 1 kg, e kg com uma casa. */
export function formatWeight(grams: number): string {
  const step = grams < 100 ? 10 : 50
  const g = Math.max(step, Math.round(grams / step) * step)
  return g >= 1000 ? `${(Math.round(grams / 100) / 10).toLocaleString('pt-BR')} kg` : `${g} g`
}

function mealTotal(items: PlanItem[]): Macros {
  return sumMacros(items)
}

function planTotal(meals: PlanMeal[]) {
  const items = meals.flatMap(m => m.items)
  return { ...sumMacros(items), fiber_g: Math.round(items.reduce((a, i) => a + (i.fiber_g ?? 0), 0)) }
}

export interface PlanInput {
  targets: Targets
  weightKg: number
  goal: Goal
  fiberTarget: number
  waterMl: number
  settings: PlanSettings
  foods: Food[]
  now?: Date
}

/** Monta o cardápio do dia. */
export function generatePlan(input: PlanInput): MealPlan {
  const { targets, settings } = input
  const byId = new Map(input.foods.map(f => [f.id, f]))
  const excluded = new Set(settings.excluded)
  const slots = arrangeSlots(settings.slots, trainingTimes(settings))

  // Metas de cada refeição, pelo peso de cada tipo.
  const sum = (k: keyof (typeof SHARE)['main']) => slots.reduce((a, s) => a + SHARE[s.kind][k], 0)
  const [sk, sp, sf] = [sum('kcal'), sum('protein'), sum('fat')]
  const goals = slots.map(s => {
    const kcal = (targets.kcal * SHARE[s.kind].kcal) / sk
    const protein_g = (targets.protein_g * SHARE[s.kind].protein) / sp
    const fat_g = (targets.fat_g * SHARE[s.kind].fat) / sf
    return { kcal, protein_g, fat_g, carbs_g: Math.max(0, (kcal - protein_g * 4 - fat_g * 9) / 4) }
  })
  const carbSum = goals.reduce((a, g) => a + g.carbs_g, 0)
  if (carbSum > 0) for (const g of goals) g.carbs_g *= targets.carbs_g / carbSum

  // Rodízio: cada uso de um papel pega o próximo alimento, para almoço e jantar não repetirem.
  const used = new Map<Role, number>()
  const pick = (role: Role): { food: Food; label: string; cap: number } | null => {
    const list = available(role, byId, excluded)
    if (!list.length) return null
    const pool = list.slice(0, Math.min(ROLES[role].pool, list.length))
    const n = used.get(role) ?? 0
    used.set(role, n + 1)
    const roleIdx = Object.keys(ROLES).indexOf(role)
    const x = pool[(settings.seed * 7 + roleIdx * 3 + n) % pool.length]
    return { food: byId.get(x.id)!, label: x.label, cap: Math.min(x.max ?? Infinity, ROLES[role].max) }
  }

  const volume = Math.min(1.8, Math.max(0.8, targets.kcal / 2200))

  type Work = { role: Role; food: Food; label: string; cap: number; grams: number; solve: 'protein_g' | 'carbs_g' | 'fat_g' | null }
  const work: Work[][] = slots.map((slot, si) => {
    const rows: Work[] = []
    for (const step of TEMPLATES[slot.kind]) {
      const chosen = pick(step.role)
      if (!chosen) continue
      // Fruta e feijão crescem com as calorias do dia: quem come 3.500 kcal não come só 1 concha.
      const grams = 'grams' in step ? step.grams * (step.role === 'fruit' || step.role === 'beans' ? volume : 1) : ROLES[step.role].min
      rows.push({ role: step.role, ...chosen, grams: 'grams' in step ? roundToPortion(chosen.food, grams, step.role) : grams, solve: 'solve' in step ? step.solve : null })
    }
    // Ajusta as quantidades calculadas, uma de cada vez, até estabilizar.
    const goal = goals[si]
    for (let it = 0; it < 12; it++) {
      for (const r of rows) {
        if (!r.solve) continue
        const density = Number(r.food[r.solve]) / 100
        if (!(density > 0)) continue
        const others = rows.reduce((a, o) => (o === r ? a : a + (Number(o.food[r.solve!]) * o.grams) / 100), 0)
        r.grams = Math.min(r.cap, Math.max(0, (goal[r.solve] - others) / density))
      }
    }
    // A gordura que os outros alimentos já trazem pode dispensar o azeite ou a castanha.
    return rows
      .filter(r => !(r.solve === 'fat_g' && r.grams < ROLES[r.role].min * 0.6))
      .map(r => ({ ...r, grams: r.solve ? roundToPortion(r.food, Math.max(r.grams, ROLES[r.role].min), r.role) : r.grams }))
  })

  // Acerto do dia: primeiro a proteína nas carnes, depois as calorias nos carboidratos.
  const dayTotal = () => {
    let t = { kcal: 0, protein_g: 0 }
    for (const rows of work) for (const r of rows) t = { kcal: t.kcal + (r.food.kcal * r.grams) / 100, protein_g: t.protein_g + (r.food.protein_g * r.grams) / 100 }
    return t
  }
  const scale = (roles: Role[], key: 'kcal' | 'protein_g', target: number) => {
    // O que se conta inteiro (ovo, pão) só entra no acerto quando é fruta: 1 banana a mais é um ajuste razoável.
    const rows = work.flat().filter(r => roles.includes(r.role) && (r.role === 'fruit' || !portionsOf(r.food).some(p => p.whole)))
    const part = rows.reduce((a, r) => a + (Number(r.food[key]) * r.grams) / 100, 0)
    const diff = target - dayTotal()[key]
    if (part <= 0 || Math.abs(diff) < target * 0.02) return
    const k = Math.min(1.6, Math.max(0.6, (part + diff) / part))
    for (const r of rows) r.grams = roundToPortion(r.food, Math.min(r.cap, Math.max(ROLES[r.role].min, r.grams * k)), r.role)
  }
  for (let round = 0; round < 3; round++) {
    scale(['protein_main', 'protein_snack', 'protein_breakfast', 'protein_pre'], 'protein_g', targets.protein_g)
    scale(['carb_main', 'carb_breakfast', 'carb_quick'], 'kcal', targets.kcal)
    // Se os carboidratos já chegaram no limite, o resto sai (ou entra) pela gordura e pelas frutas.
    scale(['oil', 'fat_snack'], 'kcal', targets.kcal)
    scale(['fruit'], 'kcal', targets.kcal)
  }

  const meals: PlanMeal[] = slots.map((slot, si) => {
    const items = work[si].map(r => makeItem(r.food, r.label, r.role, r.grams, subsFor(r.role, r.food, r.grams, byId, excluded)))
    return { ...slot, items, total: mealTotal(items) }
  })

  const planTargets: PlanTargets = { ...targets, fiber_g: input.fiberTarget, water_ml: input.waterMl }
  return {
    generated_at: (input.now ?? new Date()).toISOString(),
    goal: input.goal,
    weight_kg: input.weightKg,
    targets: planTargets,
    meals,
    total: planTotal(meals),
    guidance: planGuidance({ targets: planTargets, weightKg: input.weightKg, goal: input.goal, meals, trainingTimes: trainingTimes(settings) }),
    shopping: shoppingList(meals, input.foods),
  }
}

/** Troca um alimento do cardápio por uma das opções equivalentes e refaz os totais. */
export function swapItem(plan: MealPlan, mealIdx: number, itemIdx: number, subId: string, foods: Food[], excluded: string[] = []): MealPlan {
  const byId = new Map(foods.map(f => [f.id, f]))
  const meal = plan.meals[mealIdx]
  const item = meal?.items[itemIdx]
  const sub = item?.subs.find(s => s.food_id === subId)
  const food = byId.get(subId)
  const old = item && byId.get(item.food_id)
  if (!item || !sub || !food || !old) return plan
  const ex = new Set(excluded)
  const next = makeItem(food, sub.name, item.role, sub.grams, [])
  // As trocas do novo alimento incluem o antigo de volta.
  next.subs = [
    { food_id: old.id, name: item.name, grams: equivalentGrams(food, next.grams, old, item.role), measure: null },
    ...subsFor(item.role, food, next.grams, byId, ex).filter(s => s.food_id !== old.id),
  ]
    .slice(0, 3)
    .map(s => ({ ...s, measure: measureFor(byId.get(s.food_id)!, s.grams) }))
  const items = meal.items.map((it, i) => (i === itemIdx ? next : it))
  const meals = plan.meals.map((m, i) => (i === mealIdx ? { ...m, items, total: mealTotal(items) } : m))
  return { ...plan, meals, total: planTotal(meals), shopping: shoppingList(meals, foods) }
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')
const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** Orientações do plano, escritas a partir das metas e do cardápio. */
export function planGuidance(ctx: { targets: PlanTargets; weightKg: number; goal: Goal; meals: PlanMeal[]; trainingTimes: string[] }): Guidance[] {
  const { targets: t, goal, meals } = ctx
  const out: Guidance[] = []
  const perKg = t.protein_g / ctx.weightKg
  out.push({
    title: 'Proteína espalhada no dia',
    text: `São ${fmt(t.protein_g)} g por dia (${fmt1(perKg)} g por kg), cerca de ${fmt(t.protein_g / meals.length)} g em cada refeição. Dividir assim ajuda mais o músculo do que concentrar tudo no almoço e no jantar.`,
  })

  const pre = meals.find(m => m.kind === 'pre_workout')
  const times = ctx.trainingTimes
  if (times.length > 1) {
    out.push({
      title: 'Dois treinos no dia',
      text: `Com treinos às ${times.join(' e às ')}, cada um tem a sua refeição antes e depois: carboidrato fácil e pouca gordura antes, proteína (20 a 40 g) e carboidrato depois. São os dias de maior gasto, então não pule refeições e beba mais água. Se os dois forem puxados, deixe pelo menos 6 horas entre eles.`,
    })
  } else if (times.length === 1) {
    const time = times[0]
    out.push({
      title: 'Comida em volta do treino',
      text: `Treinando às ${time}, ${pre ? `coma o pré-treino (${pre.time}) 30 a 60 minutos antes` : 'faça uma refeição leve 1 a 2 horas antes'}: carboidrato fácil de digerir e um pouco de proteína, com pouca gordura e pouca fibra para não pesar. Depois, faça uma refeição com proteína (20 a 40 g) e carboidrato em até 2 horas.`,
    })
  } else {
    out.push({
      title: 'Nos dias de treino',
      text: 'Coma algo leve com carboidrato e um pouco de proteína 1 a 2 horas antes de treinar, e uma refeição com proteína (20 a 40 g) e carboidrato em até 2 horas depois.',
    })
  }

  if (meals.some(m => m.kind === 'main')) {
    out.push({
      title: 'Monte o prato do almoço e do jantar',
      text: 'Metade do prato com salada e legumes, um quarto com a proteína e um quarto com arroz, batata ou mandioca, mais o feijão. Pese as porções na primeira semana até acostumar o olho.',
    })
  }

  out.push({
    title: 'Água e fibra',
    text: `Beba ${fmt1(t.water_ml / 1000)} L de água por dia, um pouco mais nos dias de treino e de calor. A meta de fibra é ${fmt(t.fiber_g)} g: salada no almoço e no jantar, feijão e 2 a 3 frutas por dia já resolvem.`,
  })

  if (goal === 'lose') {
    out.push({
      title: 'Para perder gordura sem perder músculo',
      text: 'Mantenha a proteína mesmo nos dias de fome, evite calorias líquidas (refrigerante, suco, álcool) e deixe frutas e legumes à mão para os beliscos. Uma refeição livre por semana cabe no plano, sem exagero.',
    })
  } else if (goal === 'gain') {
    out.push({
      title: 'Para ganhar massa',
      text: 'Não pule refeições: a sobra de calorias precisa aparecer todo dia. Se faltar apetite, aumente o arroz, a batata e o azeite antes de cortar a salada, e prefira lanches fáceis como pão, banana e amendoim. Treine pesado: sem estímulo, a sobra vira gordura.',
    })
  } else {
    out.push({
      title: 'Para manter o peso',
      text: 'Siga o cardápio na maior parte dos dias e use as trocas para variar. Se a média do peso subir ou cair mais de 1 kg em um mês, ajuste as porções de arroz, batata ou azeite.',
    })
  }

  out.push({
    title: 'Pesagem e ajuste',
    text:
      goal === 'maintain'
        ? 'Pese-se 2 a 3 vezes por semana, de manhã, em jejum e depois do banheiro. O app mostra a média de 7 dias, que vale mais que o número de um dia.'
        : `Pese-se 2 a 3 vezes por semana, de manhã, em jejum e depois do banheiro. O app recalcula as metas com o seu peso. Se em 2 a 3 semanas a média de 7 dias não andar no ritmo escolhido, ajuste a meta em 100 a 150 kcal.`,
  })

  out.push({
    title: 'Suplementos',
    text: `Whey não é obrigatório: é só praticidade para bater a proteína${GOALS[goal].proteinPerKg >= 1.8 ? ', que no seu objetivo é mais alta' : ''}. Se quiser usar, cadastre o seu em Nutrição e ele entra no lugar de outra proteína. Creatina (3 a 5 g por dia) tem boa evidência para força e massa, se quiser incluir. Converse com um profissional de saúde antes de começar algo novo.`,
  })

  out.push({
    title: 'Sono e sal',
    text: 'Durma de 7 a 9 horas: sono curto aumenta a fome e atrapalha a recuperação. Tempere com ervas, alho e limão e evite temperos prontos, que são cheios de sódio.',
  })
  return out
}

/** Todos os alimentos que o plano pode usar, para a pessoa marcar o que não come. */
export function planFoodChoices(): { group: string; foods: Candidate[] }[] {
  const seen = new Set<string>()
  const groups = new Map<string, Candidate[]>()
  for (const def of Object.values(ROLES)) {
    for (const x of def.candidates) {
      if (seen.has(x.id) || def === ROLES.oil) continue
      seen.add(x.id)
      groups.set(def.group, [...(groups.get(def.group) ?? []), x])
    }
  }
  return SHOPPING_ORDER.filter(g => groups.has(g)).map(group => ({ group, foods: groups.get(group)! }))
}

/** As metas mudaram o bastante desde que o plano foi gerado para valer gerar outro. */
export function targetsChanged(plan: MealPlan, current: Targets | null): boolean {
  if (!current) return false
  const t = plan.targets
  return Math.abs(t.kcal - current.kcal) > 100 || Math.abs(t.protein_g - current.protein_g) > 15
}
