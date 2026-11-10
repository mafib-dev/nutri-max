// Nutricionista com IA: o retrato do dia que vai para a IA e a conferência das ações que ela
// sugere. A IA conversa e propõe; o app só executa ações conhecidas, com valores válidos, e
// depois de a pessoa tocar em "Aplicar".
import type { FoodLog } from '../nutrition/foods'
import { buildSlots, type DayStatus, type MealPlan, type SavedPlan } from '../nutrition/plan'
import { aiContext } from '../nutrition/planAi'
import { GOALS, type NutritionProfile, type Targets } from '../nutrition/targets'
import type { WeekNutrition } from '../home/today'

export interface CoachRaw {
  now: Date
  name: string | null
  profile: NutritionProfile
  weights: { date: string; weight_kg: number }[]
  trend: number | null
  targets: Targets | null
  trainingKcal: number
  logs: FoodLog[]
  waterMl: number
  waterGoal: number
  week: WeekNutrition
  workoutsToday: number[]
  todaysRoutine: string | null
  recentWorkouts: { name: string | null; started_at: string; sets: number; volume: number }[]
  weekWorkouts: { done: number; planned: number }
  tiredMuscles: string[]
  saved: SavedPlan | null
  plan: MealPlan | null
  day: DayStatus | null
}

const r = (n: number) => Math.round(n)

/** O que a IA precisa saber para orientar como um nutricionista que acompanha o dia todo. */
export function coachContext(c: CoachRaw) {
  const byMeal = new Map<string, FoodLog[]>()
  for (const l of c.logs) byMeal.set(l.meal, [...(byMeal.get(l.meal) ?? []), l])
  const eaten = c.logs.reduce((a, l) => ({ kcal: a.kcal + l.kcal, p: a.p + l.protein_g, c: a.c + l.carbs_g, f: a.f + l.fat_g }), { kcal: 0, p: 0, c: 0, f: 0 })
  return {
    agora: c.now.toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    pessoa: {
      nome: c.name,
      sexo: c.profile.sex,
      nascimento: c.profile.birth_date,
      altura_cm: c.profile.height_cm,
      objetivo: c.profile.goal ? GOALS[c.profile.goal].label : null,
      peso_kg: c.weights.at(-1)?.weight_kg ?? null,
      media_7_dias_kg: c.trend,
      peso_alvo_kg: c.profile.target_weight_kg,
      ritmo_kg_semana: c.profile.weekly_rate_kg,
      pesagens_recentes: c.weights.slice(-8),
    },
    metas_hoje: c.targets && { ...c.targets, kcal_do_treino_incluidas: c.trainingKcal },
    comido_hoje: {
      total: { kcal: r(eaten.kcal), proteina_g: r(eaten.p), carbo_g: r(eaten.c), gordura_g: r(eaten.f) },
      por_refeicao: Object.fromEntries([...byMeal].map(([m, ls]) => [m, ls.map(l => `${l.name}${l.grams ? ` ${r(l.grams)} g` : ''} (${r(l.kcal)} kcal, P ${r(l.protein_g)})`)])),
    },
    agua: { bebido_ml: c.waterMl, meta_ml: c.waterGoal },
    semana_nutricao: c.week,
    treino: {
      hoje_minutos: c.workoutsToday.map(r),
      rotina_de_hoje: c.todaysRoutine,
      semana: c.weekWorkouts,
      recentes: c.recentWorkouts.slice(0, 5).map(w => ({ nome: w.name, data: w.started_at.slice(0, 10), series: w.sets, volume_kg: r(w.volume) })),
      musculos_cansados: c.tiredMuscles,
    },
    plano:
      c.saved && c.plan && c.targets
        ? {
            ...aiContext(c.saved, c.plan, c.targets, c.profile.goal),
            hoje: c.day && {
              refeicoes_puladas: c.day.skipped.map(s => ({ slot: s.key, refeicao: s.label, horario: s.time })),
              falta_hoje: { kcal: r(c.day.missing.kcal), proteina_g: r(c.day.missing.p), carbo_g: r(c.day.missing.c), gordura_g: r(c.day.missing.f) },
              resto_do_dia_ajustado: c.day.adjusted,
              proximas: c.day.rest.map(m => ({ slot: m.key, refeicao: m.label, horario: m.time, itens: m.items.map(i => `${i.food.name} ${r(i.grams)} g`) })),
            },
          }
        : null,
  }
}

// ---------- Ações ----------

export type CoachAction =
  | { tipo: 'ajustar_plano'; rotulo: string; consulta?: Record<string, unknown>; trocas?: unknown[] }
  | { tipo: 'lancar_refeicao'; rotulo: string; slot: string }
  | { tipo: 'registrar_agua'; rotulo: string; ml: number }
  | { tipo: 'registrar_peso'; rotulo: string; kg: number }

export type StoredAction = CoachAction & { applied?: boolean }

const label = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : fallback)

/**
 * Confere as ações sugeridas pela IA. Fica só o que o app sabe fazer, com valores possíveis:
 * no máximo 3, e cada uma com um rótulo curto para o botão.
 */
export function validateActions(raw: unknown, saved: SavedPlan | null): CoachAction[] {
  if (!Array.isArray(raw)) return []
  const slots = saved ? buildSlots(saved.settings).map(s => s.key) : []
  const out: CoachAction[] = []
  for (const a of raw as Record<string, unknown>[]) {
    if (!a || typeof a !== 'object') continue
    if (a.tipo === 'ajustar_plano' && saved && (a.consulta || a.trocas)) {
      out.push({
        tipo: 'ajustar_plano',
        rotulo: label(a.rotulo, 'Ajustar o plano'),
        consulta: a.consulta && typeof a.consulta === 'object' ? (a.consulta as Record<string, unknown>) : undefined,
        trocas: Array.isArray(a.trocas) ? a.trocas : undefined,
      })
    } else if (a.tipo === 'lancar_refeicao' && typeof a.slot === 'string' && slots.includes(a.slot)) {
      out.push({ tipo: 'lancar_refeicao', rotulo: label(a.rotulo, 'Lançar a refeição do plano'), slot: a.slot })
    } else if (a.tipo === 'registrar_agua' && typeof a.ml === 'number' && a.ml >= 100 && a.ml <= 2000) {
      out.push({ tipo: 'registrar_agua', rotulo: label(a.rotulo, `Registrar ${Math.round(a.ml)} ml de água`), ml: Math.round(a.ml) })
    } else if (a.tipo === 'registrar_peso' && typeof a.kg === 'number' && a.kg >= 30 && a.kg <= 300) {
      out.push({ tipo: 'registrar_peso', rotulo: label(a.rotulo, `Registrar ${a.kg} kg`), kg: Math.round(a.kg * 10) / 10 })
    }
    if (out.length === 3) break
  }
  return out
}

export const QUICK_PROMPTS = [
  'Pulei uma refeição, como fica o resto do dia?',
  'O que eu como agora?',
  'Como foi minha semana de treino e dieta?',
  'Vou comer fora hoje, o que escolher?',
]
