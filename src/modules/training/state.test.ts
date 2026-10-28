import { describe, expect, it } from 'vitest'
import {
  bestEstimated1RM,
  suggestNext,
  toExerciseConfig,
  toTrainingState,
  type WorkoutRow,
  type WorkoutSetRow,
} from './state'

// '0025' é o supino reto com barra no catálogo de teste (opengym/test-catalogue.json).
const BENCH = '0025'

const workout = (id: string, startedAt: string): WorkoutRow => ({
  id,
  routine_id: 'r1',
  name: 'Peito',
  started_at: startedAt,
  ended_at: null,
  body_weight_kg: '80.00',
  exclude_from_progression: false,
})

const set = (workoutId: string, setIndex: number, weight: number, reps: number, extra: Partial<WorkoutSetRow> = {}): WorkoutSetRow => ({
  workout_id: workoutId,
  exercise_id: BENCH,
  entry_position: 0,
  set_index: setIndex,
  kind: 'work',
  weight_kg: String(weight),
  reps,
  duration_sec: null,
  rir: null,
  side: null,
  done: true,
  ...extra,
})

const cfg = toExerciseConfig({
  routine_id: 'r1',
  exercise_id: BENCH,
  sets: 3,
  rep_min: 5,
  rep_max: 5,
  rest_sec: 120,
  progression: { policy: 'linear' },
})

describe('toTrainingState', () => {
  it('monta treinos em ordem cronológica, com séries no formato do openGym', () => {
    const S = toTrainingState(
      [workout('w2', '2026-10-20T10:00:00Z'), workout('w1', '2026-10-13T10:00:00Z')],
      [set('w1', 1, 60, 5), set('w1', 0, 40, 8, { kind: 'warmup' }), set('w2', 0, 62.5, 5, { rir: 2 })],
    )
    expect(S.workouts.map(w => w.id)).toEqual(['w1', 'w2'])
    expect(S.workouts[0].entries[0].sets).toEqual([
      { w: 40, r: 8, done: true, phase: 'warmup' },
      { w: 60, r: 5, done: true },
    ])
    expect(S.workouts[1].entries[0].sets[0].rir).toBe(2)
    expect(S.workouts[0].bw).toBe(80)
  })

  it('junta os dois lados de uma série unilateral e os drops na série anterior', () => {
    const S = toTrainingState(
      [workout('w1', '2026-10-13T10:00:00Z')],
      [
        set('w1', 0, 20, 8, { side: 'left' }),
        set('w1', 0, 20, 7, { side: 'right' }),
        set('w1', 1, 30, 10),
        set('w1', 2, 20, 6, { kind: 'drop' }),
      ],
    )
    expect(S.workouts[0].entries[0].sets).toEqual([
      { w: 20, r: 15, done: true },
      { w: 30, r: 10, done: true, type: 'dropset', drops: [{ w: 20, r: 6 }] },
    ])
  })
})

describe('suggestNext', () => {
  it('sobe a carga depois de completar todas as séries', () => {
    const S = toTrainingState([workout('w1', '2026-10-13T10:00:00Z')], [set('w1', 0, 60, 5), set('w1', 1, 60, 5), set('w1', 2, 60, 5)])
    const next = suggestNext(S, cfg)
    expect(next.kind).toBe('up')
    expect(next.weight).toBe(62.5)
  })

  it('mantém a carga quando faltaram repetições', () => {
    const S = toTrainingState([workout('w1', '2026-10-13T10:00:00Z')], [set('w1', 0, 60, 5), set('w1', 1, 60, 5), set('w1', 2, 60, 3)])
    const next = suggestNext(S, cfg)
    expect(next.kind).toBe('hold')
    expect(next.weight).toBe(60)
  })
})

describe('bestEstimated1RM', () => {
  it('estima o 1RM a partir da melhor série', () => {
    const S = toTrainingState([workout('w1', '2026-10-13T10:00:00Z')], [set('w1', 0, 100, 5)])
    const best = bestEstimated1RM(S, BENCH)
    expect(best?.w).toBe(100)
    expect(best?.est).toBeGreaterThan(100)
  })
})

describe('toExerciseConfig', () => {
  it('usa rep_max como teto e rep_min como piso da faixa', () => {
    const c = toExerciseConfig({
      routine_id: 'r1', exercise_id: BENCH, sets: 3, rep_min: 8, rep_max: 12, rest_sec: null,
      progression: { policy: 'double', increment: 2 },
    })
    expect(c).toEqual({ id: BENCH, sets: 3, reps: 12, repsMin: 8, prog: 'double', inc: 2 })
  })
})
