// Plano alimentar: o que um nutricionista entrega depois da consulta. Divide as metas do dia
// entre as refeições (mais carboidrato perto do treino, proteína espalhada), monta cada
// refeição com alimentos da TACO e acha as gramas que fecham os macros, com substituições
// equivalentes, lista de compras e orientações.
import type { Meal } from './foods'
import type { Goal, Targets } from './targets'

// ---------- Alimentos do plano ----------

export type Role = 'protein' | 'carb' | 'legume' | 'veg' | 'salad' | 'fruit' | 'fat'
type Tag = 'meat' | 'fish' | 'pork' | 'egg' | 'lactose' | 'gluten'

export interface PlanFood {
  /** id na tabela foods (TACO). */
  id: string
  name: string
  /** Por 100 g, copiados da TACO. */
  kcal: number
  p: number
  c: number
  f: number
  fiber: number
  tags: Tag[]
  /** Medida caseira: nome no singular e no plural e gramas de uma unidade. */
  unit: [string, string, number]
  /** Conta em unidades inteiras (ovo, pão) em vez de gramas. */
  whole?: boolean
  /** Teto por refeição (ninguém come 5 bananas de uma vez). */
  max?: number
}

const food = (id: string, name: string, kcal: number, p: number, c: number, f: number, fiber: number, tags: Tag[], unit: [string, string, number], whole = false, max?: number): PlanFood => ({
  id,
  name,
  kcal,
  p,
  c,
  f,
  fiber,
  tags,
  unit,
  whole,
  max,
})

export const PLAN_FOODS = {
  // Proteínas do almoço e do jantar
  frango: food('taco-410', 'Peito de frango grelhado', 159, 32, 0, 2.5, 0, ['meat'], ['filé médio', 'filés médios', 100]),
  patinho: food('taco-377', 'Patinho grelhado', 219, 35.9, 0, 7.3, 0, ['meat'], ['bife médio', 'bifes médios', 100]),
  maminha: food('taco-368', 'Maminha grelhada', 153, 30.7, 0, 2.4, 0, ['meat'], ['fatia média', 'fatias médias', 100]),
  peru: food('taco-425', 'Peru assado', 163, 26.2, 0, 5.7, 0, ['meat'], ['fatia grossa', 'fatias grossas', 50]),
  lombo: food('taco-432', 'Lombo de porco assado', 210, 35.7, 0, 6.4, 0, ['meat', 'pork'], ['fatia média', 'fatias médias', 80]),
  merluza: food('taco-301', 'Filé de merluza assado', 122, 26.6, 0, 0.9, 0, ['fish'], ['filé médio', 'filés médios', 120]),
  sardinha: food('taco-318', 'Sardinha assada', 164, 32.2, 0, 3, 0, ['fish'], ['sardinha', 'sardinhas', 40]),
  ovo: food('taco-488', 'Ovo cozido', 146, 13.3, 0.6, 9.5, 0, ['egg'], ['ovo', 'ovos', 50], true, 200),
  tofu: food('taco-584', 'Tofu', 64, 6.6, 2.1, 4, 0.8, [], ['fatia', 'fatias', 50]),
  // Proteínas do café e dos lanches
  iogurte: food('taco-449', 'Iogurte natural desnatado', 41, 3.8, 5.8, 0.3, 0, ['lactose'], ['pote', 'potes', 170]),
  ricota: food('taco-469', 'Ricota', 140, 12.6, 3.8, 8.1, 0, ['lactose'], ['fatia', 'fatias', 30]),
  minas: food('taco-461', 'Queijo minas frescal', 264, 17.4, 3.2, 20.2, 0, ['lactose'], ['fatia', 'fatias', 30]),
  presunto: food('taco-439', 'Presunto magro', 94, 14.3, 2.1, 2.7, 0, ['meat', 'pork'], ['fatia', 'fatias', 15]),
  soja: food('taco-582', 'Bebida de soja', 39, 2.4, 4.3, 1.6, 0.4, [], ['copo', 'copos', 200]),
  // Carboidratos
  arroz: food('taco-3', 'Arroz branco cozido', 128, 2.5, 28.1, 0.2, 1.6, [], ['col. de sopa', 'col. de sopa', 25]),
  integral: food('taco-1', 'Arroz integral cozido', 124, 2.6, 25.8, 1, 2.7, [], ['col. de sopa', 'col. de sopa', 25]),
  batataDoce: food('taco-88', 'Batata-doce cozida', 77, 0.6, 18.4, 0.1, 2.2, [], ['pedaço médio', 'pedaços médios', 80]),
  mandioca: food('taco-129', 'Mandioca cozida', 125, 0.6, 30.1, 0.3, 1.6, [], ['pedaço médio', 'pedaços médios', 60]),
  batata: food('taco-91', 'Batata inglesa cozida', 52, 1.2, 11.9, 0, 1.3, [], ['batata média', 'batatas médias', 120]),
  paoFrances: food('taco-53', 'Pão francês', 300, 8, 58.6, 3.1, 2.3, ['gluten'], ['pão', 'pães', 50], true),
  paoIntegral: food('taco-52', 'Pão integral de forma', 253, 9.4, 49.9, 3.7, 6.9, ['gluten'], ['fatia', 'fatias', 25], true),
  aveia: food('taco-7', 'Aveia em flocos', 394, 13.9, 66.6, 8.5, 9.1, ['gluten'], ['col. de sopa', 'col. de sopa', 15]),
  cuscuz: food('taco-533', 'Cuscuz de milho', 113, 2.2, 25.3, 0.7, 2.1, [], ['fatia média', 'fatias médias', 100]),
  // Leguminosas, verduras e legumes
  feijao: food('taco-561', 'Feijão carioca cozido', 76, 4.8, 13.6, 0.5, 8.5, [], ['concha', 'conchas', 80]),
  feijaoPreto: food('taco-567', 'Feijão preto cozido', 77, 4.5, 14, 0.5, 8.4, [], ['concha', 'conchas', 80]),
  lentilha: food('taco-577', 'Lentilha cozida', 93, 6.3, 16.3, 0.5, 7.9, [], ['concha', 'conchas', 80]),
  alface: food('taco-78', 'Salada de folhas (alface)', 11, 1.3, 1.7, 0.2, 1.8, [], ['prato de sobremesa', 'pratos de sobremesa', 100]),
  brocolis: food('taco-100', 'Brócolis cozido', 25, 2.1, 4.4, 0.5, 3.4, [], ['col. de servir', 'col. de servir', 40]),
  cenoura: food('taco-109', 'Cenoura cozida', 30, 0.8, 6.7, 0.2, 2.6, [], ['col. de servir', 'col. de servir', 40]),
  abobrinha: food('taco-70', 'Abobrinha cozida', 15, 1.1, 3, 0.2, 1.6, [], ['col. de servir', 'col. de servir', 40]),
  couveFlor: food('taco-118', 'Couve-flor cozida', 19, 1.2, 3.9, 0.3, 2.1, [], ['col. de servir', 'col. de servir', 40]),
  // Frutas
  banana: food('taco-182', 'Banana prata', 98, 1.3, 26, 0.1, 2, [], ['banana', 'bananas', 70], true, 250),
  maca: food('taco-222', 'Maçã fuji', 56, 0.3, 15.2, 0, 1.3, [], ['maçã', 'maçãs', 130], true, 250),
  mamao: food('taco-226', 'Mamão papaia', 40, 0.5, 10.4, 0.1, 1, [], ['metade', 'metades', 150], false, 250),
  laranja: food('taco-214', 'Laranja pera', 37, 1, 8.9, 0.1, 0.8, [], ['laranja', 'laranjas', 140], true, 250),
  morango: food('taco-239', 'Morango', 30, 0.9, 6.8, 0.3, 1.7, [], ['morango', 'morangos', 12], false, 250),
  manga: food('taco-231', 'Manga', 51, 0.9, 12.8, 0.2, 2.1, [], ['fatia', 'fatias', 80], false, 250),
  // Gorduras boas
  azeite: food('taco-260', 'Azeite de oliva', 884, 0, 0, 100, 0, [], ['col. de sobremesa', 'col. de sobremesa', 5]),
  castanha: food('taco-589', 'Castanha-do-pará', 643, 14.5, 15.1, 63.5, 7.9, [], ['unidade', 'unidades', 4], true),
  amendoim: food('taco-557', 'Amendoim', 544, 27.2, 20.3, 43.9, 8, [], ['col. de sopa', 'col. de sopa', 15]),
  abacate: food('taco-163', 'Abacate', 96, 1.2, 6, 8.4, 6.3, [], ['col. de sopa', 'col. de sopa', 30]),
} satisfies Record<string, PlanFood>

export type FoodKey = keyof typeof PLAN_FOODS
const F = PLAN_FOODS

// ---------- Consulta ----------

export type Diet = 'omnivore' | 'vegetarian'

export interface PlanSettings {
  meals: 3 | 4 | 5 | 6
  /** "HH:MM" */
  wake: string
  sleep: string
  /** Horário do treino; nulo = não treina ou varia. */
  train: string | null
  diet: Diet
  noLactose: boolean
  noGluten: boolean
  noFish: boolean
  noPork: boolean
  /** Alimentos que a pessoa não come. */
  dislikes: FoodKey[]
}

export const DEFAULT_SETTINGS: PlanSettings = {
  meals: 5,
  wake: '07:00',
  sleep: '23:00',
  train: '18:00',
  diet: 'omnivore',
  noLactose: false,
  noGluten: false,
  noFish: false,
  noPork: false,
  dislikes: [],
}

/** O que fica salvo no perfil: a consulta e as trocas que a pessoa escolheu. */
export interface SavedPlan {
  settings: PlanSettings
  /** slot → papel → alimento escolhido no lugar do sugerido. */
  picks: Record<string, Partial<Record<Role, FoodKey>>>
}

function allowed(key: FoodKey, s: PlanSettings) {
  const f = F[key]
  if (s.dislikes.includes(key)) return false
  if (s.diet === 'vegetarian' && (f.tags.includes('meat') || f.tags.includes('fish'))) return false
  if (s.noLactose && f.tags.includes('lactose')) return false
  if (s.noGluten && f.tags.includes('gluten')) return false
  if (s.noFish && f.tags.includes('fish')) return false
  if (s.noPork && f.tags.includes('pork')) return false
  return true
}

// ---------- Refeições ----------

export type SlotKind = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'pre_workout' | 'post_workout' | 'dinner' | 'supper'

const KIND: Record<SlotKind, { label: string; log: Meal }> = {
  breakfast: { label: 'Café da manhã', log: 'breakfast' },
  morning_snack: { label: 'Lanche da manhã', log: 'snack' },
  lunch: { label: 'Almoço', log: 'lunch' },
  afternoon_snack: { label: 'Lanche da tarde', log: 'snack' },
  pre_workout: { label: 'Pré-treino', log: 'snack' },
  post_workout: { label: 'Pós-treino', log: 'snack' },
  dinner: { label: 'Jantar', log: 'dinner' },
  supper: { label: 'Ceia', log: 'dinner' },
}

/** Opções de cada papel em cada tipo de refeição, na ordem de preferência. */
const OPTIONS: Record<'main' | 'morning' | 'snack' | 'pre' | 'supper', Partial<Record<Role, FoodKey[]>>> = {
  main: {
    protein: ['frango', 'patinho', 'merluza', 'maminha', 'peru', 'lombo', 'sardinha', 'ovo', 'tofu'],
    carb: ['arroz', 'integral', 'batataDoce', 'mandioca', 'batata'],
    legume: ['feijao', 'feijaoPreto', 'lentilha'],
    salad: ['alface'],
    veg: ['brocolis', 'cenoura', 'abobrinha', 'couveFlor'],
    fat: ['azeite'],
  },
  morning: {
    carb: ['paoFrances', 'paoIntegral', 'cuscuz', 'aveia', 'batataDoce'],
    protein: ['ovo', 'minas', 'ricota', 'presunto', 'iogurte', 'tofu'],
    fruit: ['mamao', 'banana', 'morango', 'maca', 'laranja', 'manga'],
  },
  snack: {
    protein: ['ovo', 'iogurte', 'ricota', 'minas', 'soja', 'tofu'],
    fruit: ['banana', 'maca', 'mamao', 'laranja', 'manga', 'morango'],
    carb: ['aveia', 'paoIntegral', 'cuscuz'],
    fat: ['castanha', 'amendoim', 'abacate'],
  },
  pre: {
    carb: ['banana', 'paoFrances', 'batataDoce', 'aveia', 'cuscuz', 'maca'],
    protein: ['ovo', 'iogurte', 'presunto', 'ricota', 'soja', 'tofu'],
  },
  supper: {
    protein: ['iogurte', 'ovo', 'ricota', 'soja', 'tofu'],
    fat: ['castanha', 'amendoim', 'abacate'],
  },
}

const GROUP: Record<SlotKind, keyof typeof OPTIONS> = {
  breakfast: 'morning',
  morning_snack: 'snack',
  lunch: 'main',
  afternoon_snack: 'snack',
  pre_workout: 'pre',
  post_workout: 'pre',
  dinner: 'main',
  supper: 'supper',
}

/** Peso de cada refeição na divisão de cada macro do dia. */
const SHARE: Record<SlotKind, { p: number; c: number; f: number }> = {
  breakfast: { p: 0.9, c: 1, f: 1 },
  morning_snack: { p: 0.6, c: 0.5, f: 0.8 },
  lunch: { p: 1.2, c: 1.3, f: 1.1 },
  afternoon_snack: { p: 0.6, c: 0.6, f: 0.8 },
  pre_workout: { p: 0.5, c: 1, f: 0.2 },
  post_workout: { p: 1, c: 1, f: 0.3 },
  dinner: { p: 1.2, c: 1, f: 1.1 },
  supper: { p: 0.7, c: 0.15, f: 0.8 },
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
export const toHHMM = (min: number) => {
  const m = ((Math.round(min / 15) * 15) % 1440 + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export interface Slot {
  key: string
  kind: SlotKind
  label: string
  time: string
  log: Meal
}

/**
 * Quais refeições e em que horário. Café 30 min depois de acordar, jantar umas 3 h antes
 * de dormir, almoço perto do meio-dia e os lanches no meio. Com horário de treino, o lanche
 * mais perto antes dele vira pré-treino (1 h antes) e a refeição seguinte, pós-treino.
 */
export function buildSlots(s: PlanSettings): Slot[] {
  let wake = toMin(s.wake)
  let sleep = toMin(s.sleep)
  if (sleep <= wake) sleep += 1440
  const breakfast = wake + 30
  const dinner = Math.max(sleep - 180, breakfast + 9 * 60)
  const lunch = Math.min(Math.max(12.5 * 60, breakfast + 4 * 60), dinner - 5 * 60)
  const kinds: [SlotKind, number][] = [
    ['breakfast', breakfast],
    ['lunch', lunch],
    ['dinner', dinner],
  ]
  if (s.meals >= 4) kinds.push(['afternoon_snack', (lunch + dinner) / 2])
  if (s.meals >= 5) kinds.push(['morning_snack', (breakfast + lunch) / 2])
  if (s.meals >= 6) kinds.push(['supper', Math.min(sleep - 45, dinner + 150)])
  kinds.sort((a, b) => a[1] - b[1])

  if (s.train) {
    let train = toMin(s.train)
    if (train < wake) train += 1440
    const isSnack = (k: SlotKind) => k === 'morning_snack' || k === 'afternoon_snack' || k === 'supper'
    // Pré-treino: o lanche que vem antes do treino e mais perto dele; sem lanche, nada muda.
    const before = kinds.filter(([k, t]) => isSnack(k) && t <= train).at(-1)
    if (before && train - before[1] <= 4 * 60) {
      before[0] = 'pre_workout'
      before[1] = Math.max(before[1], train - 60)
    }
    // Pós-treino: um lanche logo depois vira pós-treino; se a próxima for almoço ou jantar, ela já cumpre o papel.
    const after = kinds.find(([, t]) => t > train)
    if (after && isSnack(after[0]) && after[1] - train <= 3 * 60) {
      after[0] = 'post_workout'
      after[1] = Math.min(after[1], train + 90)
    }
    kinds.sort((a, b) => a[1] - b[1])
  }

  return kinds.map(([kind, t], i) => ({ key: `${i}-${kind}`, kind, label: KIND[kind].label, time: toHHMM(t), log: KIND[kind].log }))
}

// ---------- Montagem e gramas ----------

export interface PlanItem {
  role: Role
  key: FoodKey
  food: PlanFood
  grams: number
}

export interface PlanMeal extends Slot {
  items: PlanItem[]
  target: { p: number; c: number; f: number }
  total: { kcal: number; p: number; c: number; f: number; fiber: number }
}

export interface MealPlan {
  meals: PlanMeal[]
  total: { kcal: number; p: number; c: number; f: number; fiber: number }
}

const LIMITS: Record<Role, [number, number]> = {
  protein: [30, 250],
  carb: [15, 450],
  legume: [80, 200],
  veg: [80, 80],
  salad: [100, 100],
  fruit: [80, 250],
  fat: [3, 40],
}

/** Gramas arredondadas: unidades inteiras para ovo e pão, senão de 5 em 5 (de 1 em 1 para azeite). */
export function roundGrams(f: PlanFood, grams: number, role: Role) {
  const [min, roleMax] = LIMITS[role]
  const max = Math.min(roleMax, f.max ?? roleMax)
  if (f.whole) return Math.min(Math.max(1, Math.round(grams / f.unit[2])), Math.max(1, Math.floor(max / f.unit[2]))) * f.unit[2]
  const step = role === 'fat' && f.kcal > 800 ? 1 : 5
  return Math.min(max, Math.max(min, Math.round(grams / step) * step))
}

/** Resolve A·x = b (até 3×3) por eliminação de Gauss; null se não tiver solução única. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    if (Math.abs(M[piv][col]) < 1e-9) return null
    ;[M[col], M[piv]] = [M[piv], M[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const k = M[r][col] / M[col][col]
      for (let c = col; c <= n; c++) M[r][c] -= k * M[col][c]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

const MACROS = ['p', 'c', 'f'] as const

/**
 * Acha as gramas que fecham proteína, carboidrato e gordura da refeição. Itens fixos (salada,
 * legumes, feijão, fruta do café) entram primeiro; os ajustáveis resolvem o resto, cada um
 * mirando o macro em que é forte. O que sair do limite fica no limite e o resto é recalculado.
 */
function fitGrams(fixed: PlanItem[], free: PlanItem[], target: { p: number; c: number; f: number }): PlanItem[] {
  const fixedSum = (m: (typeof MACROS)[number]) => fixed.reduce((a, i) => a + (i.food[m] * i.grams) / 100, 0)
  const goal = { p: target.p - fixedSum('p'), c: target.c - fixedSum('c'), f: target.f - fixedSum('f') }
  const main = (i: PlanItem): (typeof MACROS)[number] => (i.role === 'protein' ? 'p' : i.role === 'fat' ? 'f' : 'c')
  let open = [...free]
  const pinned: PlanItem[] = []
  for (let pass = 0; pass < 3 && open.length; pass++) {
    const eqs = [...new Set(open.map(main))]
    const rest = (m: (typeof MACROS)[number]) => goal[m] - pinned.reduce((a, i) => a + (i.food[m] * i.grams) / 100, 0)
    const x = eqs.length === open.length ? solve(eqs.map(m => open.map(i => i.food[m] / 100)), eqs.map(rest)) : null
    const grams = x ?? open.map(i => Math.max(0, rest(main(i))) / Math.max(i.food[main(i)] / 100, 0.01))
    const out: PlanItem[] = []
    open = open.filter((item, idx) => {
      const [min, max] = LIMITS[item.role]
      const g = grams[idx]
      if (g < min || g > max || !Number.isFinite(g)) {
        pinned.push({ ...item, grams: Number.isFinite(g) ? Math.min(max, Math.max(min, g)) : min })
        return false
      }
      out.push({ ...item, grams: g })
      return true
    })
    if (open.length === out.length && out.length) {
      pinned.push(...out)
      open = []
    }
  }
  pinned.push(...open.map(i => ({ ...i, grams: LIMITS[i.role][0] })))
  return [...fixed, ...free.map(f => pinned.find(p => p.role === f.role)!)].map(i => ({ ...i, grams: roundGrams(i.food, i.grams, i.role) }))
}

export function itemMacros(i: Pick<PlanItem, 'food' | 'grams'>) {
  const k = i.grams / 100
  return { kcal: i.food.kcal * k, p: i.food.p * k, c: i.food.c * k, f: i.food.f * k, fiber: i.food.fiber * k }
}

function sumItems(items: Pick<PlanItem, 'food' | 'grams'>[]) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 }
  for (const i of items) {
    const m = itemMacros(i)
    t.kcal += m.kcal
    t.p += m.p
    t.c += m.c
    t.f += m.f
    t.fiber += m.fiber
  }
  return t
}

/** Opções permitidas de um papel numa refeição. */
export function optionsFor(kind: SlotKind, role: Role, s: PlanSettings): FoodKey[] {
  return (OPTIONS[GROUP[kind]][role] ?? []).filter(k => allowed(k, s))
}

function pick(kind: SlotKind, role: Role, s: PlanSettings, variant: number, chosen?: FoodKey): FoodKey | null {
  const opts = optionsFor(kind, role, s)
  if (chosen && opts.includes(chosen)) return chosen
  return opts.length ? opts[variant % opts.length] : null
}

/** Monta o cardápio do dia a partir das metas e da consulta. */
export function buildPlan(targets: Targets, saved: SavedPlan): MealPlan {
  const s = saved.settings
  const slots = buildSlots(s)
  const weight = (m: 'p' | 'c' | 'f') => slots.reduce((a, sl) => a + SHARE[sl.kind][m], 0)
  const W = { p: weight('p'), c: weight('c'), f: weight('f') }
  let mainCount = 0
  let snackCount = 0

  const meals = slots.map((slot): PlanMeal => {
    const share = SHARE[slot.kind]
    const target = { p: (targets.protein_g * share.p) / W.p, c: (targets.carbs_g * share.c) / W.c, f: (targets.fat_g * share.f) / W.f }
    const picks = saved.picks[slot.key] ?? {}
    const group = GROUP[slot.kind]
    // Variação: almoço e jantar com proteínas diferentes, lanches com frutas diferentes.
    const variant = group === 'main' ? mainCount++ : group === 'snack' || group === 'pre' ? snackCount++ : 0
    const choose = (role: Role) => pick(slot.kind, role, s, variant, picks[role])
    const item = (role: Role, key: FoodKey | null, grams = 0): PlanItem[] => (key ? [{ role, key, food: F[key], grams }] : [])

    let fixed: PlanItem[] = []
    let free: PlanItem[] = []
    if (group === 'main') {
      const legume = choose('legume')
      fixed = [...item('salad', choose('salad'), 100), ...item('veg', choose('veg'), 80), ...item('legume', legume, slot.kind === 'lunch' ? 100 : 80)]
      // Vegetariano sem ovo nem tofu: a leguminosa vira a proteína e cresce.
      const protein = choose('protein')
      free = [...item('protein', protein), ...item('carb', choose('carb')), ...item('fat', choose('fat'))]
      if (!protein && legume) {
        fixed = fixed.filter(i => i.role !== 'legume')
        free.unshift(...item('legume', legume))
      }
    } else if (group === 'morning') {
      fixed = item('fruit', choose('fruit'), 0).map(i => ({ ...i, grams: i.food.unit[2] }))
      free = [...item('protein', choose('protein')), ...item('carb', choose('carb'))]
    } else if (group === 'snack') {
      const fruit = choose('fruit')
      free = [...item('protein', choose('protein')), ...item('fruit', fruit), ...item('fat', choose('fat'))]
      if (!fruit) free.push(...item('carb', choose('carb')))
    } else if (group === 'pre') {
      free = [...item('protein', choose('protein')), ...item('carb', choose('carb'))]
    } else {
      free = [...item('protein', choose('protein')), ...item('fat', choose('fat'))]
    }
    // A leguminosa no lugar da proteína resolve a proteína.
    const items = fitGrams(
      fixed,
      free.map(i => (i.role === 'legume' ? { ...i, role: 'protein' as Role } : i)),
      target,
    ).map(i => (i.key === free.find(f => f.role === 'legume')?.key ? { ...i, role: 'legume' as Role } : i))
    return { ...slot, items, target, total: sumItems(items) }
  })

  balance(meals, targets)
  return { meals, total: sumItems(meals.flatMap(m => m.items)) }
}

/**
 * Arredondar porções (pão inteiro, ovo inteiro) e os limites deixam o dia um pouco fora da
 * meta. A diferença vai para o almoço e o jantar, nos itens que dão para ajustar em gramas.
 */
function balance(meals: PlanMeal[], targets: Targets) {
  const mains = meals.filter(m => GROUP[m.kind] === 'main')
  for (let pass = 0; pass < 2 && mains.length; pass++) {
    const t = sumItems(meals.flatMap(m => m.items))
    const diff = { p: targets.protein_g - t.p, c: targets.carbs_g - t.c, f: targets.fat_g - t.f }
    for (const meal of mains) {
      meal.items = meal.items.map(i => {
        const m = i.role === 'protein' ? 'p' : i.role === 'carb' ? 'c' : i.role === 'fat' ? 'f' : null
        if (!m || i.food.whole || i.food[m] <= 0) return i
        return { ...i, grams: roundGrams(i.food, i.grams + (diff[m] / mains.length) * (100 / i.food[m]), i.role) }
      })
    }
  }
  for (const m of meals) m.total = sumItems(m.items)
}

// ---------- Leitura das porções ----------

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** "2 ovos", "120 g · 5 col. de sopa", "8 g · 2 unidades". */
export function portion(f: PlanFood, grams: number) {
  const [one, many, g] = f.unit
  const n = grams / g
  const units = Math.round(n * 2) / 2
  const label = units <= 1 ? one : many
  if (f.whole) return `${fmt1(Math.round(n))} ${Math.round(n) === 1 ? one : many}`
  if (units < 0.5) return `${fmt1(grams)} g`
  return `${fmt1(grams)} g · ${units === 0.5 ? '½' : fmt1(units)} ${label}`
}

/** Quantidade de outro alimento do mesmo papel que entrega o mesmo macro principal. */
export function equivalent(item: PlanItem, to: FoodKey): PlanItem {
  const food = F[to]
  const m = item.role === 'protein' ? 'p' : item.role === 'fat' ? 'f' : item.role === 'veg' || item.role === 'salad' ? 'kcal' : 'c'
  const amount = (item.food[m] * item.grams) / 100
  const grams = food[m] > 0 ? (amount * 100) / food[m] : item.grams
  return { role: item.role, key: to, food, grams: roundGrams(food, grams, item.role) }
}

/** Substituições: outras opções do papel, com a quantidade equivalente. */
export function substitutes(kind: SlotKind, item: PlanItem, s: PlanSettings, limit = 4): PlanItem[] {
  if (item.role === 'salad') return []
  return optionsFor(kind, item.role, s)
    .filter(k => k !== item.key)
    .slice(0, limit)
    .map(k => equivalent(item, k))
}

/** Lista de compras para 7 dias, somando as gramas de cada alimento. */
export function shoppingList(plan: MealPlan, days = 7) {
  const totals = new Map<FoodKey, number>()
  for (const i of plan.meals.flatMap(m => m.items)) totals.set(i.key, (totals.get(i.key) ?? 0) + i.grams * days)
  return [...totals.entries()]
    .map(([key, grams]) => ({ key, food: F[key], grams }))
    .sort((a, b) => b.grams - a.grams)
}

/** Como se compra: kg, dúzias, unidades. */
export function buyAmount(f: PlanFood, grams: number) {
  if (f === F.ovo) return `${Math.ceil(grams / 50)} ovos`
  if (f.whole) return `${Math.ceil(grams / f.unit[2])} ${f.unit[1]}`
  if (grams >= 1000) return `${fmt1(Math.ceil(grams / 100) / 10)} kg`
  return `${Math.ceil(grams / 50) * 50} g`
}

// ---------- Orientações ----------

export interface Guidance {
  title: string
  text: string
}

/** O que o nutricionista explicaria na entrega do plano. */
export function guidance(opts: { goal: Goal | null; targets: Targets; weightKg: number | null; waterMl: number; fiberG: number; settings: PlanSettings; meals: number }): Guidance[] {
  const { goal, targets, weightKg, settings } = opts
  const perKg = weightKg ? targets.protein_g / weightKg : null
  const perMeal = Math.round(targets.protein_g / opts.meals)
  const g: Guidance[] = [
    {
      title: 'Proteína espalhada no dia',
      text: `São ${targets.protein_g} g por dia${perKg ? ` (${fmt1(perKg)} g por kg)` : ''}, cerca de ${perMeal} g em cada refeição. Dividir assim ajuda mais o músculo do que concentrar tudo no almoço e no jantar.`,
    },
  ]
  if (settings.train) {
    g.push({
      title: 'Comida em volta do treino',
      text: `Treinando às ${settings.train}, coma o pré-treino 1 hora antes: carboidrato fácil de digerir e um pouco de proteína, com pouca gordura. Depois, faça uma refeição com proteína e carboidrato em até 2 horas.`,
    })
  }
  g.push({
    title: 'Monte o prato do almoço e do jantar',
    text: 'Metade do prato com salada e legumes, um quarto com a proteína e um quarto com arroz, batata ou mandioca, mais o feijão. Pese as porções na primeira semana até acostumar o olho.',
  })
  g.push({
    title: 'Água e fibra',
    text: `Beba ${fmt1(opts.waterMl / 1000)} L de água por dia, um pouco mais nos dias de treino e de calor. A meta de fibra é ${opts.fiberG} g: salada no almoço e no jantar, feijão e 2 a 3 frutas por dia já resolvem.`,
  })
  if (goal === 'lose') {
    g.push({
      title: 'Para perder gordura sem perder músculo',
      text: 'Mantenha a proteína mesmo nos dias de fome, evite calorias líquidas (refrigerante, suco, álcool) e deixe frutas e legumes à mão para os beliscos. Uma refeição livre por semana cabe no plano, sem exagero.',
    })
  } else if (goal === 'gain') {
    g.push({
      title: 'Para ganhar massa',
      text: 'Se for difícil comer tudo, use alimentos densos: azeite na comida, castanhas, aveia e pasta de amendoim. Não pule refeições: o superávit precisa acontecer todo dia.',
    })
  }
  g.push({
    title: 'Pesagem e ajuste',
    text: 'Pese-se 2 a 3 vezes por semana, de manhã, em jejum e depois do banheiro. O app recalcula as metas com o seu peso. Se em 2 a 3 semanas a média de 7 dias não andar no ritmo escolhido, ajuste a meta em 100 a 150 kcal.',
  })
  g.push({
    title: 'Suplementos',
    text: 'Creatina (3 a 5 g por dia, todo dia) tem boa evidência para força e massa. Whey é só praticidade para bater a proteína e pode substituir o iogurte ou os ovos dos lanches. Converse com um profissional de saúde antes de começar.',
  })
  g.push({
    title: 'Sono e sal',
    text: 'Durma de 7 a 9 horas: sono curto aumenta a fome e atrapalha a recuperação. Tempere com ervas, alho e limão e evite temperos prontos, que são cheios de sódio.',
  })
  return g
}

/** Próxima refeição do plano a partir de agora (minutos desde 0h). */
export function nextMeal(plan: MealPlan, nowMin: number): PlanMeal | null {
  return plan.meals.find(m => toMin(m.time) + 30 >= nowMin) ?? null
}
