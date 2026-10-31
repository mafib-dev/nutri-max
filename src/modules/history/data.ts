// Leitura do histórico por dia: diário alimentar, água, peso e treinos de um intervalo.
import { supabase } from '../../lib/supabase'
import { loadNutritionProfile, todayIso } from '../nutrition/data'
import type { FoodLog } from '../nutrition/foods'
import { listBodyWeights, listWorkouts, loadCatalogue, loadState } from '../training/data'
import { buildDays } from './days'

const NUM = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg', 'grams'] as const

/** Os últimos `days` dias, do mais recente para o mais antigo, e o que é preciso para abrir os treinos. */
export async function loadHistory(days: number, now = new Date()) {
  const start = new Date(now)
  start.setDate(start.getDate() - days + 1)
  start.setHours(0, 0, 0, 0)
  const from = todayIso(start)
  const to = todayIso(now)
  const [logs, water, weights, workouts, profile, state, catalogue] = await Promise.all([
    supabase.from('food_logs').select('*').gte('date', from).lte('date', to).order('created_at'),
    supabase.from('water_logs').select('date, ml').gte('date', from).lte('date', to),
    listBodyWeights(400),
    listWorkouts(500, start),
    loadNutritionProfile(),
    loadState(),
    loadCatalogue(),
  ])
  if (logs.error) throw new Error(`Falha ao carregar as refeições: ${logs.error.message}`)
  if (water.error) throw new Error(`Falha ao carregar a água: ${water.error.message}`)
  const foodLogs = (logs.data ?? []).map(r => {
    const out: Record<string, unknown> = { ...r }
    for (const k of NUM) if (out[k] != null) out[k] = Number(out[k])
    return out as unknown as FoodLog
  })
  return {
    days: buildDays({
      logs: foodLogs,
      water: (water.data ?? []).map(w => ({ date: w.date as string, ml: Number(w.ml) })),
      weights: weights.filter(w => w.date >= from),
      allWeights: weights,
      workouts,
      profile,
    }),
    state,
    catalogue,
  }
}
