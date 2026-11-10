// Plano alimentar montado pela própria pessoa: as refeições, os horários e os alimentos são
// dela; o app só soma e compara com as metas.
import type { Food, Meal } from './foods'
import type { MealPlan, PlanItem, PlanMeal, SlotKind } from './plan'

export interface ManualItem {
  id: string
  /** id na tabela foods; null quando o alimento foi apagado ou veio de fora. */
  food_id: string | null
  name: string
  grams: number
  /** "2 conchas", "1 unidade"… quando foi escolhido em medida caseira. */
  measure: string | null
  /** Valores por 100 g. */
  per100: { kcal: number; p: number; c: number; f: number; fiber: number }
}

export interface ManualMeal {
  id: string
  name: string
  /** "HH:MM" */
  time: string
  /** Em que refeição do diário ela entra. */
  log: Meal
  /** A pessoa escolheu `log` à mão; sem isso, ele segue o nome e o horário. */
  logManual?: boolean
  items: ManualItem[]
}

export interface ManualDay {
  id: string
  /** "Todos os dias", "Dia de treino", "Descanso"… */
  name: string
  /** 0 = domingo … 6 = sábado. */
  weekdays: number[]
  meals: ManualMeal[]
}

export interface ManualPlan {
  days: ManualDay[]
}

let seq = 0
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/** Começa com as quatro refeições mais comuns, vazias, para a pessoa preencher. */
export function starterPlan(): ManualPlan {
  return {
    days: [
      {
        id: newId(),
        name: 'Todos os dias',
        weekdays: ALL_DAYS,
        meals: [
          { id: newId(), name: 'Café da manhã', time: '07:00', log: 'breakfast', items: [] },
          { id: newId(), name: 'Almoço', time: '12:30', log: 'lunch', items: [] },
          { id: newId(), name: 'Lanche da tarde', time: '16:00', log: 'snack', items: [] },
          { id: newId(), name: 'Jantar', time: '20:00', log: 'dinner', items: [] },
        ],
      },
    ],
  }
}

/** Em que refeição do diário cai uma refeição pelo horário. */
export function logForTime(time: string): Meal {
  const h = Number(time.slice(0, 2))
  if (h < 10) return 'breakfast'
  if (h >= 11 && h < 14) return 'lunch'
  if (h >= 19) return 'dinner'
  return 'snack'
}

/** Seção do diário pelo nome ("Jantar", "Lanche da tarde"…) e, sem pista no nome, pelo horário. */
export function guessLog(name: string, time: string): Meal {
  const n = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/lanche|ceia|pre.?treino|pos.?treino|snack/.test(n)) return 'snack'
  if (/jantar|janta/.test(n)) return 'dinner'
  if (/almoco/.test(n)) return 'lunch'
  if (/cafe|desjejum/.test(n)) return 'breakfast'
  return logForTime(time)
}

/** A seção do diário em que a refeição entra. */
export const mealLog = (m: Pick<ManualMeal, 'name' | 'time' | 'log' | 'logManual'>): Meal => (m.logManual ? m.log : guessLog(m.name, m.time))

export function itemFromFood(food: Food, grams: number, measure: string | null): ManualItem {
  return {
    id: newId(),
    food_id: food.id,
    name: food.name,
    grams,
    measure,
    per100: { kcal: food.kcal, p: food.protein_g, c: food.carbs_g, f: food.fat_g, fiber: food.fiber_g ?? 0 },
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function itemTotals(i: Pick<ManualItem, 'grams' | 'per100'>) {
  const k = i.grams / 100
  return { kcal: Math.round(i.per100.kcal * k), p: r1(i.per100.p * k), c: r1(i.per100.c * k), f: r1(i.per100.f * k), fiber: r1(i.per100.fiber * k) }
}

export function mealTotals(items: Pick<ManualItem, 'grams' | 'per100'>[]) {
  return items.reduce(
    (a, i) => {
      const t = itemTotals(i)
      return { kcal: a.kcal + t.kcal, p: r1(a.p + t.p), c: r1(a.c + t.c), f: r1(a.f + t.f), fiber: r1(a.fiber + t.fiber) }
    },
    { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 },
  )
}

/** Muda a quantidade mantendo a medida caseira proporcional quando ela existe. */
export function setGrams(i: ManualItem, grams: number): ManualItem {
  return { ...i, grams, measure: grams === i.grams ? i.measure : null }
}

/** O cardápio do dia da semana (o tipo que tem esse dia, senão o primeiro). */
export function manualDayFor(plan: ManualPlan, weekday: number): ManualDay | null {
  return plan.days.find(d => d.weekdays.includes(weekday)) ?? plan.days[0] ?? null
}

/** Põe um dia da semana num cardápio e tira dos outros (cada dia tem um só). */
export function moveWeekday(plan: ManualPlan, dayId: string, weekday: number): ManualPlan {
  return {
    days: plan.days.map(d =>
      d.id === dayId ? { ...d, weekdays: d.weekdays.includes(weekday) ? d.weekdays : [...d.weekdays, weekday].sort((a, b) => a - b) } : { ...d, weekdays: d.weekdays.filter(w => w !== weekday) },
    ),
  }
}

const KIND_OF: Record<Meal, SlotKind> = { breakfast: 'breakfast', lunch: 'lunch', snack: 'afternoon_snack', dinner: 'dinner' }

/** O cardápio montado no formato do plano, para o Hoje e o diário seguirem igual. */
export function manualToMealPlan(day: ManualDay): MealPlan {
  const meals: PlanMeal[] = [...day.meals]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(m => {
      const total = mealTotals(m.items)
      const items: PlanItem[] = m.items.map(i => ({
        role: 'carb',
        key: i.id as PlanItem['key'],
        grams: i.grams,
        food: {
          id: i.food_id ?? '',
          name: i.name,
          kcal: i.per100.kcal,
          p: i.per100.p,
          c: i.per100.c,
          f: i.per100.f,
          fiber: i.per100.fiber,
          tags: [],
          // A "unidade" é enorme de propósito: a tela mostra só os gramas.
          unit: ['g', 'g', 100000],
        },
      }))
      return { key: m.id, kind: KIND_OF[mealLog(m)], label: m.name, time: m.time, auto: m.time, log: mealLog(m), items, target: { p: total.p, c: total.c, f: total.f }, total }
    })
  return { meals, total: mealTotals(day.meals.flatMap(m => m.items)) }
}
