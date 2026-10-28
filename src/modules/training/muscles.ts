// Os músculos que o NutriMax acompanha. São os mesmos 18 que a lógica de recuperação
// portada do openGym usa, em ordem da cabeça aos pés.
export const MUSCLES = [
  'trapezius', 'deltoids', 'chest', 'upper-back', 'serratus',
  'biceps', 'triceps', 'forearm',
  'abs', 'obliques', 'lower-back',
  'gluteal', 'quadriceps', 'hamstring', 'adductors', 'hip-flexors',
  'calves', 'tibialis',
] as const

export type Muscle = (typeof MUSCLES)[number]

export const MUSCLE_NAME_PT: Record<Muscle, string> = {
  trapezius: 'Trapézio',
  deltoids: 'Ombros',
  chest: 'Peito',
  'upper-back': 'Dorsais e costas',
  serratus: 'Serrátil',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearm: 'Antebraço',
  abs: 'Abdômen',
  obliques: 'Oblíquos',
  'lower-back': 'Lombar',
  gluteal: 'Glúteos',
  quadriceps: 'Quadríceps',
  hamstring: 'Posterior de coxa',
  adductors: 'Adutores',
  'hip-flexors': 'Flexores do quadril',
  calves: 'Panturrilha',
  tibialis: 'Tibial',
}

// Os 17 nomes que o free-exercise-db usa em primaryMuscles e secondaryMuscles.
const FROM_FREE_EXERCISE_DB: Record<string, Muscle> = {
  abdominals: 'abs',
  abductors: 'gluteal',
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearm',
  glutes: 'gluteal',
  hamstrings: 'hamstring',
  lats: 'upper-back',
  'lower back': 'lower-back',
  'middle back': 'upper-back',
  neck: 'trapezius',
  quadriceps: 'quadriceps',
  shoulders: 'deltoids',
  traps: 'trapezius',
  triceps: 'triceps',
}

export function toMuscle(name: string): Muscle | null {
  const key = name.toLowerCase().trim()
  if ((MUSCLES as readonly string[]).includes(key)) return key as Muscle
  return FROM_FREE_EXERCISE_DB[key] ?? null
}

/** Converte uma lista do free-exercise-db, sem repetir e na ordem do corpo. */
export function toMuscles(names: readonly string[]): Muscle[] {
  const found = new Set<Muscle>()
  for (const name of names) {
    const muscle = toMuscle(name)
    if (muscle) found.add(muscle)
  }
  return MUSCLES.filter(m => found.has(m))
}
