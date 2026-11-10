// Carrega o necessário para montar o plano: perfil, peso, consulta salva, metas e a semana de treinos.
// Dias com treinos diferentes (musculação, corrida, descanso) viram tipos de dia, cada um com as
// próprias calorias e o pré/pós-treino no horário daquele dia.
import { listBodyWeights, listRoutines, listWorkouts } from '../training/data'
import { lastDistanceByPlan, listCardioPlans } from '../cardio/data'
import { loadMealPlan, loadNutritionProfile, todayIso } from './data'
import { buildPlan, type MealPlan, type SavedPlan } from './plan'
import { dailyTargets, waterTarget, type NutritionProfile, type Targets } from './targets'
import { dayActivity, dayTypeOf, suggestDayTypes, typicalStrengthMin, weekSchedule, type DaySchedule } from './dayTypes'

export interface PlanDay {
  id: string
  /** "Musculação", "Musculação + Corrida", "Descanso"… */
  name: string
  weekdays: number[]
  /** Horário do treino usado para o pré e o pós-treino; null = dia sem treino. */
  train: string | null
  /** Calorias dos treinos somadas às metas neste dia (0 se o nível de atividade já conta os treinos). */
  activityKcal: number
  waterMl: number
  targets: Targets
  plan: MealPlan | null
}

export interface PlanContext {
  profile: NutritionProfile
  weight: number | null
  saved: SavedPlan | null
  /** Metas sem as calorias do treino: o dia-base. */
  targets: Targets | null
  /** Tipos de dia da semana; um só quando todos os dias são iguais. */
  days: PlanDay[]
  /** Tipo de dia de hoje. */
  today: PlanDay | null
  /** O plano de hoje (do tipo de dia de hoje). */
  plan: MealPlan | null
}

/** Horário que vale para o pré/pós-treino: o da musculação, senão o primeiro treino com horário. */
function trainTime(schedule: DaySchedule[], weekdays: number[], fallback: string | null): string | null {
  const sessions = schedule.filter(d => weekdays.includes(d.weekday)).flatMap(d => d.sessions)
  if (!sessions.length) return null
  const timed = sessions.filter(s => s.time).sort((a, b) => a.time!.localeCompare(b.time!))
  return (timed.find(s => s.kind === 'strength') ?? timed[0])?.time ?? fallback
}

/** Os tipos de dia com metas e cardápio de cada um. */
export function planDays(profile: NutritionProfile, weight: number | null, saved: SavedPlan | null, schedule: DaySchedule[], now = new Date()): PlanDay[] {
  const types = suggestDayTypes(schedule)
  return types.flatMap(t => {
    const activity = dayActivity(t, schedule)
    const targets = dailyTargets(profile, weight, now, activity.kcal)
    if (!targets) return []
    const train = trainTime(schedule, t.weekdays, saved?.settings.train ?? null)
    const plan = saved ? buildPlan(targets, { ...saved, settings: { ...saved.settings, train } }) : null
    return [{ id: t.id, name: t.name, weekdays: t.weekdays, train, activityKcal: activity.kcal, waterMl: waterTarget(weight) + activity.water_ml, targets, plan }]
  })
}

export async function loadPlanContext(): Promise<PlanContext> {
  const today = todayIso()
  const [profile, weights, saved, routines, cardio, lastCardio, workouts] = await Promise.all([
    loadNutritionProfile(),
    listBodyWeights(1),
    loadMealPlan(),
    listRoutines(),
    listCardioPlans(),
    lastDistanceByPlan(today),
    listWorkouts(30),
  ])
  const weight = weights.at(-1)?.weight_kg ?? null
  const targets = dailyTargets(profile, weight)
  const schedule = weekSchedule({
    routines,
    cardio,
    lastCardioByPlan: lastCardio,
    strengthMin: typicalStrengthMin(workouts.filter(w => w.ended_at).map(w => (Date.parse(w.ended_at!) - Date.parse(w.started_at)) / 60000)),
    weightKg: weight,
    countKcal: profile.add_workout_kcal,
  })
  const days = planDays(profile, weight, saved, schedule)
  const todayDay = dayTypeOf(new Date().getDay(), days) ?? null
  return { profile, weight, saved, targets, days, today: todayDay, plan: todayDay?.plan ?? (targets && saved ? buildPlan(targets, saved) : null) }
}
