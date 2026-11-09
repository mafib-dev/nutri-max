// Cardio: tipos de atividade, ritmo, gasto calórico, progressão e água.
// Tudo aqui é cálculo puro; as leituras e gravações ficam em data.ts.
import { WORKOUT_CREDIT } from '../nutrition/targets'

export type Activity = 'run' | 'walk' | 'bike' | 'swim' | 'row' | 'elliptical' | 'hike' | 'jump_rope' | 'other'
export type Intensity = 'easy' | 'moderate' | 'hard'

export interface Intervals {
  reps: number
  /** Cada tiro tem distância (m) ou tempo (s). */
  work_m: number | null
  work_sec: number | null
  /** Descanso entre os tiros, em segundos. */
  rest_sec: number | null
}

export interface Progression {
  /** Quanto aumentar a distância a cada sessão feita, em metros. */
  step_m?: number
  /** Até onde aumentar, em metros. */
  max_m?: number
}

export interface CardioPlan {
  id: string
  name: string
  activity: Activity
  /** 0 = domingo … 6 = sábado. Vazio = sem dia fixo. */
  weekdays: number[]
  /** "HH:MM" ou null. */
  time: string | null
  distance_m: number | null
  duration_sec: number | null
  intensity: Intensity
  intervals: Intervals | null
  progression: Progression
  notes: string | null
  position: number
}

export interface CardioLog {
  id: string
  plan_id: string | null
  date: string
  activity: Activity
  name: string
  distance_m: number | null
  duration_sec: number
  intensity: Intensity
  intervals: Intervals | null
  rpe: number | null
  avg_hr: number | null
  kcal: number
  kcal_from_device: boolean
  notes: string | null
}

interface ActivityDef {
  label: string
  /** Se faz sentido medir distância. */
  distance: boolean
  /** Como mostrar o ritmo: min/km, min/100 m ou km/h. */
  pace: 'per_km' | 'per_100m' | 'speed' | null
  /** MET por intensidade (Compêndio de Atividades Físicas 2024), quando não dá para usar a velocidade. */
  met: Record<Intensity, number>
  /** Ritmo típico (s/km) para estimar a duração de um plano que só tem distância. */
  typicalSecPerKm: number | null
}

export const ACTIVITIES: Record<Activity, ActivityDef> = {
  run: { label: 'Corrida', distance: true, pace: 'per_km', met: { easy: 8, moderate: 10, hard: 12 }, typicalSecPerKm: 360 },
  walk: { label: 'Caminhada', distance: true, pace: 'per_km', met: { easy: 3, moderate: 4, hard: 5 }, typicalSecPerKm: 660 },
  bike: { label: 'Bicicleta', distance: true, pace: 'speed', met: { easy: 5.8, moderate: 7.5, hard: 10 }, typicalSecPerKm: 150 },
  swim: { label: 'Natação', distance: true, pace: 'per_100m', met: { easy: 6, moderate: 8, hard: 10 }, typicalSecPerKm: 1500 },
  row: { label: 'Remo', distance: true, pace: 'per_km', met: { easy: 4.8, moderate: 7, hard: 9 }, typicalSecPerKm: 300 },
  elliptical: { label: 'Elíptico', distance: false, pace: null, met: { easy: 5, moderate: 6.5, hard: 8 }, typicalSecPerKm: null },
  hike: { label: 'Trilha', distance: true, pace: 'per_km', met: { easy: 5.3, moderate: 6.5, hard: 8 }, typicalSecPerKm: 900 },
  jump_rope: { label: 'Pular corda', distance: false, pace: null, met: { easy: 8, moderate: 11, hard: 12 }, typicalSecPerKm: null },
  other: { label: 'Outro', distance: false, pace: null, met: { easy: 4, moderate: 6, hard: 8 }, typicalSecPerKm: null },
}

export const INTENSITIES: Record<Intensity, { label: string; hint: string }> = {
  easy: { label: 'Leve', hint: 'Dá para conversar' },
  moderate: { label: 'Moderado', hint: 'Fala frases curtas' },
  hard: { label: 'Forte', hint: 'Tiros, ritmo de prova' },
}

// ---------- tempo e distância ----------

/** "28:30", "1:05:00", "45" (minutos) → segundos; null se inválido. */
export function parseDuration(text: string): number | null {
  const t = text.trim().replace(/\s/g, '')
  if (!t) return null
  if (/^\d+([.,]\d+)?$/.test(t)) {
    const min = Number(t.replace(',', '.'))
    return min > 0 ? Math.round(min * 60) : null
  }
  const parts = t.split(':')
  if (parts.length < 2 || parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.slice(1).some(n => n >= 60)) return null
  const sec = nums.reduce((a, n) => a * 60 + n, 0)
  return sec > 0 ? sec : null
}

/** Segundos → "28:30" ou "1:05:00". */
export function formatDuration(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/** "5", "5,5", "800m" → metros. Sem unidade, km (ou metros na natação, que se mede em piscina). */
export function parseDistance(text: string, activity: Activity): number | null {
  const t = text.trim().toLowerCase().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const m = /^(\d+(?:\.\d+)?)(km|m)?$/.exec(t)
  if (!m) return null
  const value = Number(m[1])
  const unit = m[2] ?? (activity === 'swim' ? 'm' : 'km')
  const meters = Math.round(unit === 'km' ? value * 1000 : value)
  return meters > 0 && meters <= 500_000 ? meters : null
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`
  return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`
}

/** Texto para o campo de distância, na unidade que parseDistance espera. */
export function distanceInput(meters: number | null, activity: Activity): string {
  if (meters == null) return ''
  if (activity === 'swim') return String(meters)
  return (meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/** Ritmo ou velocidade, conforme a atividade: "5:42 /km", "2:05 /100 m", "24,3 km/h". */
export function formatPace(activity: Activity, distanceM: number | null, durationSec: number): string | null {
  const kind = ACTIVITIES[activity].pace
  if (!kind || !distanceM || !durationSec) return null
  if (kind === 'speed') return `${((distanceM / durationSec) * 3.6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/h`
  const per = kind === 'per_km' ? 1000 : 100
  return `${formatDuration((durationSec / distanceM) * per)} /${kind === 'per_km' ? 'km' : '100 m'}`
}

// ---------- gasto calórico ----------

/**
 * MET da atividade. Corrida e caminhada usam a velocidade média pelas equações do ACSM
 * (VO₂ = 0,2·v + 3,5 correndo e 0,1·v + 3,5 andando, v em m/min); o resto usa a tabela por intensidade.
 */
export function activityMet(activity: Activity, intensity: Intensity, distanceM: number | null, durationSec: number): number {
  if ((activity === 'run' || activity === 'walk') && distanceM && durationSec) {
    const v = distanceM / (durationSec / 60)
    const kmh = v * 0.06
    // Fora disso a medida provavelmente está errada (GPS, distância digitada errada).
    if (kmh >= 2.5 && kmh <= 25) {
      const running = activity === 'run' ? kmh >= 6.5 : kmh >= 8
      return ((running ? 0.2 : 0.1) * v + 3.5) / 3.5
    }
  }
  return ACTIVITIES[activity].met[intensity]
}

/** Gasto estimado da atividade (kcal = MET × kg × horas). */
export function estimateKcal(activity: Activity, intensity: Intensity, distanceM: number | null, durationSec: number, weightKg: number | null): number {
  if (!weightKg || !(durationSec > 0)) return 0
  return Math.round(activityMet(activity, intensity, distanceM, durationSec) * weightKg * (durationSec / 3600))
}

/** Quanto do gasto entra na meta de calorias do dia (mesma regra da musculação). */
export const creditedKcal = (kcal: number) => Math.round(kcal * WORKOUT_CREDIT)

// ---------- planos ----------

export const plannedFor = (plans: CardioPlan[], weekday: number) => plans.filter(p => p.weekdays.includes(weekday))

/**
 * Distância da próxima sessão. Com progressão, soma o passo à última sessão feita deste plano,
 * sem cair abaixo da distância do plano nem passar do máximo.
 */
export function nextDistance(plan: Pick<CardioPlan, 'distance_m' | 'progression'>, lastDoneM: number | null): number | null {
  const base = plan.distance_m
  const step = plan.progression.step_m
  if (!base || !step || lastDoneM == null) return base
  const max = plan.progression.max_m ?? Infinity
  return Math.min(max, Math.max(base, lastDoneM + step))
}

/** Duração prevista: a do plano ou a distância no ritmo típico da atividade. */
export function plannedDurationSec(plan: Pick<CardioPlan, 'activity' | 'duration_sec'>, distanceM: number | null): number | null {
  if (plan.duration_sec) return plan.duration_sec
  const pace = ACTIVITIES[plan.activity].typicalSecPerKm
  return distanceM && pace ? Math.round((distanceM / 1000) * pace) : null
}

export function describeIntervals(i: Intervals): string {
  const work = i.work_m ? formatDistance(i.work_m) : i.work_sec ? formatDuration(i.work_sec) : ''
  const rest = i.rest_sec ? `, ${formatDuration(i.rest_sec)} de descanso` : ''
  return `${i.reps}× ${work}${rest}`.trim()
}

/** "5 km leve · 6× 400 m, 2:00 de descanso". */
export function describeTarget(distanceM: number | null, durationSec: number | null, intensity: Intensity, intervals: Intervals | null): string {
  const parts: string[] = []
  const amount = [distanceM ? formatDistance(distanceM) : null, durationSec ? formatDuration(durationSec) : null].filter(Boolean).join(' em ')
  parts.push(`${amount ? amount + ' ' : ''}${INTENSITIES[intensity].label.toLowerCase()}`)
  if (intervals?.reps) parts.push(describeIntervals(intervals))
  return parts.join(' · ')
}

// ---------- água ----------

/**
 * Água a mais no dia por causa do cardio: cerca de 500 ml por hora de atividade
 * (ACSM recomenda repor 0,4 a 0,8 L/h), arredondado de 250 em 250 ml.
 * Usa o que foi feito; o que ainda está planejado para hoje conta pela duração prevista.
 */
export function cardioWaterMl(doneSec: number[], pendingSec: number[]): number {
  const sec = [...doneSec, ...pendingSec].reduce((a, s) => a + Math.min(s, 4 * 3600), 0)
  return Math.round((sec / 3600) * 500 / 250) * 250
}

export interface DayCardio {
  /** Planos de hoje com a meta da próxima sessão e o registro de hoje, se já foi feito. */
  plans: { plan: CardioPlan; distance_m: number | null; duration_sec: number | null; done: CardioLog | null }[]
  /** Registros de hoje sem plano. */
  extra: CardioLog[]
  /** Gasto que entra na meta de calorias. */
  creditKcal: number
  waterMl: number
}

/**
 * Junta os planos do dia com o que foi registrado. `lastByPlan` é a distância da última sessão
 * feita de cada plano antes de hoje, para a progressão.
 */
export function dayCardio(plans: CardioPlan[], weekday: number, todayLogs: CardioLog[], lastByPlan: Map<string, number | null>): DayCardio {
  const used = new Set<string>()
  const list = plannedFor(plans, weekday).map(plan => {
    const done = todayLogs.find(l => l.plan_id === plan.id && !used.has(l.id)) ?? null
    if (done) used.add(done.id)
    const distance_m = nextDistance(plan, lastByPlan.get(plan.id) ?? null)
    return { plan, distance_m, duration_sec: plannedDurationSec(plan, distance_m), done }
  })
  const extra = todayLogs.filter(l => !used.has(l.id))
  const pending = list.filter(p => !p.done).map(p => p.duration_sec ?? 0)
  return {
    plans: list,
    extra,
    creditKcal: todayLogs.reduce((a, l) => a + creditedKcal(l.kcal), 0),
    waterMl: cardioWaterMl(
      todayLogs.map(l => l.duration_sec),
      pending,
    ),
  }
}

/** Distância somada por atividade nos registros dados. */
export function totalsByActivity(logs: CardioLog[]) {
  const map = new Map<Activity, { sessions: number; distance_m: number; duration_sec: number }>()
  for (const l of logs) {
    const t = map.get(l.activity) ?? { sessions: 0, distance_m: 0, duration_sec: 0 }
    t.sessions++
    t.distance_m += l.distance_m ?? 0
    t.duration_sec += l.duration_sec
    map.set(l.activity, t)
  }
  return [...map.entries()].map(([activity, t]) => ({ activity, ...t }))
}

// ---------- textos ----------

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const daysLabel = (days: number[]) =>
  days.length === 0 ? 'Sem dia fixo' : days.length === 7 ? 'Todo dia' : days.map(d => WEEKDAY_SHORT[d]).join(', ')

/** "ter., 10 de nov. · 5 km · 28:30 · 5:42 /km · 380 kcal". */
export function logSummary(l: CardioLog, withDate = true) {
  const date = new Date(l.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
  return [
    withDate ? date : null,
    l.distance_m ? formatDistance(l.distance_m) : null,
    formatDuration(l.duration_sec),
    formatPace(l.activity, l.distance_m, l.duration_sec),
    l.kcal ? `${Math.round(l.kcal).toLocaleString('pt-BR')} kcal` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
