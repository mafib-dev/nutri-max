// Leitura e escrita do cardio no Supabase.
import { supabase } from '../../lib/supabase'
import type { CardioLog, CardioPlan } from './cardio'

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`)
}

async function userId() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Faça login de novo.')
  return data.user.id
}

const PLAN_COLUMNS = 'id, name, activity, weekdays, time, distance_m, duration_sec, intensity, intervals, progression, notes, position'
const LOG_COLUMNS = 'id, plan_id, date, activity, name, distance_m, duration_sec, intensity, intervals, rpe, avg_hr, kcal, kcal_from_device, notes'

// O Postgres devolve "19:00:00"; a tela usa "19:00".
const toPlan = (r: CardioPlan): CardioPlan => ({ ...r, time: r.time ? r.time.slice(0, 5) : null, weekdays: [...(r.weekdays ?? [])].sort((a, b) => a - b), progression: r.progression ?? {} })

export async function listCardioPlans(): Promise<CardioPlan[]> {
  const { data, error } = await supabase.from('cardio_plans').select(PLAN_COLUMNS).order('position').order('created_at')
  fail('Falha ao carregar o cardio', error)
  return (data as CardioPlan[]).map(toPlan)
}

export type PlanInput = Omit<CardioPlan, 'id' | 'position'>
export type LogInput = Omit<CardioLog, 'id'>

export async function saveCardioPlan(id: string | null, plan: PlanInput) {
  const { error } = id
    ? await supabase.from('cardio_plans').update(plan).eq('id', id)
    : await supabase.from('cardio_plans').insert({ ...plan, user_id: await userId() })
  fail('Falha ao salvar o plano de cardio', error)
}

export async function deleteCardioPlan(id: string) {
  const { error } = await supabase.from('cardio_plans').delete().eq('id', id)
  fail('Falha ao apagar o plano de cardio', error)
}

/** Registros entre duas datas (inclusive), do mais recente para o mais antigo. */
export async function listCardioLogs(from: string | null, to: string | null, limit = 200): Promise<CardioLog[]> {
  let q = supabase.from('cardio_logs').select(LOG_COLUMNS)
  if (from) q = q.gte('date', from)
  if (to) q = q.lte('date', to)
  const { data, error } = await q.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
  fail('Falha ao carregar o cardio', error)
  return data as CardioLog[]
}

export async function saveCardioLog(id: string | null, log: LogInput) {
  const { error } = id ? await supabase.from('cardio_logs').update(log).eq('id', id) : await supabase.from('cardio_logs').insert({ ...log, user_id: await userId() })
  fail('Falha ao salvar a atividade', error)
}

export async function deleteCardioLog(id: string) {
  const { error } = await supabase.from('cardio_logs').delete().eq('id', id)
  fail('Falha ao apagar a atividade', error)
}

/** Distância da última sessão feita de cada plano antes de `before`, para a progressão. */
export async function lastDistanceByPlan(before: string): Promise<Map<string, number | null>> {
  const { data, error } = await supabase
    .from('cardio_logs')
    .select('plan_id, distance_m, date')
    .not('plan_id', 'is', null)
    .lt('date', before)
    .order('date', { ascending: false })
    .limit(200)
  fail('Falha ao carregar o cardio', error)
  const map = new Map<string, number | null>()
  for (const r of data ?? []) if (!map.has(r.plan_id as string)) map.set(r.plan_id as string, r.distance_m as number | null)
  return map
}

/** Tudo o que a tela Hoje e o diário precisam do cardio de um dia. */
export async function loadCardioDay(date: string) {
  const [plans, logs, last] = await Promise.all([listCardioPlans(), listCardioLogs(date, date), lastDistanceByPlan(date)])
  return { plans, logs, last }
}
