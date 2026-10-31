import { describe, expect, it } from 'vitest'
import { assessment, clinicalGuidance, DEFAULT_ANAMNESIS, nextReturn, redFlags, supplementProtocol, withAnamnesisDefaults, type Anamnesis } from './anamnesis'
import { buildPlan, DEFAULT_SETTINGS, optionsFor } from './plan'

const a = (patch: Partial<Anamnesis>): Anamnesis => ({ ...DEFAULT_ANAMNESIS, ...patch })
const opts = { train: '18:00', sleep: '23:00', waterMl: 2750 }

describe('anamnese', () => {
  it('consulta antiga ganha os padrões', () => {
    const x = withAnamnesisDefaults({ training: { minutes: 90 } } as Partial<Anamnesis>)
    expect(x.training).toEqual({ type: 'strength', minutes: 90, fasted: false })
    expect(x.supplements.omega3).toBe(false)
  })

  it('alerta rins, gestação, transtorno alimentar e hipoglicemia', () => {
    expect(redFlags(DEFAULT_ANAMNESIS)).toEqual([])
    expect(redFlags(a({ conditions: ['kidney', 'pregnant', 'eating_disorder'] })).map(f => f.title)).toHaveLength(3)
    expect(redFlags(a({ conditions: ['diabetes'], medications: 'Insulina NPH' }))[0].title).toMatch(/glicose/)
    expect(redFlags(a({ conditions: ['diabetes'], medications: 'metformina' }))).toEqual([])
  })

  it('orientações saem da saúde e dos hábitos', () => {
    const titles = clinicalGuidance(a({ conditions: ['hypertension', 'hypothyroid'], bowel: 'constipated', waterL: 1, alcohol: 'weekend', training: { type: 'endurance', minutes: 90, fasted: true } }), opts).map(g => g.title)
    expect(titles).toEqual(['Treino em jejum', 'Treinos longos', 'Pressão alta', 'Remédio da tireoide', 'Intestino preso', 'Água', 'Álcool'])
    expect(clinicalGuidance(DEFAULT_ANAMNESIS, opts)).toEqual([])
  })

  it('cafeína por peso, com teto e aviso de treino perto do sono', () => {
    const rows = supplementProtocol(a({ supplements: { ...DEFAULT_ANAMNESIS.supplements, caffeine: true, omega3: true } }), { weightKg: 80, whey: { scoops: 1, scoopG: 30, when: 'post' }, creatine: true, train: '19:00', sleep: '23:00' })
    expect(rows.map(r => r.name)).toEqual(['Whey protein', 'Creatina', 'Cafeína', 'Ômega-3'])
    expect(rows[2].dose).toMatch(/^240 mg/)
    expect(rows[2].when).toMatch(/menos de 6 horas/)
    const pregnant = supplementProtocol(a({ conditions: ['pregnant'], supplements: { ...DEFAULT_ANAMNESIS.supplements, caffeine: true } }), { weightKg: 90, whey: { scoops: 0, scoopG: 30, when: 'post' }, creatine: false, train: null, sleep: '23:00' })
    expect(pregnant[0].dose).toMatch(/^200 mg/)
  })

  it('saúde muda o cardápio: embutido sai com pressão alta, integral vem primeiro com diabetes', () => {
    const htn = { ...DEFAULT_SETTINGS, anamnesis: a({ conditions: ['hypertension'] }) }
    expect(optionsFor('breakfast', 'protein', htn)).not.toContain('presunto')
    const dm = { ...DEFAULT_SETTINGS, anamnesis: a({ conditions: ['diabetes'] }) }
    expect(optionsFor('lunch', 'carb', dm)[0]).toBe('integral')
    expect(optionsFor('breakfast', 'carb', dm).indexOf('paoFrances')).toBeGreaterThan(optionsFor('breakfast', 'carb', dm).indexOf('paoIntegral'))
  })

  it('treino longo põe mais carboidrato no pré-treino', () => {
    const t = { kcal: 2400, protein_g: 160, carbs_g: 290, fat_g: 67 }
    const pre = (minutes: number) => buildPlan(t, { settings: { ...DEFAULT_SETTINGS, anamnesis: a({ training: { type: 'strength', minutes, fasted: false } }) }, picks: {} }).meals.find(m => m.kind === 'pre_workout')!.target.c
    expect(pre(90)).toBeGreaterThan(pre(60) * 1.2)
  })
})

describe('avaliação', () => {
  it('IMC, gasto e metas por kg', () => {
    const p = { sex: 'male' as const, birth_date: '1995-06-15', height_cm: 180, activity_level: 'moderate' as const, goal: 'lose' as const, kcal_target: null, protein_target_g: null, carbs_target_g: null, fat_target_g: null, target_weight_kg: null, weekly_rate_kg: null, add_workout_kcal: true }
    const r = assessment(p, 80, { kcal: 2200, protein_g: 160, carbs_g: 240, fat_g: 66 }, new Date('2026-10-31T12:00:00'))!
    expect(r.bmi).toBe(24.7)
    expect(r.bmiClass).toBe('peso adequado')
    expect(r.bmr).toBe(1775)
    expect(r.tdee).toBe(2751)
    expect(r.balance).toBe(-551)
    expect(r.perKg).toEqual({ protein: 2, carbs: 3, fat: 0.8 })
    expect(r.percent.protein + r.percent.carbs + r.percent.fat).toBeGreaterThanOrEqual(99)
    expect(assessment({ ...p, sex: null }, 80, { kcal: 2200, protein_g: 160, carbs_g: 240, fat_g: 66 })).toBeNull()
  })

  it('retorno em 15 dias, ou 30 para manter', () => {
    expect(nextReturn('2026-10-31T12:00:00Z', 'lose')!.toISOString().slice(0, 10)).toBe('2026-11-15')
    expect(nextReturn('2026-10-31T12:00:00Z', 'maintain')!.toISOString().slice(0, 10)).toBe('2026-11-30')
    expect(nextReturn(undefined, 'lose')).toBeNull()
  })
})
