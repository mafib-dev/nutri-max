import { describe, expect, it } from 'vitest'
import { buildDays } from './days'
import type { FoodLog } from '../nutrition/foods'
import type { NutritionProfile } from '../nutrition/targets'

const log = (date: string, kcal: number, protein_g: number): FoodLog => ({ id: date + kcal, date, meal: 'lunch', food_id: null, name: 'X', grams: 100, kcal, protein_g, carbs_g: 0, fat_g: 0, fiber_g: null, sodium_mg: null })
const profile: NutritionProfile = { sex: 'male', birth_date: '1995-06-15', height_cm: 180, activity_level: 'moderate', goal: 'lose', kcal_target: null, protein_target_g: null, carbs_target_g: null, fat_target_g: null, target_weight_kg: 76, weekly_rate_kg: 0.5, add_workout_kcal: true }

describe('buildDays', () => {
  it('junta tudo por dia, do mais recente para o mais antigo', () => {
    const days = buildDays({
      logs: [log('2026-10-27', 500, 40), log('2026-10-27', 700, 50), log('2026-10-29', 300, 20)],
      water: [{ date: '2026-10-28', ml: 1500 }, { date: '2026-10-26', ml: 0 }],
      weights: [{ date: '2026-10-28', weight_kg: 80 }],
      workouts: [{ id: 'w1', name: 'Treino A', started_at: '2026-10-27T18:00:00', ended_at: '2026-10-27T19:00:00', sets: 15, volume: 5000 }],
      profile,
    })
    expect(days.map(d => d.date)).toEqual(['2026-10-29', '2026-10-28', '2026-10-27'])
    const [d29, d28, d27] = days
    expect(d27.eaten.kcal).toBe(1200)
    expect(d27.trainingMin).toBe(60)
    expect(d28.waterMl).toBe(1500)
    expect(d28.weightKg).toBe(80)
    expect(d29.weightKg).toBeNull()
    expect(d29.knownWeightKg).toBe(80)
    // Dia com treino ganha as calorias do treino na meta.
    expect(d27.targets!.kcal).toBeGreaterThan(d29.targets!.kcal)
  })

  it('sem perfil, sem metas', () => {
    expect(buildDays({ logs: [log('2026-10-29', 300, 20)], water: [], weights: [], workouts: [], profile: null })[0].targets).toBeNull()
  })
})
