// Tipos de dia do plano alimentar: dias com treinos diferentes pedem cardápios diferentes.
// Os tipos são sugeridos a partir das rotinas e do cardio da pessoa, e ela pode mudar tudo.
import { ACTIVITIES, cardioWaterMl, creditedKcal, daysLabel, estimateKcal, nextDistance, plannedDurationSec, type Activity, type CardioPlan } from '../cardio/cardio'
import { workoutKcal } from './targets'

export interface Session {
  kind: 'strength' | Activity
  name: string
  /** "HH:MM" ou null quando não tem horário. */
  time: string | null
  /** Calorias que entram na meta do dia (0 se a pessoa não soma os treinos). */
  kcal: number
  /** Água a mais por causa deste treino. */
  water_ml: number
}

export interface DaySchedule {
  /** 0 = domingo … 6 = sábado. */
  weekday: number
  sessions: Session[]
}

export interface DayType {
  id: string
  name: string
  weekdays: number[]
  training_times: string[]
  /** Ajuste manual de calorias neste tipo de dia, além do gasto dos treinos. */
  extra_kcal: number
}

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
const byTime = (a: Session, b: Session) => (a.time ? minutes(a.time) : 9999) - (b.time ? minutes(b.time) : 9999)

const sessionLabel = (kind: Session['kind']) => (kind === 'strength' ? 'Musculação' : ACTIVITIES[kind].label)

/** "Musculação + Corrida", "Descanso". */
export function dayName(sessions: Session[]): string {
  const labels = [...new Set([...sessions].sort(byTime).map(s => sessionLabel(s.kind)))]
  return labels.length ? labels.join(' + ') : 'Descanso'
}

/**
 * Agrupa os dias da semana que têm os mesmos treinos nos mesmos horários.
 * Ex.: seg, qua e sex com musculação às 7h; ter e qui com musculação às 7h e corrida às 19h.
 */
export function suggestDayTypes(schedule: DaySchedule[]): DayType[] {
  const groups = new Map<string, { sessions: Session[]; weekdays: number[] }>()
  // Começa na segunda, que é como a maioria pensa a semana.
  const ordered = [...schedule].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7))
  for (const day of ordered) {
    const sessions = [...day.sessions].sort(byTime)
    const key = sessions.map(s => `${s.kind}@${s.time ?? ''}`).join('|')
    const g = groups.get(key) ?? { sessions, weekdays: [] }
    g.weekdays.push(day.weekday)
    groups.set(key, g)
  }
  const list = [...groups.values()].map((g, i) => ({
    id: `d${i + 1}`,
    name: dayName(g.sessions),
    weekdays: g.weekdays,
    training_times: [...new Set(g.sessions.map(s => s.time).filter((t): t is string => !!t))],
    extra_kcal: 0,
  }))
  // Dois grupos com o mesmo nome (mesmo treino em horários diferentes): os dias desfazem a dúvida.
  const count = new Map<string, number>()
  for (const d of list) count.set(d.name, (count.get(d.name) ?? 0) + 1)
  return list.map(d => (count.get(d.name)! > 1 ? { ...d, name: `${d.name} (${daysLabel(d.weekdays)})` } : d))
}

/** Um tipo só, para quem quer o mesmo cardápio todos os dias. */
export const singleDayType = (): DayType => ({ id: 'd1', name: 'Todos os dias', weekdays: [0, 1, 2, 3, 4, 5, 6], training_times: [], extra_kcal: 0 })

/** Gasto dos treinos e água a mais, na média dos dias da semana deste tipo. */
export function dayActivity(day: Pick<DayType, 'weekdays'>, schedule: DaySchedule[]): { kcal: number; water_ml: number } {
  const days = schedule.filter(s => day.weekdays.includes(s.weekday))
  if (!days.length) return { kcal: 0, water_ml: 0 }
  const sum = (f: (s: Session) => number) => days.reduce((a, d) => a + d.sessions.reduce((b, s) => b + f(s), 0), 0) / days.length
  return { kcal: Math.round(sum(s => s.kcal)), water_ml: Math.round(sum(s => s.water_ml) / 250) * 250 }
}

export const dayTypeOf = <T extends Pick<DayType, 'weekdays'>>(weekday: number, days: T[]) => days.find(d => d.weekdays.includes(weekday))

/** Põe um dia da semana em um tipo e tira dos outros (cada dia tem um tipo só). */
export function assignWeekday(days: DayType[], id: string, weekday: number): DayType[] {
  return days.map(d =>
    d.id === id
      ? { ...d, weekdays: d.weekdays.includes(weekday) ? d.weekdays : [...d.weekdays, weekday].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) }
      : { ...d, weekdays: d.weekdays.filter(w => w !== weekday) },
  )
}

/** Duração típica da musculação: a mediana dos treinos recentes, ou 60 min sem histórico. */
export function typicalStrengthMin(durationsMin: number[]): number {
  const valid = durationsMin.filter(m => m >= 10 && m <= 180).sort((a, b) => a - b)
  if (!valid.length) return 60
  return Math.round(valid[Math.floor(valid.length / 2)])
}

/**
 * A semana de treinos da pessoa: rotinas de musculação e planos de cardio por dia.
 * Com `countKcal` desligado (o nível de atividade já inclui os treinos), o gasto fica 0.
 */
export function weekSchedule(input: {
  routines: { name: string; weekday: number | null; time: string | null }[]
  cardio: CardioPlan[]
  lastCardioByPlan: Map<string, number | null>
  strengthMin: number
  weightKg: number | null
  countKcal: boolean
}): DaySchedule[] {
  const w = input.weightKg
  return [0, 1, 2, 3, 4, 5, 6].map(weekday => {
    const sessions: Session[] = []
    for (const r of input.routines.filter(r => r.weekday === weekday))
      sessions.push({ kind: 'strength', name: r.name, time: r.time, kcal: input.countKcal && w ? workoutKcal(input.strengthMin, w) : 0, water_ml: 0 })
    for (const p of input.cardio.filter(p => p.weekdays.includes(weekday))) {
      const distance = nextDistance(p, input.lastCardioByPlan.get(p.id) ?? null)
      const sec = plannedDurationSec(p, distance) ?? 1800
      sessions.push({
        kind: p.activity,
        name: p.name,
        time: p.time,
        kcal: input.countKcal && w ? creditedKcal(estimateKcal(p.activity, p.intensity, distance, sec, w)) : 0,
        water_ml: cardioWaterMl([], [sec]),
      })
    }
    return { weekday, sessions }
  })
}

export { daysLabel }
