// Monta um treino novo a partir de uma rotina, com as cargas sugeridas pela progressão.
import { exerciseName, getRoutine, loadCatalogue, loadState } from './data'
import { buildSession, type Session } from './session'

export async function startRoutine(routineId: string): Promise<Session> {
  const [{ routine, items }, catalogue, state] = await Promise.all([getRoutine(routineId), loadCatalogue(), loadState()])
  const byId = new Map(catalogue.map(e => [e.id, e]))
  return buildSession(
    state,
    routine,
    items.map(row => ({ row, name: exerciseName(byId.get(row.exercise_id)) })),
  )
}
