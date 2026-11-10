import { describe, expect, it } from 'vitest'
import {
  activityMet,
  cardioWaterMl,
  dayCardio,
  describeTarget,
  estimateKcal,
  formatDuration,
  formatPace,
  nextDistance,
  parseDistance,
  parseDuration,
  plannedDurationSec,
  totalsByActivity,
  type CardioLog,
  type CardioPlan,
} from './cardio'

const plan = (p: Partial<CardioPlan>): CardioPlan => ({
  id: 'p1',
  name: 'Corrida',
  activity: 'run',
  weekdays: [2],
  time: null,
  distance_m: 5000,
  duration_sec: null,
  intensity: 'easy',
  intervals: null,
  progression: {},
  notes: null,
  position: 0,
  ...p,
})

const log = (l: Partial<CardioLog>): CardioLog => ({
  id: 'l1',
  plan_id: null,
  date: '2026-11-10',
  activity: 'run',
  name: 'Corrida',
  distance_m: 5000,
  duration_sec: 1800,
  intensity: 'easy',
  intervals: null,
  rpe: null,
  avg_hr: null,
  kcal: 400,
  kcal_from_device: false,
  notes: null,
  ...l,
})

describe('parseDuration', () => {
  it('lê mm:ss, h:mm:ss e minutos soltos', () => {
    expect(parseDuration('28:30')).toBe(1710)
    expect(parseDuration('1:05:00')).toBe(3900)
    expect(parseDuration('45')).toBe(2700)
    expect(parseDuration('12,5')).toBe(750)
  })
  it('recusa o que não é tempo', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('5:75')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('0')).toBeNull()
  })
  it('formata de volta', () => {
    expect(formatDuration(1710)).toBe('28:30')
    expect(formatDuration(3900)).toBe('1:05:00')
  })
})

describe('parseDistance', () => {
  it('usa km por padrão e metros na natação', () => {
    expect(parseDistance('5', 'run')).toBe(5000)
    expect(parseDistance('6,5', 'run')).toBe(6500)
    expect(parseDistance('400m', 'run')).toBe(400)
    expect(parseDistance('1500', 'swim')).toBe(1500)
    expect(parseDistance('1,5km', 'swim')).toBe(1500)
    expect(parseDistance('x', 'run')).toBeNull()
  })
})

describe('formatPace', () => {
  it('mostra min/km na corrida, km/h na bike e min/100 m na natação', () => {
    expect(formatPace('run', 5000, 1710)).toBe('5:42 /km')
    expect(formatPace('bike', 20000, 3000)).toBe('24 km/h')
    expect(formatPace('swim', 1000, 1250)).toBe('2:05 /100 m')
    expect(formatPace('elliptical', null, 1800)).toBeNull()
  })
})

describe('gasto calórico', () => {
  it('corrida a 10 km/h fica perto de 10,5 MET (ACSM)', () => {
    expect(activityMet('run', 'easy', 10000, 3600)).toBeCloseTo(10.5, 1)
  })
  it('caminhada a 5 km/h fica perto de 3,4 MET', () => {
    expect(activityMet('walk', 'easy', 5000, 3600)).toBeCloseTo(3.4, 1)
  })
  it('velocidade absurda cai na tabela por intensidade', () => {
    expect(activityMet('run', 'moderate', 50000, 1800)).toBe(10)
  })
  it('kcal = MET × kg × horas', () => {
    expect(estimateKcal('bike', 'moderate', null, 3600, 80)).toBe(600)
    expect(estimateKcal('run', 'easy', 5000, 1800, null)).toBe(0)
  })
})

describe('progressão', () => {
  const p = plan({ distance_m: 6000, progression: { step_m: 500, max_m: 8000 } })
  it('começa na distância do plano', () => {
    expect(nextDistance(p, null)).toBe(6000)
  })
  it('soma o passo à última sessão até o máximo', () => {
    expect(nextDistance(p, 6000)).toBe(6500)
    expect(nextDistance(p, 7800)).toBe(8000)
  })
  it('não cai abaixo do plano quando a última foi mais curta', () => {
    expect(nextDistance(p, 4000)).toBe(6000)
  })
  it('sem progressão é sempre a distância do plano', () => {
    expect(nextDistance(plan({}), 9000)).toBe(5000)
  })
})

describe('plano do dia', () => {
  it('estima a duração pelo ritmo típico quando o plano só tem distância', () => {
    expect(plannedDurationSec(plan({}), 5000)).toBe(1800)
    expect(plannedDurationSec(plan({ duration_sec: 2400 }), 5000)).toBe(2400)
  })

  it('liga o registro ao plano, soma as calorias e a água', () => {
    const day = dayCardio(
      [plan({}), plan({ id: 'p2', weekdays: [4] })],
      2,
      [log({ plan_id: 'p1', kcal: 400 }), log({ id: 'l2', activity: 'walk', kcal: 100, duration_sec: 1800 })],
      new Map(),
    )
    expect(day.plans).toHaveLength(1)
    expect(day.plans[0].done?.id).toBe('l1')
    expect(day.extra.map(l => l.id)).toEqual(['l2'])
    expect(day.creditKcal).toBe(288 + 72)
    expect(day.waterMl).toBe(500)
  })

  it('o que ainda não foi feito conta para a água pela duração prevista', () => {
    const day = dayCardio([plan({})], 2, [], new Map())
    expect(day.plans[0].done).toBeNull()
    expect(day.waterMl).toBe(250)
    expect(day.creditKcal).toBe(0)
  })

  it('água do cardio: 500 ml por hora', () => {
    expect(cardioWaterMl([3600], [])).toBe(500)
    expect(cardioWaterMl([3600], [3600])).toBe(1000)
  })
})

describe('descrições', () => {
  it('descreve a meta com intervalos', () => {
    expect(describeTarget(5000, null, 'hard', { reps: 6, work_m: 400, work_sec: null, rest_sec: 120 })).toBe('5 km forte · 6× 400 m, 2:00 de descanso')
    expect(describeTarget(null, 1800, 'easy', null)).toBe('30:00 leve')
  })
  it('soma por atividade', () => {
    expect(totalsByActivity([log({}), log({ id: 'l2', distance_m: 3000 })])).toEqual([{ activity: 'run', sessions: 2, distance_m: 8000, duration_sec: 3600 }])
  })
})
