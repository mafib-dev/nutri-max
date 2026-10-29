// Alimentos: conta dos macros por porção, busca e totais do dia.

export interface Food {
  id: string
  owner_id: string | null
  name: string
  category: string | null
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  sodium_mg: number | null
  serving_name: string | null
  serving_g: number | null
  barcode: string | null
  source: 'taco' | 'custom'
}

export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Café da manhã' },
  { key: 'lunch', label: 'Almoço' },
  { key: 'snack', label: 'Lanche' },
  { key: 'dinner', label: 'Jantar' },
]

export interface Macros {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface FoodLog extends Macros {
  id: string
  date: string
  meal: Meal
  food_id: string | null
  name: string
  /** Nulo na adição rápida, que tem só as calorias e os macros. */
  grams: number | null
  fiber_g: number | null
  sodium_mg: number | null
}

/** Fibra e sódio da porção; nulos quando o alimento não informa. */
export function microsFor(food: Pick<Food, 'fiber_g' | 'sodium_mg'>, grams: number) {
  const k = grams / 100
  return {
    fiber_g: food.fiber_g == null ? null : Math.round(food.fiber_g * k * 10) / 10,
    sodium_mg: food.sodium_mg == null ? null : Math.round(food.sodium_mg * k),
  }
}

/** Soma fibra e sódio do dia, ignorando o que não tem o valor. */
export function sumMicros(items: Pick<FoodLog, 'fiber_g' | 'sodium_mg'>[]) {
  const sum = (k: 'fiber_g' | 'sodium_mg') => items.reduce((a, i) => a + (i[k] == null ? 0 : Number(i[k])), 0)
  return { fiber_g: Math.round(sum('fiber_g') * 10) / 10, sodium_mg: Math.round(sum('sodium_mg')) }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Macros de uma quantidade em gramas (os valores do alimento são por 100 g). */
export function macrosFor(food: Pick<Food, keyof Macros>, grams: number): Macros {
  const k = grams / 100
  return {
    kcal: Math.round(food.kcal * k),
    protein_g: round1(food.protein_g * k),
    carbs_g: round1(food.carbs_g * k),
    fat_g: round1(food.fat_g * k),
  }
}

export function sumMacros(items: Macros[]): Macros {
  const t = items.reduce(
    (a, i) => ({ kcal: a.kcal + Number(i.kcal), protein_g: a.protein_g + Number(i.protein_g), carbs_g: a.carbs_g + Number(i.carbs_g), fat_g: a.fat_g + Number(i.fat_g) }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )
  return { kcal: Math.round(t.kcal), protein_g: round1(t.protein_g), carbs_g: round1(t.carbs_g), fat_g: round1(t.fat_g) }
}

/** Refeição sugerida pelo horário, para o botão de adicionar já abrir no lugar certo. */
export function mealForHour(hour: number): Meal {
  if (hour < 10) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 19) return 'snack'
  return 'dinner'
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Busca por palavras, sem acento e em qualquer ordem ("frango grelhado" acha
 * "Frango, peito, sem pele, grelhado"). Quem tem todas as palavras vem antes de
 * quem tem só algumas ("arroz branco cozido" ainda acha "Arroz, tipo 1, cozido").
 * Entre iguais: os do usuário, depois os que começam com a primeira palavra,
 * depois os nomes mais curtos.
 */
export function searchFoods<T extends Pick<Food, 'name' | 'source'>>(foods: T[], query: string, limit = 50): T[] {
  const words = normalize(query).split(' ').filter(Boolean)
  if (!words.length) return foods.slice(0, limit)
  const scored: { food: T; score: number }[] = []
  for (const food of foods) {
    const name = normalize(food.name)
    const tokens = name.split(' ')
    const missed = words.filter(w => !tokens.some(t => t.startsWith(w))).length
    // A primeira palavra é o alimento em si: sem ela, "arroz doce" traria todos os doces.
    if (missed === words.length || !tokens.some(t => t.startsWith(words[0]))) continue
    let score = missed * 10000 + name.length
    if (tokens[0].startsWith(words[0])) score -= 1000
    if (food.source === 'custom') score -= 2000
    scored.push({ food, score })
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map(s => s.food)
}

export const formatGrams = (g: number) => `${Number(g).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g`
