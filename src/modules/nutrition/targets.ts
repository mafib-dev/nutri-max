// Metas diárias: gasto calórico pela fórmula de Mifflin-St Jeor e divisão dos macros.
// Ritmo semanal, redução perto do peso-alvo, calorias do treino com compensação e
// piso de calorias seguem o OpenNutriTracker (GPLv3), reescritos aqui.

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Goal = 'lose' | 'gain' | 'maintain'

export interface NutritionProfile {
  sex: Sex | null
  birth_date: string | null
  height_cm: number | null
  activity_level: ActivityLevel | null
  goal: Goal | null
  kcal_target: number | null
  protein_target_g: number | null
  carbs_target_g: number | null
  fat_target_g: number | null
  target_weight_kg: number | null
  /** kg por semana a perder ou ganhar; nulo = usa o ajuste padrão do objetivo. */
  weekly_rate_kg: number | null
  /** Soma à meta do dia as calorias dos treinos registrados. */
  add_workout_kcal: boolean
}

export interface Targets {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export const ACTIVITY: Record<ActivityLevel, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Sedentário', hint: 'Trabalho sentado e pouco movimento' },
  light: { factor: 1.375, label: 'Leve', hint: 'Treina 1 a 3 vezes por semana' },
  moderate: { factor: 1.55, label: 'Moderado', hint: 'Treina 3 a 5 vezes por semana' },
  active: { factor: 1.725, label: 'Ativo', hint: 'Treina 6 a 7 vezes por semana' },
  very_active: { factor: 1.9, label: 'Muito ativo', hint: 'Treino pesado e trabalho físico' },
}

export const GOALS: Record<Goal, { label: string; kcalFactor: number; proteinPerKg: number }> = {
  lose: { label: 'Perder gordura', kcalFactor: 0.8, proteinPerKg: 2.0 },
  maintain: { label: 'Manter o peso', kcalFactor: 1, proteinPerKg: 1.6 },
  gain: { label: 'Ganhar massa', kcalFactor: 1.1, proteinPerKg: 1.8 },
}

export function ageOn(birthDate: string, on: Date): number {
  const [y, m, d] = birthDate.split('-').map(Number)
  let age = on.getFullYear() - y
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) age--
  return age
}

/** Taxa metabólica basal (kcal/dia), Mifflin-St Jeor. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

/** O que falta no perfil para calcular as metas sozinho. */
export function missingForTargets(p: NutritionProfile, weightKg: number | null): string[] {
  const missing: string[] = []
  if (!p.sex) missing.push('sexo')
  if (!p.birth_date) missing.push('data de nascimento')
  if (!p.height_cm) missing.push('altura')
  if (!weightKg) missing.push('peso')
  if (!p.activity_level) missing.push('nível de atividade')
  return missing
}

/** Divide as calorias: proteína por kg, 25% de gordura (mínimo 0,6 g/kg) e o resto em carboidrato. */
export function splitMacros(kcal: number, weightKg: number, goal: Goal): Omit<Targets, 'kcal'> {
  const protein = Math.round(weightKg * GOALS[goal].proteinPerKg)
  const fat = Math.round(Math.max((kcal * 0.25) / 9, weightKg * 0.6))
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { protein_g: protein, carbs_g: carbs, fat_g: fat }
}

/** 1 kg de gordura ≈ 7.700 kcal: espalhado pelos 7 dias, ≈ 1.100 kcal por dia para cada kg/semana. */
export const KCAL_PER_KG_WEEK = 1100

/** A redução começa a diminuir a 5 kg do alvo e vira manutenção a 1 kg. */
const TAPER_START_KG = 5
const TAPER_END_KG = 1

/**
 * Ajuste do objetivo perto do peso-alvo: integral longe dele, caindo em linha reta até
 * zero na reta final, e zero depois de chegar (para quem perde, peso ≤ alvo).
 */
export function taperAdjustment(adjustment: number, weightKg: number, targetKg: number | null, goal: Goal): number {
  if (targetKg == null || goal === 'maintain' || adjustment === 0) return adjustment
  const toGo = goal === 'lose' ? weightKg - targetKg : targetKg - weightKg
  if (toGo <= TAPER_END_KG) return 0
  if (toGo >= TAPER_START_KG) return adjustment
  return (adjustment * (toGo - TAPER_END_KG)) / (TAPER_START_KG - TAPER_END_KG)
}

/** Gasto do dia ajustado pelo objetivo, arredondado de 10 em 10. */
export function calculatedKcal(p: NutritionProfile, weightKg: number, on: Date): number | null {
  if (missingForTargets(p, weightKg).length) return null
  const goal = p.goal ?? 'maintain'
  const tdee = bmr(p.sex!, weightKg, p.height_cm!, ageOn(p.birth_date!, on)) * ACTIVITY[p.activity_level!].factor
  const adjustment =
    goal !== 'maintain' && p.weekly_rate_kg ? p.weekly_rate_kg * KCAL_PER_KG_WEEK * (goal === 'lose' ? -1 : 1) : tdee * (GOALS[goal].kcalFactor - 1)
  return Math.round((tdee + taperAdjustment(adjustment, weightKg, p.target_weight_kg, goal)) / 10) * 10
}

/**
 * Metas do dia. O que o usuário definiu à mão vale mais que o calculado.
 * extraKcal são as calorias dos treinos do dia, somadas antes de dividir os macros.
 */
export function dailyTargets(p: NutritionProfile, weightKg: number | null, on = new Date(), extraKcal = 0): Targets | null {
  const base = p.kcal_target ?? (weightKg ? calculatedKcal(p, weightKg, on) : null)
  if (base == null) return null
  const kcal = base + Math.round(extraKcal)
  const split = weightKg ? splitMacros(kcal, weightKg, p.goal ?? 'maintain') : { protein_g: 0, carbs_g: 0, fat_g: 0 }
  return {
    kcal,
    protein_g: p.protein_target_g ?? split.protein_g,
    carbs_g: p.carbs_target_g ?? split.carbs_g,
    fat_g: p.fat_target_g ?? split.fat_g,
  }
}

/** Abaixo disso a meta merece um aviso (referência usada pelo OpenNutriTracker). */
export const kcalFloor = (sex: Sex | null) => (sex === 'male' ? 1500 : 1200)

/**
 * Musculação no Compêndio de Atividades Físicas 2024 (Herrmann et al.): esforço vigoroso,
 * várias séries, ≈ 5 MET. kcal = MET × kg × horas.
 */
export const STRENGTH_MET = 5

/**
 * Parte do gasto do treino que o corpo compensa ao longo do dia (menos movimento espontâneo,
 * metabolismo mais baixo): em média 28% (Careau et al., Current Biology 2021). Conta 72%.
 */
export const WORKOUT_CREDIT = 0.72

export function workoutKcal(durationMin: number, weightKg: number, met = STRENGTH_MET): number {
  if (!(durationMin > 0) || !(weightKg > 0)) return 0
  // Treino esquecido aberto não vira 10 horas de musculação.
  const minutes = Math.min(durationMin, 180)
  return Math.round(met * weightKg * (minutes / 60) * WORKOUT_CREDIT)
}

/** Média móvel dos últimos 7 dias (inclusive) em cada pesagem, para enxergar a tendência. */
export function weightTrend(weights: { date: string; weight_kg: number }[], days = 7) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const t = (iso: string) => Date.parse(iso + 'T12:00:00Z') / 86400000
  return sorted.map((w, i) => {
    const window = sorted.slice(0, i + 1).filter(x => t(w.date) - t(x.date) < days)
    return { date: w.date, avg: Math.round((window.reduce((a, x) => a + x.weight_kg, 0) / window.length) * 10) / 10, samples: window.length }
  })
}

/** Semanas até o peso-alvo no ritmo escolhido, ou null se não houver alvo ou ritmo. */
export function weeksToTarget(weightKg: number, targetKg: number | null, rateKg: number | null): number | null {
  if (targetKg == null || !rateKg) return null
  const diff = Math.abs(weightKg - targetKg)
  return diff < 0.1 ? 0 : Math.ceil(diff / rateKg)
}

/** Fibra (IOM): 38 g homens e 25 g mulheres até 50 anos; 30 g e 21 g depois. Sódio: até 2.300 mg. */
export function fiberTarget(sex: Sex | null, age: number | null): number {
  const older = age != null && age > 50
  return sex === 'male' ? (older ? 30 : 38) : older ? 21 : 25
}
export const SODIUM_LIMIT_MG = 2300

/** Água: 35 ml por kg, arredondado de 250 em 250 ml (um copo). */
export const waterTarget = (weightKg: number | null) => (weightKg ? Math.round((weightKg * 35) / 250) * 250 : 2000)
