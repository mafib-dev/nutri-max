import { describe, expect, it } from 'vitest'
import { ageOn, bmr, calculatedKcal, dailyTargets, fiberTarget, missingForTargets, splitMacros, taperAdjustment, waterTarget, weeksToTarget, weightTrend, workoutKcal, type NutritionProfile } from './targets'

const base: NutritionProfile = {
  sex: 'male',
  birth_date: '1995-06-15',
  height_cm: 180,
  activity_level: 'moderate',
  goal: 'maintain',
  kcal_target: null,
  protein_target_g: null,
  carbs_target_g: null,
  fat_target_g: null,
  target_weight_kg: null,
  weekly_rate_kg: null,
  add_workout_kcal: false,
}
const on = new Date(2026, 9, 29)

describe('metas de nutrição', () => {
  it('calcula a idade considerando se já fez aniversário', () => {
    expect(ageOn('1995-06-15', on)).toBe(31)
    expect(ageOn('1995-11-15', on)).toBe(30)
    expect(ageOn('1995-10-29', on)).toBe(31)
  })

  it('usa Mifflin-St Jeor para a taxa basal', () => {
    expect(bmr('male', 80, 180, 31)).toBe(1775)
    expect(bmr('female', 60, 165, 31)).toBe(1315.25)
  })

  it('multiplica pela atividade e ajusta pelo objetivo', () => {
    expect(calculatedKcal(base, 80, on)).toBe(2750) // 1775 × 1,55 = 2751
    expect(calculatedKcal({ ...base, goal: 'lose' }, 80, on)).toBe(2200)
    expect(calculatedKcal({ ...base, goal: 'gain' }, 80, on)).toBe(3030)
    expect(calculatedKcal({ ...base, goal: null }, 80, on)).toBe(2750)
  })

  it('divide os macros fechando as calorias', () => {
    const m = splitMacros(2750, 80, 'maintain')
    expect(m.protein_g).toBe(128)
    expect(m.fat_g).toBe(76)
    expect(Math.abs(m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9 - 2750)).toBeLessThan(4)
    expect(splitMacros(2200, 80, 'lose').protein_g).toBe(160)
  })

  it('garante gordura mínima de 0,6 g/kg e nunca carboidrato negativo', () => {
    const m = splitMacros(1200, 120, 'lose')
    expect(m.fat_g).toBe(72)
    expect(m.carbs_g).toBe(0)
  })

  it('aponta o que falta no perfil', () => {
    expect(missingForTargets(base, 80)).toEqual([])
    expect(missingForTargets({ ...base, sex: null, height_cm: null }, null)).toEqual(['sexo', 'altura', 'peso'])
    expect(dailyTargets({ ...base, sex: null }, 80, on)).toBeNull()
  })

  it('respeita as metas definidas à mão', () => {
    const t = dailyTargets({ ...base, kcal_target: 2000, protein_target_g: 180 }, 80, on)!
    expect(t.kcal).toBe(2000)
    expect(t.protein_g).toBe(180)
    expect(t.fat_g).toBe(56)
    // Só a meta de calorias, mesmo sem os dados do corpo.
    expect(dailyTargets({ ...base, sex: null, kcal_target: 1800 }, null, on)).toEqual({ kcal: 1800, protein_g: 0, carbs_g: 0, fat_g: 0 })
  })

  it('usa o ritmo semanal quando escolhido (1.100 kcal por dia por kg/semana)', () => {
    expect(calculatedKcal({ ...base, goal: 'lose', weekly_rate_kg: 0.5 }, 80, on)).toBe(2200) // 2751 − 550
    expect(calculatedKcal({ ...base, goal: 'gain', weekly_rate_kg: 0.25 }, 80, on)).toBe(3030) // 2751 + 275
    expect(calculatedKcal({ ...base, goal: 'maintain', weekly_rate_kg: 0.5 }, 80, on)).toBe(2750)
  })

  it('reduz o déficit perto do peso-alvo e para ao chegar', () => {
    expect(taperAdjustment(-500, 90, 80, 'lose')).toBe(-500)
    expect(taperAdjustment(-500, 83, 80, 'lose')).toBe(-250)
    expect(taperAdjustment(-500, 80.5, 80, 'lose')).toBe(0)
    expect(taperAdjustment(-500, 78, 80, 'lose')).toBe(0)
    expect(taperAdjustment(300, 77, 80, 'gain')).toBe(150)
    expect(taperAdjustment(-500, 83, null, 'lose')).toBe(-500)
    expect(calculatedKcal({ ...base, goal: 'lose', target_weight_kg: 77 }, 80, on)).toBe(2480) // 2751 − 550 × 0,5
  })

  it('soma as calorias do treino antes de dividir os macros', () => {
    const t = dailyTargets(base, 80, on, 300)!
    expect(t.kcal).toBe(3050)
    expect(t.protein_g).toBe(128)
  })

  it('conta 72% do gasto do treino e limita a 3 horas', () => {
    expect(workoutKcal(60, 80)).toBe(288) // 5 × 80 × 1 × 0,72
    expect(workoutKcal(600, 80)).toBe(864)
    expect(workoutKcal(0, 80)).toBe(0)
  })

  it('calcula a média móvel de 7 dias do peso', () => {
    const tr = weightTrend([
      { date: '2026-10-01', weight_kg: 80 },
      { date: '2026-10-03', weight_kg: 81 },
      { date: '2026-10-07', weight_kg: 79 },
      { date: '2026-10-08', weight_kg: 78 },
    ])
    expect(tr.map(x => x.avg)).toEqual([80, 80.5, 80, 79.3])
    expect(tr.at(-1)!.samples).toBe(3)
  })

  it('estima semanas até o alvo, fibra e água', () => {
    expect(weeksToTarget(85, 80, 0.5)).toBe(10)
    expect(weeksToTarget(85, null, 0.5)).toBeNull()
    expect(fiberTarget('male', 31)).toBe(38)
    expect(fiberTarget('female', 60)).toBe(21)
    expect(waterTarget(80)).toBe(2750)
    expect(waterTarget(null)).toBe(2000)
  })
})
