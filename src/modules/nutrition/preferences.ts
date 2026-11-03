// Preferências de alimentos: a pessoa escolhe da tabela do plano o que quer e o que não quer.
// A IA (função food-review no Supabase) avalia cada escolha e sugere alternativas, mas só a
// pessoa muda a lista.
import { alternativesFor, isAllowed, PLAN_FOODS, rolesOf, type FoodKey, type PlanSettings, type Role, type SavedPlan } from './plan'
import type { Goal, Targets } from './targets'
import type { Tag } from './planFood'

export type Verdict = 'ok' | 'attention' | 'avoid'

export interface FoodReview {
  verdict: Verdict
  /** Por que, em 1 a 2 frases. */
  reason: string
  /** Alternativas do mesmo papel que cabem nas restrições (até 3). */
  suggestions: FoodKey[]
  at: string
}

export type SavedWithReviews = SavedPlan & { reviews?: Partial<Record<FoodKey, FoodReview>> }

export const VERDICT: Record<Verdict, { label: string; tone: string }> = {
  ok: { label: 'Combina com seu plano', tone: 'ok' },
  attention: { label: 'Atenção', tone: 'warn' },
  avoid: { label: 'Melhor evitar', tone: 'danger' },
}

const ROLE_PT: Record<Role, string> = { protein: 'proteína', carb: 'carboidrato', legume: 'leguminosa', veg: 'legume', salad: 'salada', fruit: 'fruta', fat: 'gordura' }
const TAG_PT: Record<Tag, string> = {
  meat: 'carne',
  fish: 'peixe',
  pork: 'porco',
  egg: 'ovo',
  lactose: 'tem lactose',
  gluten: 'tem glúten',
  processed: 'embutido ou processado (muito sódio)',
  highGI: 'sobe a glicose rápido',
  acid: 'ácido (refluxo)',
}

/** Todos os alimentos que podem ir para a lista (os da tabela do plano, sem o whey, que tem pergunta própria). */
export const PREFERENCE_FOODS = (Object.keys(PLAN_FOODS) as FoodKey[]).filter(k => k !== 'whey' && rolesOf(k).length > 0)

export const roleLabel = (k: FoodKey) => rolesOf(k).map(r => ROLE_PT[r]).join(', ')

/** Liga ou desliga "quero" e "não quero"; marcar um tira do outro. */
export function togglePreference(s: PlanSettings, key: FoodKey, list: 'likes' | 'dislikes'): PlanSettings {
  const other = list === 'likes' ? 'dislikes' : 'likes'
  const on = s[list].includes(key)
  return { ...s, [list]: on ? s[list].filter(k => k !== key) : [...s[list], key], [other]: s[other].filter(k => k !== key) }
}

/** O que vai para a IA avaliar: o alimento, a pessoa e as alternativas que ela pode sugerir. */
export function reviewContext(key: FoodKey, saved: SavedPlan, targets: Targets, goal: Goal | null) {
  const s = saved.settings
  const f = PLAN_FOODS[key]
  const a = s.anamnesis
  return {
    alimento: {
      chave: key,
      nome: f.name,
      papel_no_plano: roleLabel(key),
      por_100g: { kcal: f.kcal, proteina_g: f.p, carboidrato_g: f.c, gordura_g: f.f, fibra_g: f.fiber },
      caracteristicas: f.tags.map(t => TAG_PT[t]),
      medida_caseira: `${f.unit[0]} = ${f.unit[2]} g`,
      cabe_nas_restricoes: isAllowed(key, { ...s, dislikes: [] }),
    },
    pessoa: {
      objetivo: goal ?? 'maintain',
      metas_do_dia: targets,
      dieta: s.diet,
      restricoes: { semLactose: s.noLactose, semGluten: s.noGluten, semPeixe: s.noFish, semPorco: s.noPork, alergias: a.allergies },
      condicoes_de_saude: a.conditions,
      treino: a.training,
      doces: a.sweets,
      orcamento: s.budget,
      cozinha: s.cooking,
    },
    ja_quer: s.likes.filter(k => k !== key).map(k => PLAN_FOODS[k].name),
    alternativas: Object.fromEntries(alternativesFor(key, s).map(k => [k, PLAN_FOODS[k].name])),
  }
}

const VERDICTS: Record<string, Verdict> = { ok: 'ok', atencao: 'attention', 'atenção': 'attention', evitar: 'avoid' }

/** Confere a resposta da IA: veredito conhecido, motivo curto e só alternativas válidas. Null se não der para usar. */
export function parseReview(result: unknown, key: FoodKey, s: PlanSettings, now = new Date()): FoodReview | null {
  const r = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>
  const verdict = VERDICTS[String(r.veredito ?? '').toLowerCase().trim()]
  const reason = typeof r.motivo === 'string' ? r.motivo.trim().slice(0, 400) : ''
  if (!verdict || !reason) return null
  const valid = new Set(alternativesFor(key, s))
  const suggestions = verdict === 'ok' ? [] : [...new Set(Array.isArray(r.sugestoes) ? r.sugestoes : [])].filter((k): k is FoodKey => typeof k === 'string' && valid.has(k as FoodKey)).slice(0, 3)
  return { verdict, reason, suggestions, at: now.toISOString() }
}

/** Troca uma preferência pela sugestão da IA: decisão da pessoa, feita por ela. */
export function swapPreference(saved: SavedWithReviews, from: FoodKey, to: FoodKey): SavedWithReviews {
  const s = saved.settings
  const likes = s.likes.includes(to) ? s.likes.filter(k => k !== from) : s.likes.map(k => (k === from ? to : k))
  const reviews = { ...saved.reviews }
  delete reviews[from]
  return { ...saved, settings: { ...s, likes, dislikes: s.dislikes.filter(k => k !== to) }, reviews }
}
