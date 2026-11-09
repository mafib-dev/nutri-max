// Monta um treino novo a partir de uma rotina, com as cargas sugeridas pela progressão.
import { exerciseName, getRoutine, loadCatalogue, loadLightWeek, loadState } from './data'
import { buildSession, type Session } from './session'
import { lightenEntry, lightWeekStatus } from './lightWeek'
import { todayIso } from '../nutrition/data'

export async function startRoutine(routineId: string): Promise<Session> {
  const [{ routine, items }, catalogue, state, light] = await Promise.all([getRoutine(routineId), loadCatalogue(), loadState(), loadLightWeek()])
  const byId = new Map(catalogue.map(e => [e.id, e]))
  const session = buildSession(
    state,
    routine,
    items.map(row => ({ row, name: exerciseName(byId.get(row.exercise_id)) })),
  )
  return lightWeekStatus(light, todayIso()).active ? { ...session, entries: session.entries.map(lightenEntry) } : session
}
