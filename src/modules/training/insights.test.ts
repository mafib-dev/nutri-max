import { describe, expect, it } from 'vitest'
import { recoveryByMuscle, setsByMuscle, weekStart, weeklyTotals } from './insights'
import { toTrainingState } from './state'

const BENCH = '0025' // supino reto: peito principal, tríceps e ombros secundários
const NOW = new Date('2026-10-28T18:00:00').getTime() // quarta-feira

function stateWith(days: string[], weight = 60) {
  return toTrainingState(
    days.map((d, i) => ({
      id: `w${i}`, routine_id: null, name: null, started_at: new Date(d).toISOString(), ended_at: null,
      body_weight_kg: null, exclude_from_progression: false,
    })),
    days.flatMap((_, i) =>
      [0, 1, 2].map(s => ({
        workout_id: `w${i}`, exercise_id: BENCH, entry_position: 0, set_index: s, kind: 'work' as const,
        weight_kg: weight, reps: 8, duration_sec: null, rir: null, side: null, done: true,
      })),
    ),
  )
}

describe('weekStart', () => {
  it('volta para a segunda-feira à meia-noite', () => {
    expect(new Date(weekStart(NOW)).toString()).toBe(new Date('2026-10-26T00:00:00').toString())
  })
})

describe('recoveryByMuscle', () => {
  it('peito cansado logo depois do supino, pronto depois de alguns dias', () => {
    const state = stateWith(['2026-10-28T10:00:00'])
    const now = recoveryByMuscle(state, NOW)
    expect(now[0].muscle).toBe('chest')
    expect(now[0].fatigue).toBeGreaterThan(0)
    expect(now[0].state).not.toBe('ready')
    expect(now[0].readyInMs).toBeGreaterThan(0)
    expect(now.find(m => m.muscle === 'quadriceps')?.state).toBe('ready')

    const later = recoveryByMuscle(state, NOW + 5 * 86400000)
    expect(later.find(m => m.muscle === 'chest')?.state).toBe('ready')
  })
})

describe('weeklyTotals', () => {
  it('soma séries, volume e treinos por semana', () => {
    const state = stateWith(['2026-10-27T10:00:00', '2026-10-28T10:00:00', '2026-10-20T10:00:00'])
    const weeks = weeklyTotals(state, 3, NOW)
    expect(weeks.map(w => w.workouts)).toEqual([0, 1, 2])
    expect(weeks[2]).toMatchObject({ sets: 6, volume: 6 * 60 * 8 })
  })
})

describe('setsByMuscle', () => {
  it('conta só o músculo principal e compara com a média das 4 semanas anteriores', () => {
    const state = stateWith(['2026-10-27T10:00:00', '2026-10-20T10:00:00', '2026-10-06T10:00:00', '2026-09-01T10:00:00'])
    const rows = setsByMuscle(state, NOW)
    expect(rows).toEqual([{ muscle: 'chest', thisWeek: 3, average: 6 / 4 }])
  })
})
