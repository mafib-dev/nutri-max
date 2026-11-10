import { describe, expect, it } from 'vitest'
import { itemTotals, logForTime, manualDayFor, manualToMealPlan, mealTotals, moveWeekday, starterPlan, type ManualDay, type ManualItem } from './manualPlan'

const item = (grams: number, per100 = { kcal: 130, p: 2.5, c: 28, f: 0.2, fiber: 1.6 }): ManualItem => ({ id: 'i' + grams, food_id: 'arroz', name: 'Arroz', grams, measure: null, per100 })

describe('plano montado pela pessoa', () => {
  it('soma cada alimento pela quantidade', () => {
    expect(itemTotals(item(150))).toEqual({ kcal: 195, p: 3.8, c: 42, f: 0.3, fiber: 2.4 })
    expect(mealTotals([item(100), item(50)]).kcal).toBe(130 + 65)
  })

  it('começa com quatro refeições vazias valendo para todos os dias', () => {
    const p = starterPlan()
    expect(p.days).toHaveLength(1)
    expect(p.days[0].weekdays).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(p.days[0].meals.map(m => m.time)).toEqual(['07:00', '12:30', '16:00', '20:00'])
  })

  it('cada dia da semana fica em um cardápio só', () => {
    const p = starterPlan()
    const rest: ManualDay = { id: 'r', name: 'Descanso', weekdays: [], meals: [] }
    const moved = moveWeekday({ days: [...p.days, rest] }, 'r', 0)
    expect(moved.days[0].weekdays).not.toContain(0)
    expect(moved.days[1].weekdays).toEqual([0])
    expect(manualDayFor(moved, 0)!.name).toBe('Descanso')
    expect(manualDayFor(moved, 3)!.name).toBe('Todos os dias')
  })

  it('o horário diz em que refeição do diário ela entra', () => {
    expect(logForTime('06:30')).toBe('breakfast')
    expect(logForTime('12:00')).toBe('lunch')
    expect(logForTime('16:00')).toBe('snack')
    expect(logForTime('20:30')).toBe('dinner')
  })

  it('vira um plano no formato que o Hoje e o diário usam, na ordem dos horários', () => {
    const day: ManualDay = {
      id: 'd',
      name: 'Todos',
      weekdays: [1],
      meals: [
        { id: 'j', name: 'Jantar', time: '20:00', log: 'dinner', items: [item(100)] },
        { id: 'c', name: 'Pós-corrida', time: '07:30', log: 'breakfast', items: [item(200)] },
      ],
    }
    const plan = manualToMealPlan(day)
    expect(plan.meals.map(m => m.label)).toEqual(['Pós-corrida', 'Jantar'])
    expect(plan.meals[0].items[0].food.id).toBe('arroz')
    expect(plan.total.kcal).toBe(390)
  })
})
