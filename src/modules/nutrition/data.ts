// Leitura e escrita do módulo de nutrição no Supabase.
import { supabase } from '../../lib/supabase'
import { macrosFor, microsFor, type Food, type FoodLog, type Meal } from './foods'
import type { NutritionProfile } from './targets'

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`)
}

async function userId() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Faça login de novo.')
  return data.user.id
}

const NUM = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg', 'serving_g', 'grams', 'target_weight_kg', 'weekly_rate_kg', 'height_cm'] as const

// O Postgres devolve numeric como texto: converte para número na entrada.
function numbers<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...row }
  for (const k of NUM) if (k in out && out[k] != null) out[k] = Number(out[k])
  return out as T
}

export const todayIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// O catálogo muda pouco: carregado uma vez por sessão do app.
let foods: Promise<Food[]> | null = null
export function loadFoods(): Promise<Food[]> {
  foods ??= (async () => {
    const { data, error } = await supabase.from('foods').select('*').order('name').limit(5000)
    fail('Falha ao carregar os alimentos', error)
    return (data ?? []).map(r => numbers<Food>(r))
  })().catch(err => {
    foods = null
    throw err
  })
  return foods
}

export type NewFood = Pick<Food, 'name' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'serving_name' | 'serving_g'> &
  Partial<Pick<Food, 'fiber_g' | 'sodium_mg' | 'barcode' | 'category'>>

export async function createFood(food: NewFood): Promise<Food> {
  const { data, error } = await supabase
    .from('foods')
    .insert({ category: 'Meus alimentos', ...food, owner_id: await userId(), source: 'custom' })
    .select()
    .single()
  fail('Falha ao criar o alimento', error)
  foods = null
  return numbers<Food>(data!)
}

/** Produto já lido antes por este usuário: não precisa ir ao Open Food Facts de novo. */
export async function findFoodByBarcode(barcode: string): Promise<Food | null> {
  const all = await loadFoods()
  return all.find(f => f.barcode === barcode) ?? null
}

export async function deleteFood(id: string) {
  const { error } = await supabase.from('foods').delete().eq('id', id)
  fail('Falha ao apagar o alimento', error)
  foods = null
}

export async function listLogs(date: string): Promise<FoodLog[]> {
  const { data, error } = await supabase.from('food_logs').select('*').eq('date', date).order('created_at')
  fail('Falha ao carregar as refeições', error)
  return (data ?? []).map(r => numbers<FoodLog>(r))
}

/** Totais por dia de um intervalo, para a média da semana. */
export async function listLogTotals(from: string, to: string) {
  const { data, error } = await supabase.from('food_logs').select('date, kcal, protein_g, carbs_g, fat_g').gte('date', from).lte('date', to)
  fail('Falha ao carregar as refeições', error)
  return (data ?? []).map(r => numbers<Pick<FoodLog, 'date' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>>(r))
}

/** Alimentos usados por último, sem repetir, para aparecerem primeiro ao adicionar. */
export async function recentFoodIds(limit = 12): Promise<string[]> {
  const { data, error } = await supabase.from('food_logs').select('food_id').not('food_id', 'is', null).order('created_at', { ascending: false }).limit(200)
  fail('Falha ao carregar os recentes', error)
  return [...new Set((data ?? []).map(r => r.food_id as string))].slice(0, limit)
}

export async function addLog(date: string, meal: Meal, food: Food, grams: number) {
  const { error } = await supabase.from('food_logs').insert({
    user_id: await userId(),
    date,
    meal,
    food_id: food.id,
    name: food.name,
    grams,
    ...macrosFor(food, grams),
    ...microsFor(food, grams),
  })
  fail('Falha ao adicionar', error)
}

/** Adição rápida: só as calorias (e os macros, se souber), sem procurar alimento. */
export async function addQuickLog(date: string, meal: Meal, entry: { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }) {
  const { error } = await supabase.from('food_logs').insert({ user_id: await userId(), date, meal, food_id: null, grams: null, ...entry })
  fail('Falha ao adicionar', error)
}

export async function updateQuickLog(id: string, entry: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }) {
  const { error } = await supabase.from('food_logs').update(entry).eq('id', id)
  fail('Falha ao salvar', error)
}

/** Muda a quantidade, refazendo as contas pela proporção do que foi registrado. */
export async function updateLogGrams(log: FoodLog & { grams: number }, grams: number) {
  const k = grams / log.grams
  const r1 = (n: number) => Math.round(n * k * 10) / 10
  const { error } = await supabase
    .from('food_logs')
    .update({
      grams,
      kcal: Math.round(log.kcal * k),
      protein_g: r1(log.protein_g),
      carbs_g: r1(log.carbs_g),
      fat_g: r1(log.fat_g),
      fiber_g: log.fiber_g == null ? null : r1(log.fiber_g),
      sodium_mg: log.sodium_mg == null ? null : Math.round(log.sodium_mg * k),
    })
    .eq('id', log.id)
  fail('Falha ao salvar', error)
}

export async function deleteLog(id: string) {
  const { error } = await supabase.from('food_logs').delete().eq('id', id)
  fail('Falha ao remover', error)
}

const PROFILE_COLS =
  'sex, birth_date, height_cm, activity_level, goal, kcal_target, protein_target_g, carbs_target_g, fat_target_g, target_weight_kg, weekly_rate_kg, add_workout_kcal'

export async function loadNutritionProfile(): Promise<NutritionProfile> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', await userId()).single()
  fail('Falha ao carregar o perfil', error)
  return numbers<NutritionProfile>(data!)
}

export async function saveNutritionProfile(p: NutritionProfile) {
  const { error } = await supabase.from('profiles').update({ ...p, updated_at: new Date().toISOString() }).eq('id', await userId())
  fail('Falha ao salvar o perfil', error)
}

/** Minutos de cada treino terminado no dia (fuso local), para somar as calorias à meta. */
export async function workoutMinutesOn(date: string): Promise<number[]> {
  const from = new Date(date + 'T00:00:00')
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  const { data, error } = await supabase
    .from('workouts')
    .select('started_at, ended_at')
    .gte('started_at', from.toISOString())
    .lt('started_at', to.toISOString())
    .not('ended_at', 'is', null)
  fail('Falha ao carregar os treinos do dia', error)
  return (data ?? []).map(w => (Date.parse(w.ended_at as string) - Date.parse(w.started_at as string)) / 60000)
}

export interface SavedMealItem {
  food_id: string | null
  name: string
  grams: number | null
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  sodium_mg: number | null
}

export interface SavedMeal {
  id: string
  name: string
  items: SavedMealItem[]
}

export async function listSavedMeals(): Promise<SavedMeal[]> {
  const { data, error } = await supabase.from('saved_meals').select('id, name, items').order('name')
  fail('Falha ao carregar as refeições salvas', error)
  return (data ?? []) as SavedMeal[]
}

/** Guarda os itens de uma refeição do diário para lançar de novo depois. */
export async function saveMeal(name: string, logs: FoodLog[]) {
  const items: SavedMealItem[] = logs.map(l => ({
    food_id: l.food_id,
    name: l.name,
    grams: l.grams,
    kcal: l.kcal,
    protein_g: l.protein_g,
    carbs_g: l.carbs_g,
    fat_g: l.fat_g,
    fiber_g: l.fiber_g,
    sodium_mg: l.sodium_mg,
  }))
  const { error } = await supabase.from('saved_meals').insert({ user_id: await userId(), name, items })
  fail('Falha ao salvar a refeição', error)
}

export async function deleteSavedMeal(id: string) {
  const { error } = await supabase.from('saved_meals').delete().eq('id', id)
  fail('Falha ao apagar a refeição salva', error)
}

export async function logSavedMeal(date: string, meal: Meal, saved: SavedMeal) {
  const [uid, foods] = await Promise.all([userId(), loadFoods()])
  // Um alimento apagado depois de salvar a refeição não pode quebrar o lançamento.
  const known = new Set(foods.map(f => f.id))
  const rows = saved.items.map(i => ({ ...i, food_id: i.food_id && known.has(i.food_id) ? i.food_id : null, user_id: uid, date, meal }))
  const { error } = await supabase.from('food_logs').insert(rows)
  fail('Falha ao lançar a refeição', error)
}

export async function getWater(date: string): Promise<number> {
  const { data, error } = await supabase.from('water_logs').select('ml').eq('date', date).maybeSingle()
  fail('Falha ao carregar a água', error)
  return data?.ml ?? 0
}

export async function setWater(date: string, ml: number) {
  const { error } = await supabase.from('water_logs').upsert({ user_id: await userId(), date, ml: Math.max(0, Math.round(ml)) }, { onConflict: 'user_id,date' })
  fail('Falha ao salvar a água', error)
}
