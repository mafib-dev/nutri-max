import { describe, expect, it } from 'vitest'
import { lightenEntry, lightWeekStatus, mondayOf } from './lightWeek'
import { buildEntry, sessionToRows, type SessionEntry } from './session'
import { toTrainingState } from './state'

const off = { light_week_every: null, light_week_start: null, light_week_until: null }

describe('semana leve', () => {
  it('segunda-feira da semana', () => {
    expect(mondayOf('2026-11-09')).toBe('2026-11-09')
    expect(mondayOf('2026-11-15')).toBe('2026-11-09')
  })

  it('a cada 4 semanas: a 4ª semana do ciclo é a leve', () => {
    const s = { ...off, light_week_every: 4, light_week_start: '2026-11-09' }
    expect(lightWeekStatus(s, '2026-11-10')).toMatchObject({ active: false, next: '2026-11-30' })
    expect(lightWeekStatus(s, '2026-11-30')).toMatchObject({ active: true, reason: 'auto', until: '2026-12-06', next: '2026-12-28' })
    expect(lightWeekStatus(s, '2026-12-07').active).toBe(false)
    expect(lightWeekStatus(s, '2026-12-28').active).toBe(true)
  })

  it('ligada à mão até uma data', () => {
    expect(lightWeekStatus({ ...off, light_week_until: '2026-11-15' }, '2026-11-15')).toMatchObject({ active: true, reason: 'manual' })
    expect(lightWeekStatus({ ...off, light_week_until: '2026-11-15' }, '2026-11-16').active).toBe(false)
  })

  it('tira um terço das séries e 10% da carga', () => {
    const entry = {
      exerciseId: 'x',
      name: 'Supino',
      sets: [
        { kind: 'warmup', weight: 40, reps: 10, rir: null, done: false },
        ...Array.from({ length: 4 }, () => ({ kind: 'work', weight: 80, reps: 8, rir: null, done: false })),
      ],
    } as unknown as SessionEntry
    const light = lightenEntry(entry)
    expect(light.light).toBe(true)
    expect(light.sets.filter(s => s.kind === 'work').map(s => s.weight)).toEqual([72, 72])
    expect(light.sets[0].weight).toBe(40)
  })
})

describe('séries por tempo', () => {
  const row = { routine_id: 'r', exercise_id: 'Plank', sets: 3, rep_min: null, rep_max: null, rest_sec: 60, progression: { policy: 'time' }, mode: 'time' as const, target_sec: 40 }

  it('começa pela meta em segundos e grava a duração', () => {
    const entry = buildEntry(toTrainingState([], []), row, 'Prancha')
    expect(entry.timed).toBe(true)
    expect(entry.sets.map(s => s.seconds)).toEqual([40, 40, 40])
    const { sets } = sessionToRows(
      { id: 'w', routineId: 'r', name: 'T', startedAt: new Date().toISOString(), entries: [{ ...entry, sets: entry.sets.map(s => ({ ...s, done: true })) }] },
      'u',
      new Date(),
    )
    expect(sets.map(s => [s.reps, s.duration_sec])).toEqual([
      [null, 40],
      [null, 40],
      [null, 40],
    ])
  })

  it('segurou tudo: a meta sobe 5 s', () => {
    const d = new Date(Date.now() - 2 * 86400000).toISOString()
    const state = toTrainingState(
      [{ id: 'w1', routine_id: 'r', name: 'T', started_at: d, ended_at: d, body_weight_kg: null, exclude_from_progression: false }],
      [0, 1, 2].map(i => ({ workout_id: 'w1', exercise_id: 'Plank', entry_position: 0, set_index: i, kind: 'work' as const, weight_kg: 0, reps: null, duration_sec: 40, rir: null, side: null, done: true })),
    )
    const entry = buildEntry(state, row, 'Prancha')
    expect(entry.sets[0].seconds).toBe(45)
  })
})
