import { describe, expect, it } from 'vitest'
import { MUSCLES, MUSCLE_NAME_PT, toMuscle, toMuscles } from './muscles'

describe('toMuscle', () => {
  it('mapeia os nomes do free-exercise-db', () => {
    expect(toMuscle('lats')).toBe('upper-back')
    expect(toMuscle('middle back')).toBe('upper-back')
    expect(toMuscle('Lower Back')).toBe('lower-back')
    expect(toMuscle('glutes')).toBe('gluteal')
    expect(toMuscle('shoulders')).toBe('deltoids')
  })

  it('aceita os nomes canônicos', () => {
    for (const m of MUSCLES) expect(toMuscle(m)).toBe(m)
  })

  it('devolve null para nomes desconhecidos', () => {
    expect(toMuscle('cardiovascular system')).toBeNull()
  })
})

describe('toMuscles', () => {
  it('remove repetidos e ordena da cabeça aos pés', () => {
    expect(toMuscles(['quadriceps', 'lats', 'middle back', 'traps'])).toEqual([
      'trapezius', 'upper-back', 'quadriceps',
    ])
  })
})

it('todo músculo tem nome em português', () => {
  for (const m of MUSCLES) expect(MUSCLE_NAME_PT[m]).toBeTruthy()
})
