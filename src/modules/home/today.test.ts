import { describe, expect, it } from 'vitest'
import { dayTips, daysBetween, greeting, waterExpected, weekNutrition, type DayContext } from './today'

const base: DayContext = {
  hour: 14,
  goal: 'gain',
  targets: { kcal: 3000, protein_g: 160, carbs_g: 400, fat_g: 80 },
  eaten: { kcal: 1500, protein_g: 80, carbs_g: 200, fat_g: 40 },
  logged: 5,
  trainedToday: false,
  trainingKcal: 0,
  workoutPending: false,
  waterMl: 1500,
  waterGoal: 3000,
  week: { days: 0, avgKcal: 0, avgProtein: 0, proteinDays: 0 },
  weightKg: 80,
  daysSinceWeighIn: 1,
  tiredMuscles: [],
}

describe('greeting', () => {
  it('muda ao longo do dia', () => {
    expect(greeting(8)).toBe('Bom dia')
    expect(greeting(13)).toBe('Boa tarde')
    expect(greeting(20)).toBe('Boa noite')
    expect(greeting(2)).toBe('Boa noite')
  })
})

describe('waterExpected', () => {
  it('vai de zero às 7h até a meta às 22h', () => {
    expect(waterExpected(3000, 6)).toBe(0)
    expect(waterExpected(3000, 14.5)).toBe(1500)
    expect(waterExpected(3000, 23)).toBe(3000)
  })
})

describe('weekNutrition', () => {
  it('ignora hoje e conta os dias com proteína perto da meta', () => {
    const rows = [
      { date: '2026-10-27', kcal: 2000, protein_g: 150, carbs_g: 0, fat_g: 0 },
      { date: '2026-10-27', kcal: 500, protein_g: 10, carbs_g: 0, fat_g: 0 },
      { date: '2026-10-28', kcal: 1500, protein_g: 80, carbs_g: 0, fat_g: 0 },
      { date: '2026-10-29', kcal: 900, protein_g: 0, carbs_g: 0, fat_g: 0 },
    ]
    expect(weekNutrition(rows, '2026-10-29', 160)).toEqual({ days: 2, avgKcal: 2000, avgProtein: 120, proteinDays: 1 })
  })
})

describe('dayTips', () => {
  it('cobra proteína depois do treino', () => {
    const tips = dayTips({ ...base, trainedToday: true, trainingKcal: 250 })
    expect(tips[0].text).toContain('Faltam 80 g de proteína')
    expect(tips.some(t => t.text.includes('250 kcal'))).toBe(true)
  })

  it('avisa da água atrasada e do peso antigo', () => {
    const tips = dayTips({ ...base, waterMl: 250, daysSinceWeighIn: 10 })
    expect(tips.some(t => t.text.startsWith('Água abaixo'))).toBe(true)
    expect(tips.some(t => t.text.includes('10 dias'))).toBe(true)
  })

  it('pede as metas quando faltam dados', () => {
    expect(dayTips({ ...base, targets: null })[0].text).toContain('metas de nutrição')
  })

  it('à noite lembra de comer mais para ganhar massa', () => {
    expect(dayTips({ ...base, hour: 20, waterMl: 3000 }).some(t => t.text.includes('faltam 1.500 kcal'))).toBe(true)
  })

  it('compara a média da semana com a meta', () => {
    const week = { days: 5, avgKcal: 2750, avgProtein: 150, proteinDays: 4 }
    expect(dayTips({ ...base, goal: 'lose', targets: { ...base.targets!, kcal: 2400 }, week }).some(t => t.text.includes('350 kcal acima'))).toBe(true)
  })

  it('mostra no máximo 4', () => {
    const tips = dayTips({ ...base, targets: null, waterMl: 0, daysSinceWeighIn: null, tiredMuscles: ['Peito'], workoutPending: true })
    expect(tips.length).toBeLessThanOrEqual(4)
  })
})

describe('daysBetween', () => {
  it('conta dias de calendário', () => expect(daysBetween('2026-10-20', '2026-10-29')).toBe(9))
})
