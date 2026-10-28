// Leitura e escrita do módulo de musculação no Supabase.
import { supabase } from '../../lib/supabase'
import type { ExerciseRow } from './catalogue'
import { registerCatalogue } from './opengym/exercises.js'
import { loadTrainingState, type RoutineExerciseRow } from './state'
import { sessionToRows, type NewRecord, type Session } from './session'

export interface Routine {
  id: string
  name: string
  weekday: number | null
  position: number
}

export interface RoutineExercise extends RoutineExerciseRow {
  id: string
  position: number
  superset_group: string | null
  backup_exercise_id: string | null
}

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`)
}

async function userId() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Faça login de novo.')
  return data.user.id
}

// O catálogo muda pouco: carregado uma vez por sessão do app.
let catalogue: Promise<ExerciseRow[]> | null = null
export function loadCatalogue(): Promise<ExerciseRow[]> {
  catalogue ??= (async () => {
    const rows: ExerciseRow[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('exercises').select('*').order('name').range(from, from + 999)
      fail('Falha ao carregar exercícios', error)
      rows.push(...(data as ExerciseRow[]))
      if (data!.length < 1000) break
    }
    registerCatalogue(rows)
    return rows
  })().catch(err => {
    catalogue = null
    throw err
  })
  return catalogue
}

export function exerciseName(ex: Pick<ExerciseRow, 'name' | 'name_pt'> | undefined) {
  return ex ? ex.name_pt || ex.name : 'Exercício removido'
}

export function imageUrl(path: string) {
  return supabase.storage.from('exercise-images').getPublicUrl(path).data.publicUrl
}

export async function loadState() {
  await loadCatalogue()
  return loadTrainingState(supabase)
}

export async function listRoutines(): Promise<Routine[]> {
  const { data, error } = await supabase.from('routines').select('id, name, weekday, position').order('position').order('created_at')
  fail('Falha ao carregar rotinas', error)
  return data as Routine[]
}

export async function getRoutine(id: string) {
  const [routine, items] = await Promise.all([
    supabase.from('routines').select('id, name, weekday, position').eq('id', id).single(),
    supabase.from('routine_exercises').select('*').eq('routine_id', id).order('position'),
  ])
  fail('Falha ao carregar a rotina', routine.error ?? items.error)
  return { routine: routine.data as Routine, items: items.data as RoutineExercise[] }
}

export async function createRoutine(name: string, weekday: number | null): Promise<Routine> {
  const { data, error } = await supabase
    .from('routines')
    .insert({ user_id: await userId(), name, weekday })
    .select('id, name, weekday, position')
    .single()
  fail('Falha ao criar a rotina', error)
  return data as Routine
}

export async function updateRoutine(id: string, patch: Partial<Pick<Routine, 'name' | 'weekday'>>) {
  const { error } = await supabase.from('routines').update(patch).eq('id', id)
  fail('Falha ao salvar a rotina', error)
}

export async function deleteRoutine(id: string) {
  const { error } = await supabase.from('routines').delete().eq('id', id)
  fail('Falha ao apagar a rotina', error)
}

/** Grava a lista inteira de exercícios da rotina, na ordem dada. */
export async function saveRoutineExercises(routineId: string, items: Omit<RoutineExercise, 'id' | 'position' | 'routine_id'>[]) {
  const uid = await userId()
  const del = await supabase.from('routine_exercises').delete().eq('routine_id', routineId)
  fail('Falha ao salvar exercícios', del.error)
  if (!items.length) return
  const { error } = await supabase.from('routine_exercises').insert(
    items.map((item, position) => ({ ...item, routine_id: routineId, user_id: uid, position })),
  )
  fail('Falha ao salvar exercícios', error)
}

export async function saveWorkout(session: Session, records: NewRecord[]) {
  const uid = await userId()
  const endedAt = new Date()
  const { workout, sets } = sessionToRows(session, uid, endedAt)
  const w = await supabase.from('workouts').insert(workout)
  fail('Falha ao salvar o treino', w.error)
  if (sets.length) {
    const s = await supabase.from('workout_sets').insert(sets)
    if (s.error) {
      // Sem as séries o treino fica vazio no histórico: desfaz para tentar de novo.
      await supabase.from('workouts').delete().eq('id', workout.id)
      fail('Falha ao salvar as séries', s.error)
    }
  }
  if (records.length) {
    const r = await supabase.from('personal_records').insert(
      records.map(rec => ({
        user_id: uid,
        exercise_id: rec.exerciseId,
        workout_id: workout.id,
        kind: 'e1rm',
        value: rec.value,
        achieved_at: endedAt.toISOString(),
      })),
    )
    fail('Falha ao salvar recordes', r.error)
  }
}

export interface WorkoutSummary {
  id: string
  name: string | null
  started_at: string
  ended_at: string | null
  sets: number
  volume: number
}

export async function listWorkouts(limit = 50): Promise<WorkoutSummary[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, started_at, ended_at, workout_sets(weight_kg, reps, kind)')
    .order('started_at', { ascending: false })
    .limit(limit)
  fail('Falha ao carregar o histórico', error)
  return (data ?? []).map(w => {
    const work = (w.workout_sets as { weight_kg: number | string | null; reps: number | null; kind: string }[]).filter(s => s.kind !== 'warmup')
    return {
      id: w.id,
      name: w.name,
      started_at: w.started_at,
      ended_at: w.ended_at,
      sets: work.length,
      volume: work.reduce((sum, s) => sum + Number(s.weight_kg ?? 0) * (s.reps ?? 0), 0),
    }
  })
}

export async function deleteWorkout(id: string) {
  const { error } = await supabase.from('workouts').delete().eq('id', id)
  fail('Falha ao apagar o treino', error)
}
