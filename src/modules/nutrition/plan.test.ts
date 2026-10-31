import { describe, expect, it } from 'vitest'
import taco from '../../../scripts/data/taco-foods.json'
import { replanDay, optionsFor, withDefaults, buildPlan, buildSlots, buyAmount, DEFAULT_SETTINGS, equivalent, guidance, nextMeal, PLAN_FOODS, portion, roundGrams, shoppingList, substitutes, type PlanSettings } from './plan'
import { DEFAULT_ANAMNESIS } from './anamnesis'
import { RECIPE_INGREDIENTS, RECIPES } from './planFoodsMore'

const targets = { kcal: 2400, protein_g: 160, carbs_g: 290, fat_g: 67 }
const plan = (s: Partial<PlanSettings> = {}, t = targets) => buildPlan(t, { settings: { ...DEFAULT_SETTINGS, ...s }, picks: {} })

describe('alimentos do plano', () => {
  it('existem na TACO com os mesmos valores', () => {
    const byId = new Map((taco as { id: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }[]).map(f => [f.id, f]))
    for (const f of Object.values(PLAN_FOODS).filter(f => f.id !== 'whey' && !f.id.startsWith('recipe-'))) {
      const t = byId.get(f.id)
      expect(t, f.name).toBeDefined()
      expect([t!.kcal, t!.protein_g, t!.carbs_g, t!.fat_g], f.name).toEqual([f.kcal, f.p, f.c, f.f])
    }
  })
})

describe('preparações', () => {
  const byId = new Map((taco as { id: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }[]).map(f => [f.id, f]))
  it('somam os macros dos ingredientes da TACO', () => {
    for (const [key, r] of Object.entries(RECIPES)) {
      const { water, items } = RECIPE_INGREDIENTS[key]
      const total = items.reduce((a, [, g]) => a + g, 0) + water
      const sum = (k: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') => items.reduce((a, [id, g]) => a + (byId.get(id)![k] * g) / 100, 0) * (100 / total)
      expect(r.kcal, r.name).toBeCloseTo(sum('kcal'), 0)
      expect(r.p, r.name).toBeCloseTo(sum('protein_g'), 0)
      expect(r.c, r.name).toBeCloseTo(sum('carbs_g'), 0)
      expect(r.f, r.name).toBeCloseTo(sum('fat_g'), 0)
    }
  })
  it('entram na lista de compras como ingredientes', () => {
    const list = shoppingList(plan({ likes: ['crepioca'] }))
    expect(list.some(i => i.key === 'crepioca')).toBe(false)
    expect(list.find(i => i.key === 'taco-146')?.food.name).toBe('Goma de tapioca')
    expect(list.find(i => i.key === 'ovo')!.grams).toBeGreaterThan(0)
  })
  it('crepioca entra no café de quem gosta', () => {
    const p = plan({ likes: ['crepioca'] })
    const breakfast = p.meals.find(m => m.kind === 'breakfast')!
    expect(breakfast.items.some(i => i.key === 'crepioca')).toBe(true)
  })
})

describe('qualquer opção escolhida', () => {
  it('fecha o dia perto da meta', () => {
    const base = withDefaults(DEFAULT_SETTINGS)
    const slots = buildSlots(base)
    for (const slot of slots) {
      for (const role of ['protein', 'carb', 'legume', 'veg', 'salad', 'fruit', 'fat'] as const) {
        for (const key of optionsFor(slot.kind, role, base)) {
          const p = buildPlan(targets, { settings: base, picks: { [slot.key]: { [role]: key } } })
          const meal = p.meals.find(m => m.key === slot.key)!
          for (const i of meal.items) expect(i.grams, `${slot.key} ${key}`).toBeGreaterThan(0)
          expect(Math.abs(p.total.kcal - targets.kcal) / targets.kcal, `${slot.key} ${role} ${key}: ${Math.round(p.total.kcal)} kcal`).toBeLessThan(0.12)
        }
      }
    }
  })
})

describe('buildSlots', () => {
  it('5 refeições com pré-treino antes do treino da tarde', () => {
    const slots = buildSlots(DEFAULT_SETTINGS)
    expect(slots.map(s => [s.time, s.kind])).toEqual([
      ['07:30', 'breakfast'],
      ['10:00', 'morning_snack'],
      ['12:30', 'lunch'],
      ['17:00', 'pre_workout'],
      ['20:00', 'dinner'],
    ])
  })

  it('treino logo ao acordar: pré-treino leve e o café vira pós-treino', () => {
    const slots = buildSlots({ ...DEFAULT_SETTINGS, wake: '06:00', train: '07:00', meals: 6 })
    expect(slots.slice(0, 2).map(s => [s.time, s.label])).toEqual([
      ['06:15', 'Pré-treino leve'],
      ['08:30', 'Café da manhã (pós-treino)'],
    ])
    expect(slots.map(s => s.kind)).toContain('supper')
    expect(slots).toHaveLength(7)
  })

  it('em jejum, sem pré-treino; treino longo empurra o pós-treino', () => {
    const fasted = buildSlots({ ...DEFAULT_SETTINGS, wake: '06:00', train: '07:00', anamnesis: { ...DEFAULT_ANAMNESIS, training: { type: 'strength', minutes: 60, fasted: true } } })
    expect(fasted.map(s => s.kind)).not.toContain('pre_workout')
    const long = buildSlots({ ...DEFAULT_SETTINGS, wake: '06:00', train: '14:00', meals: 6, anamnesis: { ...DEFAULT_ANAMNESIS, training: { type: 'endurance', minutes: 90, fasted: false } } })
    expect(long.find(s => s.kind === 'post_workout')!.time).toBe('16:00')
  })

  it('3 refeições sem treino', () => {
    expect(buildSlots({ ...DEFAULT_SETTINGS, meals: 3, train: null }).map(s => s.log)).toEqual(['breakfast', 'lunch', 'dinner'])
  })

  it('quem dorme depois da meia-noite janta antes', () => {
    const slots = buildSlots({ ...DEFAULT_SETTINGS, wake: '09:00', sleep: '01:00', train: null })
    expect(slots.at(-1)!.time).toBe('22:00')
  })
})

describe('buildPlan', () => {
  it('fecha o dia perto da meta', () => {
    const big = { kcal: 3200, protein_g: 150, carbs_g: 450, fat_g: 89 }
    for (const [p, t] of [[plan(), targets], [plan({ meals: 6, train: '07:00', wake: '06:00' }, big), big], [plan({ meals: 4, train: null }), targets]] as const) {
      expect(Math.abs(p.total.kcal - t.kcal)).toBeLessThan(t.kcal * 0.05)
      expect(Math.abs(p.total.p - t.protein_g)).toBeLessThan(t.protein_g * 0.08)
    }
  })

  it('almoço tem salada, legume, feijão, proteína, carboidrato e azeite', () => {
    const lunch = plan().meals.find(m => m.kind === 'lunch')!
    expect(lunch.items.map(i => i.role)).toEqual(['salad', 'veg', 'legume', 'protein', 'carb', 'fat'])
    expect(lunch.items.every(i => i.grams > 0)).toBe(true)
  })

  it('almoço e jantar variam a proteína', () => {
    const [lunch, dinner] = plan().meals.filter(m => m.kind === 'lunch' || m.kind === 'dinner')
    expect(lunch.items.find(i => i.role === 'protein')!.key).not.toBe(dinner.items.find(i => i.role === 'protein')!.key)
  })

  it('respeita vegetariano, sem lactose e sem glúten', () => {
    const items = plan({ diet: 'vegetarian', noLactose: true, noGluten: true }).meals.flatMap(m => m.items)
    for (const i of items) expect(i.food.tags.some(t => ['meat', 'fish', 'lactose', 'gluten'].includes(t)), i.food.name).toBe(false)
  })

  it('usa a troca escolhida', () => {
    const lunchKey = plan().meals.find(m => m.kind === 'lunch')!.key
    const p = buildPlan(targets, { settings: DEFAULT_SETTINGS, picks: { [lunchKey]: { protein: 'merluza' } } })
    expect(p.meals.find(m => m.kind === 'lunch')!.items.find(i => i.role === 'protein')!.key).toBe('merluza')
  })

  it('não passa de 4 ovos nem de 250 g de fruta numa refeição', () => {
    for (const i of plan({ meals: 6, wake: '06:00', train: '07:00' }, { kcal: 3500, protein_g: 180, carbs_g: 500, fat_g: 95 }).meals.flatMap(m => m.items)) {
      if (i.key === 'ovo') expect(i.grams).toBeLessThanOrEqual(200)
      if (i.role === 'fruit') expect(i.grams).toBeLessThanOrEqual(250)
    }
  })
})

describe('consulta completa', () => {
  it('whey entra no pós-treino no lugar da proteína', () => {
    const p = plan({ meals: 6, wake: '06:00', train: '14:00', whey: { scoops: 1, scoopG: 30, when: 'post', food: null } })
    const post = p.meals.find(m => m.kind === 'post_workout')!
    expect(post.items.find(i => i.role === 'protein')!.key).toBe('whey')
    expect(post.items.filter(i => i.role === 'protein')).toHaveLength(1)
    expect(post.items.find(i => i.key === 'whey')!.grams).toBe(30)
  })

  it('whey depois do treino sem lanche pós-treino entra no jantar sem tirar a carne', () => {
    const dinner = plan({ whey: { scoops: 1, scoopG: 30, when: 'post', food: null } }).meals.find(m => m.kind === 'dinner')!
    const proteins = dinner.items.filter(i => i.role === 'protein').map(i => i.key)
    expect(proteins).toContain('whey')
    expect(proteins).toHaveLength(2)
  })

  it('usa o whey cadastrado com os valores do rótulo', () => {
    const food = { id: 'meu-whey', name: 'Whey Baunilha', kcal: 380, p: 76, c: 8, f: 6 }
    const p = plan({ whey: { scoops: 2, scoopG: 32, when: 'breakfast', food } })
    const w = p.meals[0].items.find(i => i.key === 'whey')!
    expect([w.food.id, w.food.name, w.grams]).toEqual(['meu-whey', 'Whey Baunilha', 64])
  })

  it('o que tem em casa vem primeiro', () => {
    expect(optionsFor('lunch', 'protein', withDefaults({ likes: ['carneMoida'] }))[0]).toBe('carneMoida')
  })

  it('orçamento curto prioriza o barato', () => {
    const opts = optionsFor('lunch', 'protein', withDefaults({ budget: 'low' }))
    expect(opts.indexOf('frango')).toBeLessThan(opts.indexOf('maminha'))
    expect(opts.slice(0, 3)).not.toContain('maminha')
  })

  it('consulta antiga ganha os valores padrão', () => {
    const old = { meals: 4, wake: '07:00', sleep: '23:00', train: null, diet: 'omnivore', noLactose: false, noGluten: false, noFish: false, noPork: false, dislikes: [] } as Partial<PlanSettings>
    expect(() => buildPlan(targets, { settings: old as PlanSettings, picks: {} })).not.toThrow()
    expect(withDefaults(old).whey.scoops).toBe(0)
  })

  it('almoço no restaurante traz a orientação', () => {
    expect(plan({ lunchAt: 'restaurant' }).meals.find(m => m.kind === 'lunch')!.note).toContain('restaurante')
  })
})

describe('porções', () => {
  it('arredonda ovo e pão em unidades', () => {
    expect(roundGrams(PLAN_FOODS.ovo, 130, 'protein')).toBe(150)
    expect(roundGrams(PLAN_FOODS.arroz, 123, 'carb')).toBe(125)
    expect(roundGrams(PLAN_FOODS.azeite, 7.4, 'fat')).toBe(7)
  })

  it('mostra a medida caseira', () => {
    expect(portion(PLAN_FOODS.ovo, 100)).toBe('2 ovos')
    expect(portion(PLAN_FOODS.arroz, 125)).toBe('125 g · 5 col. de sopa')
    expect(portion(PLAN_FOODS.frango, 50)).toBe('50 g · ½ filé médio')
  })

  it('substituição entrega a mesma proteína', () => {
    const item = { role: 'protein' as const, key: 'frango' as const, food: PLAN_FOODS.frango, grams: 100 }
    expect(equivalent(item, 'patinho').grams).toBe(90)
    expect(substitutes('lunch', item, DEFAULT_SETTINGS).map(s => s.key)).not.toContain('frango')
  })
})

describe('extras', () => {
  it('lista de compras soma a semana', () => {
    const list = shoppingList(plan())
    const rice = list.find(i => i.key === 'arroz')!
    const day = plan().meals.flatMap(m => m.items).filter(i => i.key === 'arroz').reduce((a, i) => a + i.grams, 0)
    expect(rice.grams).toBe(day * 7)
    expect(buyAmount(PLAN_FOODS.ovo, 1400)).toBe('28 ovos')
    expect(buyAmount(PLAN_FOODS.arroz, 1750)).toBe('1,8 kg')
  })

  it('orientações citam o treino quando há horário', () => {
    const g = guidance({ goal: 'lose', targets, weightKg: 80, waterMl: 2750, fiberG: 38, settings: DEFAULT_SETTINGS, meals: 5 })
    expect(g.map(x => x.title)).toContain('Comida em volta do treino')
    expect(g[0].text).toContain('2 g por kg')
  })

  it('próxima refeição', () => {
    const p = plan()
    expect(nextMeal(p, 11 * 60)!.kind).toBe('lunch')
    expect(nextMeal(p, 23 * 60)).toBeNull()
  })
})

describe('replanDay', () => {
  const none = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  it('dia em dia: nada muda', () => {
    const full = plan()
    const morning = full.meals.slice(0, 2)
    const eaten = { kcal: morning.reduce((a, m) => a + m.total.kcal, 0), protein_g: morning.reduce((a, m) => a + m.total.p, 0), carbs_g: morning.reduce((a, m) => a + m.total.c, 0), fat_g: morning.reduce((a, m) => a + m.total.f, 0) }
    const d = replanDay(targets, { settings: DEFAULT_SETTINGS, picks: {} }, eaten, ['breakfast', 'snack'], 12 * 60)
    expect(d.adjusted).toBe(false)
    expect(d.skipped).toEqual([])
    expect(d.rest.map(m => m.kind)).toEqual(['lunch', 'pre_workout', 'dinner'])
  })

  it('pulou o café: aponta e reparte nas próximas', () => {
    const d = replanDay(targets, { settings: DEFAULT_SETTINGS, picks: {} }, none, [], 11 * 60)
    expect(d.skipped.map(s => s.kind)).toEqual(['breakfast'])
    expect(d.adjusted).toBe(true)
    const normal = plan().meals.find(m => m.kind === 'lunch')!.total.kcal
    const now = d.rest.find(m => m.kind === 'lunch')!.total.kcal
    expect(now).toBeGreaterThan(normal)
    expect(now).toBeLessThan(normal * 1.6)
    expect(d.missing.kcal).toBe(2400)
  })

  it('fim do dia: nada mais para planejar', () => {
    const d = replanDay(targets, { settings: DEFAULT_SETTINGS, picks: {} }, none, [], 23.5 * 60)
    expect(d.rest).toEqual([])
    expect(d.skipped).toHaveLength(5)
  })
})
