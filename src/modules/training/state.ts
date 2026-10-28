// Ponte entre as tabelas do Supabase e a lógica portada do openGym.
//
// A lógica do openGym lê um objeto de estado único (`S`) com os treinos no formato dele.
// Aqui esse objeto é montado a partir de `workouts` e `workout_sets`, e as rotinas viram
// as "configs" de exercício que a progressão espera. A lógica em si fica intocada em ./opengym.
import type { SupabaseClient } from '@supabase/supabase-js'
import { registerCatalogue } from './opengym/exercises.js'
import { nextPrescription } from './opengym/progression.js'
import { best1RM, e1rmSeries } from './opengym/onerm.js'
import type { ExerciseRow } from './catalogue'

export interface WorkoutRow {
  id: string
  routine_id: string | null
  name: string | null
  started_at: string
  ended_at: string | null
  body_weight_kg: number | string | null
  exclude_from_progression: boolean
}

export interface WorkoutSetRow {
  workout_id: string
  exercise_id: string
  entry_position: number
  set_index: number
  kind: 'warmup' | 'work' | 'drop' | 'restpause' | 'failure'
  weight_kg: number | string | null
  reps: number | null
  duration_sec: number | null
  rir: number | null
  side: 'left' | 'right' | null
  done: boolean
}

export interface RoutineExerciseRow {
  routine_id: string
  exercise_id: string
  sets: number
  rep_min: number | null
  rep_max: number | null
  rest_sec: number | null
  progression: { policy?: string; increment?: number; deloadFactor?: number }
}

/** Uma série no formato do openGym. */
export interface OgSet {
  w: number
  r: number
  done: boolean
  sec?: number
  rir?: number
  phase?: 'warmup'
  type?: 'dropset' | 'restpause'
  failure?: true
  drops?: { w: number; r: number }[]
}

export interface OgEntry {
  id: string
  rid?: string
  sets: OgSet[]
}

export interface OgWorkout {
  id: string
  d: string
  start: number
  end: number | null
  name: string | null
  bw: number | null
  routineIds: string[]
  routineId: string | null
  entries: OgEntry[]
  excludeFromProgression?: true
}

export interface TrainingState {
  unit: 'kg' | 'lb'
  workouts: OgWorkout[]
}

/** Config de um exercício numa rotina, no formato que nextPrescription espera. */
export interface ExerciseConfig {
  id: string
  sets: number
  reps?: number
  repsMin?: number
  prog?: string
  inc?: number
  deloadFactor?: number
  rest?: number
}

export interface Prescription {
  policy?: string
  kind: 'first' | 'up' | 'hold' | 'deload' | 'off'
  weight?: number
  reps?: number
  /** Algumas políticas (triple, peso corporal) também mudam o número de séries. */
  sets?: number
  /** Repetições por série, quando a meta muda de uma série para outra. */
  rowReps?: number[]
  sec?: number
  why?: [string, ...unknown[]]
}

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v))

// Data local no formato AAAA-MM-DD, que é como o openGym agrupa treinos por dia.
const localDay = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toOgSets(rows: WorkoutSetRow[]): OgSet[] {
  const ordered = [...rows].sort((a, b) => a.set_index - b.set_index)
  const out: OgSet[] = []
  for (const row of ordered) {
    const prev = out.at(-1)
    // Um lado de uma série unilateral: o openGym registra o total dos dois lados numa linha só.
    if (row.side === 'right' && prev && ordered.some(o => o.set_index === row.set_index && o.side === 'left')) {
      prev.r += row.reps ?? 0
      prev.done = prev.done && row.done
      continue
    }
    // Um drop entra na série anterior, como no openGym.
    if (row.kind === 'drop' && prev) {
      prev.type = 'dropset'
      prev.drops = [...(prev.drops ?? []), { w: num(row.weight_kg), r: row.reps ?? 0 }]
      continue
    }
    const set: OgSet = { w: num(row.weight_kg), r: row.reps ?? 0, done: row.done }
    if (row.duration_sec != null) set.sec = row.duration_sec
    if (row.rir != null) set.rir = row.rir
    if (row.kind === 'warmup') set.phase = 'warmup'
    if (row.kind === 'restpause') set.type = 'restpause'
    if (row.kind === 'failure') set.failure = true
    out.push(set)
  }
  return out
}

/** Monta o estado do openGym a partir das linhas do banco. Treinos em ordem cronológica. */
export function toTrainingState(
  workouts: WorkoutRow[],
  sets: WorkoutSetRow[],
  unit: 'kg' | 'lb' = 'kg',
): TrainingState {
  const setsByWorkout = new Map<string, WorkoutSetRow[]>()
  for (const s of sets) {
    const list = setsByWorkout.get(s.workout_id) ?? []
    list.push(s)
    setsByWorkout.set(s.workout_id, list)
  }

  const ordered = [...workouts].sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
  return {
    unit,
    workouts: ordered.map(w => {
      const byEntry = new Map<number, WorkoutSetRow[]>()
      for (const s of setsByWorkout.get(w.id) ?? []) {
        const list = byEntry.get(s.entry_position) ?? []
        list.push(s)
        byEntry.set(s.entry_position, list)
      }
      const entries: OgEntry[] = [...byEntry.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, rows]) => ({
          id: rows[0].exercise_id,
          ...(w.routine_id ? { rid: w.routine_id } : {}),
          sets: toOgSets(rows),
        }))
      const routineIds = w.routine_id ? [w.routine_id] : []
      return {
        id: w.id,
        d: localDay(w.started_at),
        start: Date.parse(w.started_at),
        end: w.ended_at ? Date.parse(w.ended_at) : null,
        name: w.name,
        bw: w.body_weight_kg == null ? null : num(w.body_weight_kg),
        routineIds,
        routineId: routineIds[0] ?? null,
        entries,
        ...(w.exclude_from_progression ? { excludeFromProgression: true as const } : {}),
      }
    }),
  }
}

/** Converte um exercício da rotina para a config que a progressão do openGym lê. */
export function toExerciseConfig(row: RoutineExerciseRow): ExerciseConfig {
  const cfg: ExerciseConfig = { id: row.exercise_id, sets: row.sets }
  // No openGym, `reps` é o teto da faixa e `repsMin` o piso.
  if (row.rep_max != null) cfg.reps = row.rep_max
  else if (row.rep_min != null) cfg.reps = row.rep_min
  if (row.rep_min != null && row.rep_max != null && row.rep_min < row.rep_max) cfg.repsMin = row.rep_min
  if (row.progression.policy) cfg.prog = row.progression.policy
  if (row.progression.increment) cfg.inc = row.progression.increment
  if (row.progression.deloadFactor) cfg.deloadFactor = row.progression.deloadFactor
  if (row.rest_sec != null) cfg.rest = row.rest_sec
  return cfg
}

/** A próxima carga e repetições sugeridas para um exercício, com o motivo. */
export function suggestNext(state: TrainingState, cfg: ExerciseConfig): Prescription {
  return nextPrescription(state, cfg)
}

/** O melhor 1RM estimado de um exercício e a série de onde veio. */
export function bestEstimated1RM(state: TrainingState, exerciseId: string) {
  return best1RM(state, exerciseId) as { est: number; w: number; r: number; d: string } | null
}

/** Um ponto por treino com o 1RM estimado: a curva de evolução de força. */
export function estimated1RMSeries(state: TrainingState, exerciseId: string) {
  return e1rmSeries(state, exerciseId) as { d: string; y: number; w: number; r: number }[]
}

// O Supabase devolve no máximo 1.000 linhas por consulta; o histórico de séries passa disso rápido.
const PAGE = 1000
async function fetchAll<T>(supabase: SupabaseClient, table: string, orderBy: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order(orderBy).range(from, from + PAGE - 1)
    if (error) throw new Error(`Falha ao carregar ${table}: ${error.message}`)
    rows.push(...(data as T[]))
    if (data.length < PAGE) return rows
  }
}

/** Carrega o catálogo e o histórico do usuário logado. */
export async function loadTrainingState(supabase: SupabaseClient, unit: 'kg' | 'lb' = 'kg') {
  const [exercises, workouts, sets] = await Promise.all([
    fetchAll<ExerciseRow>(supabase, 'exercises', 'id'),
    fetchAll<WorkoutRow>(supabase, 'workouts', 'started_at'),
    fetchAll<WorkoutSetRow>(supabase, 'workout_sets', 'id'),
  ])
  registerCatalogue(exercises)
  return toTrainingState(workouts, sets, unit)
}
