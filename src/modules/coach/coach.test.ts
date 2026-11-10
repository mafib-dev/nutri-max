import { describe, expect, it } from 'vitest'
import { coachContext, validateActions, type CoachRaw } from './coach'
import { buildPlan, buildSlots, DEFAULT_SETTINGS, replanDay } from '../nutrition/plan'
import type { FoodLog } from '../nutrition/foods'

const saved = { settings: DEFAULT_SETTINGS, picks: {} }
const lunch = buildSlots(DEFAULT_SETTINGS).find(s => s.kind === 'lunch')!.key
const targets = { kcal: 2400, protein_g: 160, carbs_g: 290, fat_g: 67 }

describe('validateActions', () => {
  it('mantém só ações conhecidas e com valores possíveis', () => {
    const out = validateActions(
      [
        { tipo: 'registrar_agua', ml: 500 },
        { tipo: 'registrar_agua', ml: 50000 },
        { tipo: 'lancar_refeicao', slot: lunch, rotulo: 'Lançar o almoço' },
        { tipo: 'lancar_refeicao', slot: 'inventado' },
        { tipo: 'apagar_tudo' },
        { tipo: 'registrar_peso', kg: 79.46 },
      ],
      saved,
    )
    expect(out).toEqual([
      { tipo: 'registrar_agua', rotulo: 'Registrar 500 ml de água', ml: 500 },
      { tipo: 'lancar_refeicao', rotulo: 'Lançar o almoço', slot: lunch },
      { tipo: 'registrar_peso', rotulo: 'Registrar 79.46 kg', kg: 79.5 },
    ])
  })

  it('sem plano, nada de lançar refeição ou ajustar plano', () => {
    expect(validateActions([{ tipo: 'lancar_refeicao', slot: lunch }, { tipo: 'ajustar_plano', consulta: { budget: 'low' } }], null)).toEqual([])
  })

  it('no máximo 3 e aguenta lixo', () => {
    expect(validateActions(Array(6).fill({ tipo: 'registrar_agua', ml: 250 }), saved)).toHaveLength(3)
    for (const raw of [null, 'x', 3, {}, [null, 'x']]) expect(validateActions(raw, saved)).toEqual([])
  })
})

describe('coachContext', () => {
  it('resume o dia com as refeições puladas e o que falta', () => {
    const now = new Date('2026-10-29T11:00:00')
    const logs: FoodLog[] = []
    const raw: CoachRaw = {
      now,
      name: 'Matheus',
      profile: { sex: 'male', birth_date: '1995-06-15', height_cm: 180, activity_level: 'moderate', goal: 'lose', kcal_target: null, protein_target_g: null, carbs_target_g: null, fat_target_g: null, target_weight_kg: 76, weekly_rate_kg: 0.5, add_workout_kcal: true },
      weights: [{ date: '2026-10-28', weight_kg: 79.5 }],
      trend: 79.7,
      targets,
      trainingKcal: 0,
      logs,
      waterMl: 500,
      waterGoal: 2750,
      week: { days: 3, avgKcal: 2500, avgProtein: 140, proteinDays: 1 },
      workoutsToday: [],
      todaysRoutine: 'Treino A',
      recentWorkouts: [],
      weekWorkouts: { done: 2, planned: 4 },
      tiredMuscles: ['Peito'],
      saved,
      plan: buildPlan(targets, saved),
      day: replanDay(targets, saved, { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, [], 11 * 60),
    }
    const ctx = coachContext(raw)
    expect(ctx.pessoa.objetivo).toBe('Perder gordura')
    expect(ctx.plano!.hoje!.refeicoes_puladas.map(r => r.refeicao)).toEqual(['Café da manhã'])
    expect(ctx.plano!.hoje!.falta_hoje.kcal).toBe(2400)
    expect(ctx.treino.musculos_cansados).toEqual(['Peito'])
    expect(JSON.stringify(ctx).length).toBeLessThan(40000)
  })
})
