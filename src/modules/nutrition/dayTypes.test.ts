import { describe, expect, it } from 'vitest'
import { assignWeekday, dayActivity, dayName, dayTypeOf, suggestDayTypes, typicalStrengthMin, weekSchedule, type DaySchedule, type Session } from './dayTypes'
import type { CardioPlan } from '../cardio/cardio'

const gym = (time: string | null = '07:00', kcal = 250): Session => ({ kind: 'strength', name: 'Treino', time, kcal, water_ml: 0 })
const run = (time: string | null = '19:00', kcal = 300): Session => ({ kind: 'run', name: 'Corrida', time, kcal, water_ml: 500 })

// Semana do exemplo: musculação seg a sex às 7h, corrida ter, qui e sáb às 19h, domingo livre.
const week: DaySchedule[] = [
  { weekday: 0, sessions: [] },
  { weekday: 1, sessions: [gym()] },
  { weekday: 2, sessions: [gym(), run()] },
  { weekday: 3, sessions: [gym()] },
  { weekday: 4, sessions: [run(), gym()] },
  { weekday: 5, sessions: [gym()] },
  { weekday: 6, sessions: [run('19:00', 400)] },
]

describe('tipos de dia', () => {
  it('agrupa os dias com os mesmos treinos nos mesmos horários', () => {
    const days = suggestDayTypes(week)
    expect(days.map(d => [d.name, d.weekdays, d.training_times])).toEqual([
      ['Musculação', [1, 3, 5], ['07:00']],
      ['Musculação + Corrida', [2, 4], ['07:00', '19:00']],
      ['Corrida', [6], ['19:00']],
      ['Descanso', [0], []],
    ])
  })

  it('o mesmo treino em horários diferentes vira dois tipos, com os dias no nome', () => {
    const days = suggestDayTypes([
      { weekday: 1, sessions: [gym('07:00')] },
      { weekday: 3, sessions: [gym('18:00')] },
    ])
    expect(days.map(d => d.name)).toEqual(['Musculação (Seg)', 'Musculação (Qua)'])
  })

  it('nome do dia segue a ordem dos treinos', () => {
    expect(dayName([run('06:00'), gym('18:00')])).toBe('Corrida + Musculação')
    expect(dayName([])).toBe('Descanso')
  })

  it('gasto e água são a média dos dias do tipo', () => {
    expect(dayActivity({ weekdays: [2, 4] }, week)).toEqual({ kcal: 550, water_ml: 500 })
    expect(dayActivity({ weekdays: [6, 0] }, week)).toEqual({ kcal: 200, water_ml: 250 })
  })

  it('cada dia da semana fica em um tipo só', () => {
    const days = suggestDayTypes(week)
    const moved = assignWeekday(days, days[0].id, 0)
    expect(dayTypeOf(0, moved)?.name).toBe('Musculação')
    expect(moved.find(d => d.name === 'Descanso')?.weekdays).toEqual([])
  })

  it('monta a semana a partir das rotinas e do cardio', () => {
    const plan: CardioPlan = {
      id: 'c1',
      name: 'Longão',
      activity: 'run',
      weekdays: [6],
      time: '19:00',
      distance_m: 6000,
      duration_sec: null,
      intensity: 'easy',
      intervals: null,
      progression: { step_m: 500, max_m: 8000 },
      notes: null,
      position: 0,
    }
    const s = weekSchedule({
      routines: [{ name: 'Perna', weekdays: [1], time: '07:00' }],
      cardio: [plan],
      lastCardioByPlan: new Map([['c1', 6000]]),
      strengthMin: 60,
      weightKg: 77,
      countKcal: true,
    })
    expect(s[1].sessions).toEqual([{ kind: 'strength', name: 'Perna', time: '07:00', kcal: 277, water_ml: 0, minutes: 60 }])
    // 6,5 km no ritmo típico (6 min/km) ≈ 39 min.
    expect(s[6].sessions[0]).toMatchObject({ kind: 'run', time: '19:00', water_ml: 250 })
    expect(s[6].sessions[0].kcal).toBeGreaterThan(300)
    const off = weekSchedule({ routines: [{ name: 'Perna', weekdays: [1], time: null }], cardio: [], lastCardioByPlan: new Map(), strengthMin: 60, weightKg: 77, countKcal: false })
    expect(off[1].sessions[0].kcal).toBe(0)
  })

  it('duração típica da musculação é a mediana dos treinos', () => {
    expect(typicalStrengthMin([])).toBe(60)
    expect(typicalStrengthMin([50, 70, 65, 300])).toBe(65)
  })
})
