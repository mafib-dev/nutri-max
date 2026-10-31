// Histórico por dia: junta o que foi comido, a água, o peso e os treinos de cada data,
// com as metas daquele dia, para a aba Histórico.
import { sumMacros, type FoodLog, type Macros } from '../nutrition/foods'
import { dailyTargets, workoutKcal, type NutritionProfile, type Targets } from '../nutrition/targets'
import type { BodyWeight, WorkoutSummary } from '../training/data'

export interface DayHistory {
  date: string
  eaten: Macros
  logs: FoodLog[]
  waterMl: number
  /** Peso registrado nesse dia, se houve pesagem. */
  weightKg: number | null
  /** Último peso conhecido até a data (para a meta de água e as metas do dia). */
  knownWeightKg: number | null
  workouts: WorkoutSummary[]
  trainingMin: number
  targets: Targets | null
}

const localDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const minutes = (w: WorkoutSummary) => (w.ended_at ? Math.max(0, (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000) : 0)

/**
 * Um item por dia que tenha algum registro, do mais recente para o mais antigo. As metas usam o
 * perfil atual e o último peso conhecido até aquela data, somando o treino do dia quando o perfil pede.
 */
export function buildDays(input: {
  logs: FoodLog[]
  water: { date: string; ml: number }[]
  /** Pesagens do intervalo (aparecem no dia). */
  weights: BodyWeight[]
  /** Todas as pesagens conhecidas, para as metas usarem o último peso até a data. */
  allWeights?: BodyWeight[]
  workouts: WorkoutSummary[]
  profile: NutritionProfile | null
}): DayHistory[] {
  const dates = new Set<string>()
  const logsBy = new Map<string, FoodLog[]>()
  for (const l of input.logs) {
    dates.add(l.date)
    logsBy.set(l.date, [...(logsBy.get(l.date) ?? []), l])
  }
  const waterBy = new Map<string, number>()
  for (const w of input.water) {
    if (w.ml > 0) dates.add(w.date)
    waterBy.set(w.date, w.ml)
  }
  const weightBy = new Map(input.weights.map(w => [w.date, w.weight_kg]))
  for (const w of input.weights) dates.add(w.date)
  const workoutsBy = new Map<string, WorkoutSummary[]>()
  for (const w of input.workouts) {
    const d = localDate(w.started_at)
    dates.add(d)
    workoutsBy.set(d, [...(workoutsBy.get(d) ?? []), w])
  }
  const sortedWeights = [...(input.allWeights ?? input.weights)].sort((a, b) => a.date.localeCompare(b.date))

  return [...dates]
    .sort((a, b) => b.localeCompare(a))
    .map(date => {
      const logs = logsBy.get(date) ?? []
      const workouts = (workoutsBy.get(date) ?? []).sort((a, b) => a.started_at.localeCompare(b.started_at))
      const trainingMin = workouts.reduce((a, w) => a + minutes(w), 0)
      const known = sortedWeights.filter(w => w.date <= date).at(-1)?.weight_kg ?? sortedWeights[0]?.weight_kg ?? null
      const extra = input.profile?.add_workout_kcal && known ? workouts.reduce((a, w) => a + workoutKcal(minutes(w), known), 0) : 0
      return {
        date,
        eaten: sumMacros(logs),
        logs,
        waterMl: waterBy.get(date) ?? 0,
        weightKg: weightBy.get(date) ?? null,
        knownWeightKg: known,
        workouts,
        trainingMin,
        targets: input.profile ? dailyTargets(input.profile, known, new Date(date + 'T12:00:00'), extra) : null,
      }
    })
}
