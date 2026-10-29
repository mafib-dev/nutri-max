import { toMuscles } from './muscles'

/** Um exercício como vem no dist/exercises.json do free-exercise-db. */
export interface FreeExerciseDbExercise {
  id: string
  name: string
  force: 'push' | 'pull' | 'static' | null
  level: 'beginner' | 'intermediate' | 'expert'
  mechanic: 'compound' | 'isolation' | null
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  category: string
  images: string[]
}

/** Uma linha da tabela public.exercises. */
export interface ExerciseRow {
  id: string
  owner_id: string | null
  name: string
  name_pt: string | null
  force: FreeExerciseDbExercise['force']
  level: FreeExerciseDbExercise['level'] | null
  mechanic: FreeExerciseDbExercise['mechanic']
  equipment: string | null
  category: string
  primary_muscles: string[]
  secondary_muscles: string[]
  instructions: { en: string[]; pt?: string[] }
  images: string[]
  source: 'free-exercise-db' | 'custom'
}

// Categorias que não são musculação: ficam no catálogo, mas fora da busca padrão.
export const NON_STRENGTH_CATEGORIES = ['stretching', 'cardio', 'strongman'] as const

/**
 * `namePt` e `stepsPt`: nome e passo a passo em português
 * (scripts/data/exercise-names-pt.json e exercise-instructions-pt.json), quando houver.
 */
export function toExerciseRow(ex: FreeExerciseDbExercise, namePt: string | null = null, stepsPt: string[] | null = null): ExerciseRow {
  const primary = toMuscles(ex.primaryMuscles)
  return {
    id: ex.id,
    owner_id: null,
    name: ex.name,
    name_pt: namePt,
    force: ex.force,
    level: ex.level,
    mechanic: ex.mechanic,
    equipment: ex.equipment,
    category: ex.category,
    primary_muscles: primary,
    // Um músculo que já é primário não conta de novo como secundário.
    secondary_muscles: toMuscles(ex.secondaryMuscles).filter(m => !primary.includes(m)),
    instructions: stepsPt?.length ? { en: ex.instructions, pt: stepsPt } : { en: ex.instructions },
    images: ex.images,
    source: 'free-exercise-db',
  }
}
