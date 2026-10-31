// Carrega o necessário para montar o plano: perfil, peso, consulta salva e metas do dia.
import { listBodyWeights } from '../training/data'
import { loadMealPlan, loadNutritionProfile } from './data'
import { buildPlan, type MealPlan, type SavedPlan } from './plan'
import { dailyTargets, type NutritionProfile, type Targets } from './targets'

export interface PlanContext {
  profile: NutritionProfile
  weight: number | null
  saved: SavedPlan | null
  /** Metas sem as calorias do treino: o plano é o dia-base. */
  targets: Targets | null
  plan: MealPlan | null
}

export async function loadPlanContext(): Promise<PlanContext> {
  const [profile, weights, saved] = await Promise.all([loadNutritionProfile(), listBodyWeights(1), loadMealPlan()])
  const weight = weights.at(-1)?.weight_kg ?? null
  const targets = dailyTargets(profile, weight)
  return { profile, weight, saved, targets, plan: targets && saved ? buildPlan(targets, saved) : null }
}
