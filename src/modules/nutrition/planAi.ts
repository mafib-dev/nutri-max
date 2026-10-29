// Ajuste do plano por IA (DeepSeek, chamado pela função plan-ai do Supabase). A IA só escolhe:
// respostas da consulta, alimentos preferidos ou evitados, trocas por refeição e dicas. As gramas
// continuam saindo de buildPlan, e tudo o que ela devolve é conferido aqui antes de valer.
import { buildSlots, optionsFor, PLAN_FOODS, withDefaults, type FoodKey, type Guidance, type MealPlan, type PlanSettings, type Role, type SavedPlan } from './plan'
import type { Goal, Targets } from './targets'

export interface AiMemory {
  /** Dicas personalizadas da última resposta. */
  tips: Guidance[]
  summary: string
  /** Últimos pedidos, do mais recente para o mais antigo. */
  history: { at: string; request: string; summary: string }[]
}

export type SavedPlanWithAi = SavedPlan & { ai?: AiMemory }

const ROLES: Role[] = ['protein', 'carb', 'legume', 'veg', 'salad', 'fruit', 'fat']
const isFoodKey = (k: unknown): k is FoodKey => typeof k === 'string' && k !== 'whey' && k in PLAN_FOODS
const hhmm = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** O que vai para a IA: a consulta, as metas, o cardápio atual e as opções válidas de cada refeição. */
export function aiContext(saved: SavedPlan, plan: MealPlan, targets: Targets, goal: Goal | null) {
  const s = withDefaults(saved.settings)
  return {
    objetivo: goal ?? 'maintain',
    metas: targets,
    consulta: s,
    cardapio: plan.meals.map(m => ({
      slot: m.key,
      refeicao: m.label,
      horario: m.time,
      itens: m.items.map(i => ({ papel: i.role, alimento: i.key, nome: i.food.name, gramas: i.grams })),
      opcoes: Object.fromEntries(ROLES.map(r => [r, optionsFor(m.kind, r, s)]).filter(([, o]) => o.length)),
    })),
    alimentos: Object.fromEntries(Object.entries(PLAN_FOODS).filter(([k]) => k !== 'whey').map(([k, f]) => [k, f.name])),
  }
}

/**
 * Aplica a resposta da IA ao plano salvo, descartando o que não for válido: alimentos fora do
 * catálogo, trocas que não cabem na refeição, horários malformados. Devolve também quantas
 * sugestões foram descartadas, para avisar.
 */
export function applyAiResult(saved: SavedPlanWithAi, result: unknown, request: string, now = new Date()): { saved: SavedPlanWithAi; discarded: number } {
  const r = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>
  const patch = (r.consulta && typeof r.consulta === 'object' ? r.consulta : {}) as Record<string, unknown>
  const before = withDefaults(saved.settings)
  const s: PlanSettings = { ...before, whey: { ...before.whey } }
  let discarded = 0
  const take = (ok: boolean, apply: () => void) => (ok ? apply() : discarded++)

  if ('meals' in patch) take([3, 4, 5, 6].includes(patch.meals as number), () => (s.meals = patch.meals as PlanSettings['meals']))
  if ('wake' in patch) take(hhmm(patch.wake), () => (s.wake = patch.wake as string))
  if ('sleep' in patch) take(hhmm(patch.sleep), () => (s.sleep = patch.sleep as string))
  if ('train' in patch) take(patch.train === null || hhmm(patch.train), () => (s.train = patch.train as string | null))
  if ('diet' in patch) take(patch.diet === 'omnivore' || patch.diet === 'vegetarian', () => (s.diet = patch.diet as PlanSettings['diet']))
  for (const k of ['noLactose', 'noGluten', 'noFish', 'noPork', 'creatine'] as const) {
    if (k in patch) take(typeof patch[k] === 'boolean', () => (s[k] = patch[k] as boolean))
  }
  if ('lunchAt' in patch) take(['home', 'lunchbox', 'restaurant'].includes(patch.lunchAt as string), () => (s.lunchAt = patch.lunchAt as PlanSettings['lunchAt']))
  if ('cooking' in patch) take(['little', 'some', 'plenty'].includes(patch.cooking as string), () => (s.cooking = patch.cooking as PlanSettings['cooking']))
  if ('budget' in patch) take(['low', 'medium', 'high'].includes(patch.budget as string), () => (s.budget = patch.budget as PlanSettings['budget']))
  for (const k of ['likes', 'dislikes'] as const) {
    if (!(k in patch)) continue
    const list = Array.isArray(patch[k]) ? (patch[k] as unknown[]) : []
    const valid = list.filter(isFoodKey)
    discarded += list.length - valid.length + (Array.isArray(patch[k]) ? 0 : 1)
    s[k] = [...new Set(valid)]
  }
  // Um alimento não pode estar nas duas listas: "não como" vence.
  s.likes = s.likes.filter(k => !s.dislikes.includes(k))
  const whey = (patch.whey && typeof patch.whey === 'object' ? patch.whey : {}) as Record<string, unknown>
  if ('scoops' in whey) take([0, 1, 2].includes(whey.scoops as number), () => (s.whey.scoops = whey.scoops as 0 | 1 | 2))
  if ('when' in whey) take(['post', 'breakfast', 'snack'].includes(whey.when as string), () => (s.whey.when = whey.when as PlanSettings['whey']['when']))

  // Trocas antigas só valem se as refeições continuarem as mesmas.
  const slots = buildSlots(s)
  const sameSlots = buildSlots(before).map(x => x.key).join() === slots.map(x => x.key).join()
  const picks: SavedPlan['picks'] = sameSlots ? structuredClone(saved.picks) : {}
  const asked = Array.isArray(r.trocas) ? (r.trocas as Record<string, unknown>[]) : []
  for (const t of asked) {
    const slot = slots.find(x => x.key === t?.slot)
    const role = t?.papel as Role
    const food = t?.alimento
    if (!slot || !ROLES.includes(role) || !isFoodKey(food) || !optionsFor(slot.kind, role, s).includes(food)) {
      discarded++
      continue
    }
    picks[slot.key] = { ...picks[slot.key], [role]: food }
  }

  const tips = (Array.isArray(r.dicas) ? (r.dicas as Record<string, unknown>[]) : [])
    .map(d => ({ title: text(d?.titulo ?? d?.title, 80), text: text(d?.texto ?? d?.text, 600) }))
    .filter(d => d.title && d.text)
    .slice(0, 5)
  const summary = text(r.resumo, 600) || 'Plano ajustado.'
  const history = [{ at: now.toISOString(), request: request.slice(0, 500), summary }, ...(saved.ai?.history ?? [])].slice(0, 10)

  return { saved: { settings: s, picks, ai: { tips, summary, history } }, discarded }
}
