import { describe, expect, it } from 'vitest'
import tacoFoods from '../../../scripts/data/taco-foods.json'
import tacoPortions from '../../../scripts/data/taco-portions.json'
import type { Food } from './foods'
import { arrangeSlots, DEFAULT_SETTINGS, diaryMeal, equivalentGrams, formatWeight, generatePlan, MEAL_PRESETS, measureFor, planFoodChoices, ROLES, shoppingList, swapItem, targetsChanged, type PlanSettings } from './mealPlan'
import type { Portion } from './portions'

const portions = tacoPortions as Record<string, Portion[]>
const foods: Food[] = tacoFoods.map(f => ({
  ...f,
  fiber_g: f.fiber_g ?? null,
  sodium_mg: f.sodium_mg ?? null,
  owner_id: null,
  serving_name: null,
  serving_g: null,
  barcode: null,
  source: 'taco' as const,
  portions: portions[f.id] ?? [],
}))
const byId = new Map(foods.map(f => [f.id, f]))

const base = { weightKg: 80, goal: 'lose' as const, fiberTarget: 38, waterMl: 2750, foods, now: new Date('2026-11-09T12:00:00Z') }
const settings = (s: Partial<PlanSettings> = {}): PlanSettings => ({ ...DEFAULT_SETTINGS, training_time: '18:00', ...s })

describe('plano alimentar', () => {
  it('todos os alimentos do plano existem na TACO e têm medida caseira', () => {
    for (const def of Object.values(ROLES))
      for (const x of def.candidates) {
        expect(byId.has(x.id), x.id).toBe(true)
        expect(portions[x.id]?.length ?? 0, `${x.id} ${x.label}`).toBeGreaterThan(0)
      }
  })

  it('bate as metas do exemplo (2.400 kcal) com 5 refeições e treino às 18h', () => {
    const plan = generatePlan({ ...base, targets: { kcal: 2400, protein_g: 159, carbs_g: 290, fat_g: 67 }, settings: settings() })
    expect(plan.meals.map(m => m.label)).toEqual(['Café da manhã', 'Lanche da manhã', 'Almoço', 'Pré-treino', 'Jantar'])
    expect(plan.meals[3].time).toBe('17:00')
    expect(Math.abs(plan.total.kcal - 2400) / 2400).toBeLessThan(0.05)
    expect(Math.abs(plan.total.protein_g - 159) / 159).toBeLessThan(0.1)
    expect(Math.abs(plan.total.carbs_g - 290) / 290).toBeLessThan(0.15)
    expect(Math.abs(plan.total.fat_g - 67) / 67).toBeLessThan(0.2)
    // Almoço e jantar com proteínas diferentes.
    const mains = plan.meals.filter(m => m.kind === 'main').map(m => m.items.find(i => i.role === 'protein_main')!.food_id)
    expect(new Set(mains).size).toBe(2)
  })

  it.each([
    [1500, 120, 150, 45, 3],
    [1800, 140, 180, 55, 4],
    [3200, 160, 450, 85, 6],
    [3800, 180, 550, 100, 6],
  ])('fica perto de %i kcal com %i g de proteína', (kcal, protein_g, carbs_g, fat_g, n) => {
    for (const seed of [0, 1, 2, 3]) {
      const plan = generatePlan({ ...base, targets: { kcal, protein_g, carbs_g, fat_g }, settings: settings({ slots: MEAL_PRESETS[n], seed }) })
      expect(Math.abs(plan.total.kcal - kcal) / kcal, `seed ${seed}`).toBeLessThan(0.08)
      expect(Math.abs(plan.total.protein_g - protein_g) / protein_g, `seed ${seed}`).toBeLessThan(0.12)
    }
  })

  it('cada item tem quantidade arredondada, medida caseira e trocas equivalentes', () => {
    const plan = generatePlan({ ...base, targets: { kcal: 2400, protein_g: 159, carbs_g: 290, fat_g: 67 }, settings: settings() })
    for (const m of plan.meals)
      for (const i of m.items) {
        expect(i.grams).toBeGreaterThan(0)
        expect(i.measure, i.name).not.toBeNull()
        if (i.role !== 'oil') expect(i.subs.length).toBeGreaterThan(0)
        for (const s of i.subs) expect(s.food_id).not.toBe(i.food_id)
      }
    const eggs = plan.meals.flatMap(m => m.items).find(i => i.food_id === 'taco-488')
    if (eggs) expect(eggs.grams % 50).toBe(0)
  })

  it('não usa o que a pessoa marcou que não come, nem nas trocas', () => {
    const excluded = ['taco-410', 'taco-377', 'taco-488', 'taco-3']
    const plan = generatePlan({ ...base, targets: { kcal: 2400, protein_g: 159, carbs_g: 290, fat_g: 67 }, settings: settings({ excluded }) })
    const ids = plan.meals.flatMap(m => m.items.flatMap(i => [i.food_id, ...i.subs.map(s => s.food_id)]))
    for (const id of excluded) expect(ids).not.toContain(id)
  })

  it('gera outro cardápio com outra semente', () => {
    const t = { kcal: 2400, protein_g: 159, carbs_g: 290, fat_g: 67 }
    const a = generatePlan({ ...base, targets: t, settings: settings({ seed: 0 }) })
    const b = generatePlan({ ...base, targets: t, settings: settings({ seed: 1 }) })
    expect(a.meals.flatMap(m => m.items.map(i => i.food_id))).not.toEqual(b.meals.flatMap(m => m.items.map(i => i.food_id)))
  })

  it('troca um alimento pelo equivalente e refaz os totais', () => {
    const plan = generatePlan({ ...base, targets: { kcal: 2400, protein_g: 159, carbs_g: 290, fat_g: 67 }, settings: settings() })
    const mi = plan.meals.findIndex(m => m.kind === 'main')
    const ii = plan.meals[mi].items.findIndex(i => i.role === 'protein_main')
    const sub = plan.meals[mi].items[ii].subs[0]
    const next = swapItem(plan, mi, ii, sub.food_id, foods)
    const item = next.meals[mi].items[ii]
    expect(item.food_id).toBe(sub.food_id)
    expect(item.subs.map(s => s.food_id)).toContain(plan.meals[mi].items[ii].food_id)
    expect(Math.abs(item.protein_g - plan.meals[mi].items[ii].protein_g)).toBeLessThan(8)
    expect(next.total.kcal).toBe(next.meals.reduce((a, m) => a + m.total.kcal, 0))
  })

  it('equivalência pela proteína: 4 ovos ≈ 150 g de queijo minas', () => {
    expect(equivalentGrams(byId.get('taco-488')!, 200, byId.get('taco-461')!, 'protein_breakfast')).toBe(150)
    expect(measureFor(byId.get('taco-488')!, 200)).toBe('4 ovos')
    expect(measureFor(byId.get('taco-561')!, 120)).toBe('1,5 conchas')
  })

  it('lista de compras: unidades para o que se conta e cru para o que se cozinha', () => {
    const plan = generatePlan({ ...base, targets: { kcal: 2400, protein_g: 159, carbs_g: 290, fat_g: 67 }, settings: settings() })
    const items = plan.shopping.flatMap(g => g.items)
    const rice = items.find(i => i.food_id === 'taco-3' || i.food_id === 'taco-1')
    if (rice) {
      expect(rice.amount).toMatch(/ cru$/)
      expect(rice.note).toMatch(/cozido$/)
    }
    expect(plan.shopping[0].title).toBe('Proteínas')
    const meals = [{ kind: 'breakfast' as const, label: 'Café', time: '07:00', total: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, items: [{ ...plan.meals[0].items[0], food_id: 'taco-488', name: 'Ovo cozido', role: 'protein_breakfast' as const, grams: 200 }] }]
    expect(shoppingList(meals, foods)[0].items[0].amount).toBe('28 ovos')
    expect(formatWeight(1790)).toBe('1,8 kg')
    expect(formatWeight(723)).toBe('700 g')
  })

  it('transforma o lanche antes do treino em pré-treino', () => {
    const s = arrangeSlots(MEAL_PRESETS[4], '07:00')
    expect(s.some(x => x.kind === 'pre_workout')).toBe(false)
    const t = arrangeSlots(MEAL_PRESETS[6], '17:30')
    expect(t.find(x => x.kind === 'pre_workout')).toEqual({ kind: 'pre_workout', label: 'Pré-treino', time: '16:30' })
  })

  it('leva cada refeição para o lugar certo do diário', () => {
    expect(diaryMeal({ kind: 'snack', time: '10:00' })).toBe('snack')
    expect(diaryMeal({ kind: 'main', time: '12:30' })).toBe('lunch')
    expect(diaryMeal({ kind: 'main', time: '20:00' })).toBe('dinner')
    expect(diaryMeal({ kind: 'breakfast', time: '09:00' })).toBe('breakfast')
  })

  it('avisa quando as metas mudaram desde o plano', () => {
    const plan = generatePlan({ ...base, targets: { kcal: 2400, protein_g: 159, carbs_g: 290, fat_g: 67 }, settings: settings() })
    expect(targetsChanged(plan, { kcal: 2450, protein_g: 159, carbs_g: 300, fat_g: 67 })).toBe(false)
    expect(targetsChanged(plan, { kcal: 2200, protein_g: 159, carbs_g: 250, fat_g: 67 })).toBe(true)
  })

  it('lista os alimentos para marcar o que não come, sem repetir', () => {
    const ids = planFoodChoices().flatMap(g => g.foods.map(f => f.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
