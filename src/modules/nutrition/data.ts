// Leitura e escrita do módulo de nutrição no Supabase.
import { supabase } from '../../lib/supabase'
import { macrosFor, type Food, type FoodLog, type Meal } from './foods'
import type { NutritionProfile } from './targets'

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`)
}

async function userId() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Faça login de novo.')
  return data.user.id
}

const NUM = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg', 'serving_g', 'grams'] as const

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

export type NewFood = Pick<Food, 'name' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'serving_name' | 'serving_g'>

export async function createFood(food: NewFood): Promise<Food> {
  const { data, error } = await supabase
    .from('foods')
    .insert({ ...food, owner_id: await userId(), source: 'custom', category: 'Meus alimentos' })
    .select()
    .single()
  fail('Falha ao criar o alimento', error)
  foods = null
  return numbers<Food>(data!)
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
  })
  fail('Falha ao adicionar', error)
}

/** Muda a quantidade, refazendo as contas pela proporção do que foi registrado. */
export async function updateLogGrams(log: FoodLog, grams: number) {
  const k = grams / log.grams
  const r1 = (n: number) => Math.round(n * k * 10) / 10
  const { error } = await supabase
    .from('food_logs')
    .update({ grams, kcal: Math.round(log.kcal * k), protein_g: r1(log.protein_g), carbs_g: r1(log.carbs_g), fat_g: r1(log.fat_g) })
    .eq('id', log.id)
  fail('Falha ao salvar', error)
}

export async function deleteLog(id: string) {
  const { error } = await supabase.from('food_logs').delete().eq('id', id)
  fail('Falha ao remover', error)
}

const PROFILE_COLS = 'sex, birth_date, height_cm, activity_level, goal, kcal_target, protein_target_g, carbs_target_g, fat_target_g'

export async function loadNutritionProfile(): Promise<NutritionProfile> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', await userId()).single()
  fail('Falha ao carregar o perfil', error)
  return { ...data, height_cm: data!.height_cm == null ? null : Number(data!.height_cm) } as NutritionProfile
}

export async function saveNutritionProfile(p: NutritionProfile) {
  const { error } = await supabase.from('profiles').update({ ...p, updated_at: new Date().toISOString() }).eq('id', await userId())
  fail('Falha ao salvar o perfil', error)
}
