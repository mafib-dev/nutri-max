import { describe, expect, it } from 'vitest'
import { buildSession, newRecords, sessionToRows, sessionVolume } from './session'
import { toTrainingState, type RoutineExerciseRow } from './state'
import { explain } from './why'

const BENCH = '0025'
const row: RoutineExerciseRow = {
  routine_id: 'r1',
  exercise_id: BENCH,
  sets: 3,
  rep_min: 5,
  rep_max: 5,
  rest_sec: 120,
  progression: { policy: 'linear' },
}

const history = toTrainingState(
  [{ id: 'w1', routine_id: 'r1', name: 'Peito', started_at: '2026-10-20T10:00:00Z', ended_at: null, body_weight_kg: null, exclude_from_progression: false }],
  [0, 1, 2].map(i => ({
    workout_id: 'w1', exercise_id: BENCH, entry_position: 0, set_index: i, kind: 'work' as const,
    weight_kg: 60, reps: 5, duration_sec: null, rir: null, side: null, done: true,
  })),
)

describe('buildSession', () => {
  it('preenche as séries com a carga sugerida pela progressão', () => {
    const s = buildSession(history, { id: 'r1', name: 'Peito' }, [{ row, name: 'Supino reto' }])
    expect(s.entries[0].sets).toHaveLength(3)
    expect(s.entries[0].sets[0]).toMatchObject({ weight: 62.5, reps: 5, done: false })
    expect(s.entries[0].restSec).toBe(120)
    expect(explain(s.entries[0].suggestion.why)).toBe('Fez todas as repetições. Mais 2,5 kg.')
  })

  it('começa sem carga quando não há histórico', () => {
    const s = buildSession(toTrainingState([], []), null, [{ row, name: 'Supino reto' }])
    expect(s.entries[0].sets[0].weight).toBeNull()
    expect(s.name).toBe('Treino livre')
  })
})

describe('sessionToRows', () => {
  it('grava só as séries feitas', () => {
    const s = buildSession(history, { id: 'r1', name: 'Peito' }, [{ row, name: 'Supino reto' }])
    s.entries[0].sets[0].done = true
    s.entries[0].sets[1].done = true
    const { workout, sets } = sessionToRows(s, 'u1', new Date('2026-10-27T11:00:00Z'))
    expect(workout).toMatchObject({ user_id: 'u1', routine_id: 'r1', ended_at: '2026-10-27T11:00:00.000Z' })
    expect(sets.map(x => x.set_index)).toEqual([0, 1])
    expect(sets[0]).toMatchObject({ workout_id: s.id, exercise_id: BENCH, weight_kg: 62.5, reps: 5, kind: 'work' })
    expect(sessionVolume(s)).toBe(625)
  })
})

describe('newRecords', () => {
  it('aponta o recorde quando o 1RM estimado passa o anterior', () => {
    const s = buildSession(history, { id: 'r1', name: 'Peito' }, [{ row, name: 'Supino reto' }])
    s.entries[0].sets[0].done = true
    const records = newRecords(history, s)
    expect(records).toHaveLength(1)
    expect(records[0].exerciseId).toBe(BENCH)
    expect(records[0].value).toBeGreaterThan(records[0].previous ?? 0)
  })

  it('não aponta recorde quando a carga caiu', () => {
    const s = buildSession(history, { id: 'r1', name: 'Peito' }, [{ row, name: 'Supino reto' }])
    s.entries[0].sets[0] = { kind: 'work', weight: 40, reps: 5, rir: null, done: true }
    expect(newRecords(history, s)).toEqual([])
  })
})
