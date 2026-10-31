import { describe, expect, it } from 'vitest'
import { buddyLines, buddyPose, type BuddyContext } from './buddy'

const base: BuddyContext = {
  hour: 9,
  name: 'Matheus',
  inWorkout: false,
  trainedToday: false,
  pendingRoutine: null,
  waterMl: 500,
  waterGoal: 2750,
  proteinLeft: 120,
  kcalLeft: 1800,
  nextMeal: null,
  tip: null,
}

describe('buddyPose', () => {
  it('segue o dia', () => {
    expect(buddyPose(base)).toBe('idle')
    expect(buddyPose({ ...base, pendingRoutine: 'Treino A' })).toBe('train')
    expect(buddyPose({ ...base, trainedToday: true })).toBe('celebrate')
    expect(buddyPose({ ...base, inWorkout: true, trainedToday: true })).toBe('train')
    expect(buddyPose({ ...base, hour: 23.5, trainedToday: true })).toBe('sleep')
    expect(buddyPose({ ...base, hour: 3 })).toBe('sleep')
  })
})

describe('buddyLines', () => {
  it('cumprimenta pelo nome e fala do treino, água e proteína', () => {
    expect(buddyLines({ ...base, pendingRoutine: 'Treino A', nextMeal: 'Almoço às 12:30', tip: 'Dica.' })).toEqual([
      'Bom dia, Matheus! Bora começar bem?',
      'Hoje tem Treino A. Vamos treinar?',
      'Faltam 2,25 L de água hoje.',
      'Ainda faltam 120 g de proteína.',
      'Próxima refeição: Almoço às 12:30.',
      'Dica.',
    ])
  })

  it('comemora metas batidas e funciona sem nome nem metas', () => {
    const lines = buddyLines({ ...base, hour: 20, name: null, trainedToday: true, waterMl: 3000, proteinLeft: 0 })
    expect(lines).toEqual(['Boa noite! Vamos fechar o dia bem.', 'Treino de hoje feito. Mandou bem!', 'Meta de água cumprida!', 'Proteína do dia batida!'])
    expect(buddyLines({ ...base, proteinLeft: null })).toHaveLength(3)
  })
})
