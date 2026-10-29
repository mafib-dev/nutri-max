// Metas diárias: gasto calórico pela fórmula de Mifflin-St Jeor e divisão dos macros.

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

/** Gasto do dia ajustado pelo objetivo, arredondado de 10 em 10. */
export function calculatedKcal(p: NutritionProfile, weightKg: number, on: Date): number | null {
  if (missingForTargets(p, weightKg).length) return null
  const tdee = bmr(p.sex!, weightKg, p.height_cm!, ageOn(p.birth_date!, on)) * ACTIVITY[p.activity_level!].factor
  return Math.round((tdee * GOALS[p.goal ?? 'maintain'].kcalFactor) / 10) * 10
}

/** Metas do dia. O que o usuário definiu à mão vale mais que o calculado. */
export function dailyTargets(p: NutritionProfile, weightKg: number | null, on = new Date()): Targets | null {
  const kcal = p.kcal_target ?? (weightKg ? calculatedKcal(p, weightKg, on) : null)
  if (kcal == null) return null
  const split = weightKg ? splitMacros(kcal, weightKg, p.goal ?? 'maintain') : { protein_g: 0, carbs_g: 0, fat_g: 0 }
  return {
    kcal,
    protein_g: p.protein_target_g ?? split.protein_g,
    carbs_g: p.carbs_target_g ?? split.carbs_g,
    fat_g: p.fat_target_g ?? split.fat_g,
  }
}
