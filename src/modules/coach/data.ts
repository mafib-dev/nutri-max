// Conversa com o nutricionista: leitura do dia inteiro, mensagens no Supabase e a função `coach`.
import { supabase } from '../../lib/supabase'
import { weekNutrition } from '../home/today'
import { getWater, listLogs, listLogTotals, loadFirstName, loadMealPlan, loadNutritionProfile, todayIso, workoutMinutesOn } from '../nutrition/data'
import { sumMacros } from '../nutrition/foods'
import { buildPlan, replanDay, withDefaults } from '../nutrition/plan'
import { dailyTargets, waterTarget, weightTrend, workoutKcal } from '../nutrition/targets'
import { listBodyWeights, listRoutines, listWorkouts, loadState } from '../training/data'
import { recoveryByMuscle, weeklyTotals } from '../training/insights'
import { MUSCLE_NAME_PT } from '../training/muscles'
import type { CoachRaw, StoredAction } from './coach'

const shift = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return todayIso(d)
}

/** Junta tudo o que o app sabe do dia: perfil, peso, diário, água, plano e treinos. */
export async function loadCoachRaw(now = new Date()): Promise<CoachRaw> {
  const today = todayIso(now)
  const [name, profile, weights, logs, waterMl, weekRows, minutes, routines, recent, state, savedRaw] = await Promise.all([
    loadFirstName(),
    loadNutritionProfile(),
    listBodyWeights(60),
    listLogs(today),
    getWater(today),
    listLogTotals(shift(today, -7), today),
    workoutMinutesOn(today),
    listRoutines(),
    listWorkouts(10),
    loadState(),
    loadMealPlan(),
  ])
  const weight = weights.at(-1)?.weight_kg ?? null
  const trainingKcal = profile.add_workout_kcal && weight ? minutes.reduce((a, m) => a + workoutKcal(m, weight), 0) : 0
  const targets = dailyTargets(profile, weight, now, trainingKcal)
  const saved = savedRaw ? { ...savedRaw, settings: withDefaults(savedRaw.settings) } : null
  const plan = saved && targets ? buildPlan(targets, saved) : null
  const day = saved && targets ? replanDay(targets, saved, sumMacros(logs), logs.map(l => l.meal), now.getHours() * 60 + now.getMinutes()) : null
  const thisWeek = weeklyTotals(state, 1, now.getTime())[0]
  return {
    now,
    name,
    profile,
    weights,
    trend: weightTrend(weights).at(-1)?.avg ?? null,
    targets,
    trainingKcal,
    logs,
    waterMl,
    waterGoal: waterTarget(weight),
    week: weekNutrition(weekRows, today, targets?.protein_g ?? null),
    workoutsToday: minutes,
    todaysRoutine: routines.find(r => r.weekday === now.getDay())?.name ?? null,
    recentWorkouts: recent,
    weekWorkouts: { done: thisWeek?.workouts ?? 0, planned: routines.filter(r => r.weekday != null).length },
    tiredMuscles: recoveryByMuscle(state, now.getTime(), weight ?? undefined)
      .filter(m => m.state !== 'ready')
      .map(m => MUSCLE_NAME_PT[m.muscle]),
    saved,
    plan,
    day,
  }
}

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions: StoredAction[]
  created_at: string
}

/** As últimas mensagens, da mais antiga para a mais nova. */
export async function listCoachMessages(limit = 40): Promise<CoachMessage[]> {
  const { data, error } = await supabase.from('coach_messages').select('id, role, content, actions, created_at').order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(`Falha ao carregar a conversa: ${error.message}`)
  return ((data ?? []) as CoachMessage[]).reverse()
}

export async function addCoachMessage(role: CoachMessage['role'], content: string, actions: StoredAction[] = []): Promise<CoachMessage> {
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('coach_messages')
    .insert({ user_id: auth.user?.id, role, content: content.slice(0, 4000), actions })
    .select('id, role, content, actions, created_at')
    .single()
  if (error) throw new Error(`Falha ao salvar a mensagem: ${error.message}`)
  return data as CoachMessage
}

export async function setCoachActions(id: string, actions: StoredAction[]) {
  const { error } = await supabase.from('coach_messages').update({ actions }).eq('id', id)
  if (error) throw new Error(`Falha ao salvar a ação: ${error.message}`)
}

export async function clearCoachMessages() {
  const { error } = await supabase.from('coach_messages').delete().not('id', 'is', null)
  if (error) throw new Error(`Falha ao apagar a conversa: ${error.message}`)
}

/** Pergunta ao nutricionista (função coach no Supabase, que chama o Claude). */
export async function askCoach(messages: { role: string; content: string }[], context: unknown): Promise<{ mensagem: string; acoes: unknown }> {
  const { data, error } = await supabase.functions.invoke('coach', { body: { messages, context } })
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? 'Não foi possível falar com o nutricionista agora.')
  }
  return (data as { result: { mensagem: string; acoes: unknown } }).result
}
