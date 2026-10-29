import { describe, expect, it } from 'vitest'
import { toExerciseRow, type FreeExerciseDbExercise } from './catalogue'

const curl: FreeExerciseDbExercise = {
  id: 'Alternate_Incline_Dumbbell_Curl',
  name: 'Alternate Incline Dumbbell Curl',
  force: 'pull',
  level: 'beginner',
  mechanic: 'isolation',
  equipment: 'dumbbell',
  primaryMuscles: ['biceps'],
  secondaryMuscles: ['forearms'],
  instructions: ['Sit down on an incline bench.'],
  category: 'strength',
  images: ['Alternate_Incline_Dumbbell_Curl/0.jpg', 'Alternate_Incline_Dumbbell_Curl/1.jpg'],
}

describe('toExerciseRow', () => {
  it('converte para a linha da tabela exercises', () => {
    expect(toExerciseRow(curl)).toEqual({
      id: 'Alternate_Incline_Dumbbell_Curl',
      owner_id: null,
      name: 'Alternate Incline Dumbbell Curl',
      name_pt: null,
      force: 'pull',
      level: 'beginner',
      mechanic: 'isolation',
      equipment: 'dumbbell',
      category: 'strength',
      primary_muscles: ['biceps'],
      secondary_muscles: ['forearm'],
      instructions: { en: ['Sit down on an incline bench.'] },
      images: ['Alternate_Incline_Dumbbell_Curl/0.jpg', 'Alternate_Incline_Dumbbell_Curl/1.jpg'],
      source: 'free-exercise-db',
    })
  })

  it('não repete como secundário um músculo que já é primário', () => {
    const row = toExerciseRow({ ...curl, primaryMuscles: ['lats'], secondaryMuscles: ['middle back', 'biceps'] })
    expect(row.primary_muscles).toEqual(['upper-back'])
    expect(row.secondary_muscles).toEqual(['biceps'])
  })

  it('guarda o passo a passo em português ao lado do original', () => {
    const row = toExerciseRow(curl, 'Rosca', ['Passo 1'])
    expect(row.name_pt).toBe('Rosca')
    expect(row.instructions).toEqual({ en: curl.instructions, pt: ['Passo 1'] })
  })
})
