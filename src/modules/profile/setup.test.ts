import { describe, expect, it } from 'vitest'
import { firstOpenStep, isComplete, parseNumber, readLook, stepError, toNutritionProfile, type ProfileSetup } from './setup'

const empty: ProfileSetup = { display_name: null, sex: null, birth_date: null, height_cm: null, weight_kg: null, goal: null, target_weight_kg: null, activity_level: null, level: null }
const full: ProfileSetup = { display_name: 'Ana', sex: 'female', birth_date: '1995-06-15', height_cm: 165, weight_kg: 62, goal: 'lose', target_weight_kg: 58, activity_level: 'moderate', level: null }
const today = new Date('2026-10-30T12:00:00')

describe('isComplete', () => {
  it('pede nome, sexo, nascimento, altura, peso, objetivo e atividade', () => {
    expect(isComplete(full)).toBe(true)
    expect(isComplete(empty)).toBe(false)
    expect(isComplete({ ...full, display_name: '  ' })).toBe(false)
    expect(isComplete({ ...full, weight_kg: null })).toBe(false)
  })
})

describe('stepError', () => {
  it('valida cada passo', () => {
    expect(stepError('name', empty)).toMatch(/chamar/)
    expect(stepError('birth', { ...full, birth_date: '2020-01-01' }, today)).toMatch(/13 anos/)
    expect(stepError('body', { ...full, height_cm: 1.65 })).toMatch(/centímetros/)
    expect(stepError('goal', { ...full, target_weight_kg: 70 })).toMatch(/abaixo/)
    expect(stepError('goal', { ...full, goal: 'gain', target_weight_kg: 60 })).toMatch(/acima/)
    for (const s of ['name', 'sex', 'birth', 'body', 'goal', 'activity'] as const) expect(stepError(s, full, today)).toBeNull()
  })

  it('começa no primeiro passo que falta', () => {
    expect(firstOpenStep(empty)).toBe(0)
    expect(firstOpenStep({ ...full, height_cm: null })).toBe(3)
    expect(firstOpenStep(full)).toBe(0)
  })
})

describe('parseNumber', () => {
  it('aceita vírgula', () => {
    expect(parseNumber('80,5')).toBe(80.5)
    expect(parseNumber(' ')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
  })
})

describe('toNutritionProfile', () => {
  it('mantém os ajustes antigos e tira o peso-alvo de quem quer manter', () => {
    const p = toNutritionProfile({ ...full, goal: 'maintain' }, { kcal_target: 2000, add_workout_kcal: false })
    expect(p).toMatchObject({ kcal_target: 2000, add_workout_kcal: false, goal: 'maintain', target_weight_kg: null, height_cm: 165 })
  })
})

describe('readLook', () => {
  it('lê a aparência e corrige valores inválidos', () => {
    expect(readLook({ avatar: { skin: 3, hair: 2 } })).toEqual({ skin: 3, hair: 2 })
    expect(readLook({ avatar: { skin: 99, hair: 'x' } })).toEqual({ skin: 1, hair: 0 })
    expect(readLook({})).toBeNull()
    expect(readLook(null)).toBeNull()
  })
})
