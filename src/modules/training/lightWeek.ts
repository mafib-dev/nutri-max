// Semana leve (deload): de tempos em tempos, menos séries e carga na musculação
// e cardio só leve, para o corpo se recuperar e voltar a progredir.
import type { SessionEntry } from './session'

export interface LightWeekSettings {
  /** A cada quantas semanas vem a semana leve (a última do ciclo); null = só à mão. */
  light_week_every: number | null
  /** Primeira semana do ciclo (qualquer dia dela). */
  light_week_start: string | null
  /** Semana leve ligada à mão até esta data (inclusive). */
  light_week_until: string | null
}

export interface LightWeekStatus {
  active: boolean
  reason: 'manual' | 'auto' | null
  /** Último dia da semana leve em andamento. */
  until: string | null
  /** Segunda-feira da próxima semana leve automática. */
  next: string | null
}

const DAY = 86400000
const parse = (iso: string) => Date.parse(iso + 'T12:00:00Z')
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
/** Segunda-feira da semana de `day`. */
export const mondayOf = (day: string) => {
  const t = parse(day)
  return iso(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY)
}

export function lightWeekStatus(s: LightWeekSettings, today: string): LightWeekStatus {
  let next: string | null = null
  let auto: string | null = null
  if (s.light_week_every && s.light_week_start) {
    const every = s.light_week_every
    const start = parse(mondayOf(s.light_week_start))
    const week = Math.floor((parse(mondayOf(today)) - start) / (7 * DAY))
    if (week >= 0 && week % every === every - 1) auto = iso(parse(mondayOf(today)) + 6 * DAY)
    const weeksToNext = week < 0 ? every - 1 - week : every - 1 - (week % every) || every
    next = iso(parse(mondayOf(today)) + weeksToNext * 7 * DAY)
  }
  if (s.light_week_until && s.light_week_until >= today) return { active: true, reason: 'manual', until: s.light_week_until, next }
  if (auto) return { active: true, reason: 'auto', until: auto, next }
  return { active: false, reason: null, until: null, next }
}

/** Musculação na semana leve: um terço a menos de séries e 10% a menos de carga. */
export function lightenEntry(entry: SessionEntry): SessionEntry {
  const work = entry.sets.filter(s => s.kind === 'work')
  const keep = Math.max(1, work.length - Math.ceil(work.length / 3))
  let kept = 0
  const sets = entry.sets
    .filter(s => s.kind !== 'work' || kept++ < keep)
    .map(s => (s.kind === 'work' && !entry.timed && s.weight ? { ...s, weight: Math.round(s.weight * 0.9 * 2) / 2 } : s))
  return { ...entry, sets, light: true }
}
