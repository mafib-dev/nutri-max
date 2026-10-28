// Números da tela de Progresso: recuperação por músculo, séries por músculo e volume por semana.
// A recuperação usa a lógica do openGym (opengym/recovery.js); o resto é contagem simples.
import { EXIDX } from './opengym/exercises.js'
import { musclesOf } from './opengym/muscles.js'
import { fatigueOf } from './opengym/recovery.js'
import { fatigueRecoveryMs, fatigueStateOf } from './opengym/recovery-view.js'
import { MUSCLES, type Muscle } from './muscles'
import type { OgWorkout, TrainingState } from './state'

const DAY = 24 * 60 * 60 * 1000

export interface MuscleRecovery {
  muscle: Muscle
  /** 0 = descansado, 1 = muito cansado. */
  fatigue: number
  state: 'ready' | 'recovering' | 'fatigued'
  /** Quanto falta para voltar a "pronto", ou null se já está pronto. */
  readyInMs: number | null
}

/** Cansaço atual de cada músculo, do mais cansado para o menos. */
export function recoveryByMuscle(state: TrainingState, now = Date.now(), bodyweightKg?: number): MuscleRecovery[] {
  const fatigue = fatigueOf(state.workouts, now, { unit: state.unit, bodyweightKg })
  return MUSCLES.map(muscle => {
    const value = fatigue[muscle] ?? 0
    return {
      muscle,
      fatigue: value,
      state: fatigueStateOf(value),
      readyInMs: fatigueRecoveryMs(value, muscle).toReadyMs,
    }
  }).sort((a, b) => b.fatigue - a.fatigue)
}

/** Segunda-feira 00:00 (hora local) da semana de `t`. */
export function weekStart(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

const workSets = (w: OgWorkout) => w.entries.flatMap(e => e.sets.filter(s => s.done && s.phase !== 'warmup').map(s => ({ id: e.id, s })))

export interface WeekTotals {
  /** Início da semana (segunda, 00:00). */
  start: number
  sets: number
  volume: number
  workouts: number
}

/** Séries, volume (kg × reps) e treinos de cada uma das últimas `weeks` semanas, da mais antiga para a atual. */
export function weeklyTotals(state: TrainingState, weeks = 8, now = Date.now()): WeekTotals[] {
  const current = weekStart(now)
  const out: WeekTotals[] = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(current)
    d.setDate(d.getDate() - 7 * (weeks - 1 - i))
    return { start: d.getTime(), sets: 0, volume: 0, workouts: 0 }
  })
  for (const w of state.workouts) {
    const ws = weekStart(w.start)
    const bucket = out.find(b => b.start === ws)
    if (!bucket) continue
    const sets = workSets(w)
    if (!sets.length) continue
    bucket.workouts++
    bucket.sets += sets.length
    bucket.volume += sets.reduce((n, { s }) => n + s.w * s.r, 0)
  }
  return out
}

export interface MuscleSets {
  muscle: Muscle
  /** Séries em que o músculo é o principal, nesta semana. */
  thisWeek: number
  /** Média das 4 semanas anteriores. */
  average: number
}

/** Séries diretas por músculo nesta semana, comparadas com a média das 4 semanas anteriores. */
export function setsByMuscle(state: TrainingState, now = Date.now()): MuscleSets[] {
  const current = weekStart(now)
  // Segunda de 4 semanas atrás. Conta 27 dias, não 28, para não cair no domingo se houver horário de verão.
  const from = weekStart(current - 27 * DAY)
  const thisWeek: Record<string, number> = {}
  const before: Record<string, number> = {}
  for (const w of state.workouts) {
    if (w.start < from) continue
    const target = w.start >= current ? thisWeek : before
    for (const { id } of workSets(w)) {
      for (const [muscle, weight] of Object.entries(musclesOf(EXIDX[id]))) {
        if (weight === 1) target[muscle] = (target[muscle] ?? 0) + 1
      }
    }
  }
  return MUSCLES.map(muscle => ({ muscle, thisWeek: thisWeek[muscle] ?? 0, average: (before[muscle] ?? 0) / 4 }))
    .filter(m => m.thisWeek > 0 || m.average > 0)
    .sort((a, b) => b.thisWeek - a.thisWeek || b.average - a.average)
}

/** Exercícios já treinados, do mais recente para o mais antigo. */
export function trainedExercises(state: TrainingState): string[] {
  const seen = new Set<string>()
  for (const w of [...state.workouts].reverse()) for (const e of w.entries) seen.add(e.id)
  return [...seen]
}
