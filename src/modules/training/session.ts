// O treino em andamento: montado a partir da rotina e das sugestões da progressão,
// editado na tela e convertido em linhas do banco ao finalizar.
import {
  bestEstimated1RM,
  suggestNext,
  toExerciseConfig,
  toTrainingState,
  type ExerciseConfig,
  type Prescription,
  type RoutineExerciseRow,
  type TrainingState,
  type WorkoutRow,
  type WorkoutSetRow,
} from './state'

export interface SessionSet {
  kind: 'warmup' | 'work'
  weight: number | null
  reps: number | null
  /** Duração da série, nas séries por tempo. */
  seconds?: number | null
  rir: number | null
  done: boolean
}

export interface SessionEntry {
  exerciseId: string
  name: string
  cfg: ExerciseConfig
  suggestion: Prescription
  restSec: number
  sets: SessionSet[]
  /** Séries de trabalho da última vez que o exercício foi feito (ausente em treinos salvos antes). */
  last?: LastPerformance | null
  /** Série por tempo (prancha): o campo é segundos, não repetições. */
  timed?: boolean
  /** Montado na semana leve: menos séries e carga. */
  light?: boolean
}

export interface LastPerformance {
  date: string
  sets: { w: number; r: number; sec?: number }[]
}

export interface Session {
  id: string
  routineId: string | null
  name: string
  startedAt: string
  entries: SessionEntry[]
}

export const DEFAULT_REST_SEC = 90

/** As séries de trabalho feitas da última vez que o exercício apareceu num treino. */
export function lastPerformance(state: TrainingState, exerciseId: string): LastPerformance | null {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    for (const entry of state.workouts[i].entries) {
      if (entry.id !== exerciseId) continue
      const work = entry.sets.filter(s => s.done && s.phase !== 'warmup')
      if (work.length) return { date: state.workouts[i].d, sets: work.map(s => ({ w: s.w, r: s.r, ...(s.sec ? { sec: s.sec } : {}) })) }
    }
  }
  return null
}

export function buildEntry(
  state: TrainingState,
  row: RoutineExerciseRow,
  name: string,
): SessionEntry {
  const cfg = toExerciseConfig(row)
  const suggestion = suggestNext(state, cfg)
  const count = suggestion.sets ?? cfg.sets
  const last = lastPerformance(state, cfg.id)
  const restSec = row.rest_sec ?? DEFAULT_REST_SEC
  if (cfg.mode === 'time') {
    // Peso corporal por padrão; carga só se a pessoa usou da última vez (prancha com anilha).
    const weight = suggestion.weight ?? (last && last.sets.some(s => s.w > 0) ? Math.max(...last.sets.map(s => s.w)) : null)
    const seconds = suggestion.sec ?? cfg.sec ?? 45
    const sets: SessionSet[] = Array.from({ length: count }, () => ({ kind: 'work', weight, reps: null, seconds, rir: null, done: false }))
    return { exerciseId: cfg.id, name, cfg, suggestion, restSec, sets, last, timed: true }
  }
  // Sem sugestão da progressão, começa com a maior carga da última vez.
  const weight = suggestion.weight ?? (last ? Math.max(...last.sets.map(s => s.w)) : null)
  if (cfg.pyramid) {
    // Pirâmide: cada série com a sua meta e a carga que essa mesma série usou da última vez.
    const sets: SessionSet[] = cfg.pyramid.map((reps, i) => ({ kind: 'work', weight: last?.sets[i]?.w ?? weight, reps, rir: null, done: false }))
    return { exerciseId: cfg.id, name, cfg, suggestion, restSec, sets, last }
  }
  const sets: SessionSet[] = Array.from({ length: count }, (_, i) => ({
    kind: 'work',
    weight,
    reps: suggestion.rowReps?.[i] ?? suggestion.reps ?? cfg.reps ?? null,
    rir: null,
    done: false,
  }))
  return { exerciseId: cfg.id, name, cfg, suggestion, restSec: row.rest_sec ?? DEFAULT_REST_SEC, sets, last }
}

export function buildSession(
  state: TrainingState,
  routine: { id: string; name: string } | null,
  rows: { row: RoutineExerciseRow; name: string }[],
  now = new Date(),
): Session {
  return {
    id: crypto.randomUUID(),
    routineId: routine?.id ?? null,
    name: routine?.name ?? 'Treino livre',
    startedAt: now.toISOString(),
    entries: rows.map(({ row, name }) => buildEntry(state, row, name)),
  }
}

/** Linhas para gravar no Supabase. Só entram séries marcadas como feitas. */
export function sessionToRows(session: Session, userId: string, endedAt: Date, bodyWeightKg: number | null = null) {
  const workout: WorkoutRow & { user_id: string } = {
    id: session.id,
    user_id: userId,
    routine_id: session.routineId,
    name: session.name,
    started_at: session.startedAt,
    ended_at: endedAt.toISOString(),
    body_weight_kg: bodyWeightKg,
    exclude_from_progression: false,
  }
  const sets: (WorkoutSetRow & { user_id: string })[] = []
  session.entries.forEach((entry, position) => {
    entry.sets.forEach((s, index) => {
      if (!s.done) return
      sets.push({
        workout_id: session.id,
        user_id: userId,
        exercise_id: entry.exerciseId,
        entry_position: position,
        set_index: index,
        kind: s.kind,
        weight_kg: s.weight ?? 0,
        reps: entry.timed ? null : (s.reps ?? 0),
        duration_sec: entry.timed ? (s.seconds ?? 0) : null,
        rir: s.rir,
        side: null,
        done: true,
      })
    })
  })
  return { workout, sets }
}

export interface NewRecord {
  exerciseId: string
  name: string
  value: number
  previous: number | null
}

/** Exercícios em que este treino bateu o melhor 1RM estimado até agora. */
export function newRecords(before: TrainingState, session: Session): NewRecord[] {
  const { workout, sets } = sessionToRows(session, '', new Date())
  const after: TrainingState = { ...before, workouts: [...before.workouts, ...toTrainingState([workout], sets).workouts] }
  const out: NewRecord[] = []
  for (const entry of session.entries) {
    if (!entry.sets.some(s => s.done && s.kind === 'work')) continue
    const prev = bestEstimated1RM(before, entry.exerciseId)
    const now = bestEstimated1RM(after, entry.exerciseId)
    if (now && (!prev || now.est > prev.est + 1e-9)) {
      out.push({ exerciseId: entry.exerciseId, name: entry.name, value: Math.round(now.est * 10) / 10, previous: prev ? Math.round(prev.est * 10) / 10 : null })
    }
  }
  return out
}

/** Volume do treino (carga × repetições das séries de trabalho feitas). */
export function sessionVolume(session: Session): number {
  let total = 0
  for (const entry of session.entries) {
    for (const s of entry.sets) if (s.done && s.kind === 'work') total += (s.weight ?? 0) * (s.reps ?? 0)
  }
  return total
}
