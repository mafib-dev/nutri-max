// Cadastro do primeiro login: o que falta no perfil, a validação de cada passo e a aparência do
// boneco. O cadastro inicial (e-mail e senha) continua igual; isto completa o perfil depois.
import type { ActivityLevel, Goal, NutritionProfile, Sex } from '../nutrition/targets'
import { ageOn } from '../nutrition/targets'
import { HAIR_COLORS, SKIN_TONES, type AvatarLook } from './look'

export type Experience = 'beginner' | 'intermediate' | 'expert'

export const EXPERIENCE: Record<Experience, { label: string; hint: string }> = {
  beginner: { label: 'Iniciante', hint: 'Treino há menos de 6 meses' },
  intermediate: { label: 'Intermediário', hint: 'Treino há 6 meses a 2 anos' },
  expert: { label: 'Avançado', hint: 'Treino há mais de 2 anos' },
}

export interface ProfileSetup {
  display_name: string | null
  sex: Sex | null
  birth_date: string | null
  height_cm: number | null
  weight_kg: number | null
  goal: Goal | null
  target_weight_kg: number | null
  activity_level: ActivityLevel | null
  level: Experience | null
}

/** O perfil está completo quando já dá para chamar a pessoa pelo nome e calcular as metas. */
export function isComplete(p: ProfileSetup): boolean {
  return !!(p.display_name?.trim() && p.sex && p.birth_date && p.height_cm && p.weight_kg && p.goal && p.activity_level)
}

export const STEPS = ['name', 'sex', 'birth', 'body', 'goal', 'activity', 'done'] as const
export type Step = (typeof STEPS)[number]

/** Aceita "80,5" ou "80.5". Vazio ou inválido vira null. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Mensagem do que impede seguir no passo, ou null se está tudo certo. */
export function stepError(step: Step, p: ProfileSetup, today = new Date()): string | null {
  switch (step) {
    case 'name': {
      const name = p.display_name?.trim() ?? ''
      if (!name) return 'Diga como podemos te chamar.'
      if (name.length > 40) return 'Use um nome de até 40 letras.'
      return null
    }
    case 'sex':
      return p.sex ? null : 'Escolha uma opção.'
    case 'birth': {
      if (!p.birth_date || !/^\d{4}-\d{2}-\d{2}$/.test(p.birth_date)) return 'Informe sua data de nascimento.'
      const age = ageOn(p.birth_date, today)
      if (age < 13) return 'O NutriMax é para quem tem 13 anos ou mais.'
      if (age > 100) return 'Confira o ano de nascimento.'
      return null
    }
    case 'body':
      if (!p.height_cm || p.height_cm < 120 || p.height_cm > 230) return 'Informe a altura em centímetros, entre 120 e 230.'
      if (!p.weight_kg || p.weight_kg < 30 || p.weight_kg > 300) return 'Informe o peso entre 30 e 300 kg.'
      return null
    case 'goal':
      if (!p.goal) return 'Escolha um objetivo.'
      if (p.target_weight_kg != null) {
        if (p.target_weight_kg < 30 || p.target_weight_kg > 300) return 'O peso-alvo precisa ficar entre 30 e 300 kg.'
        if (p.weight_kg && p.goal === 'lose' && p.target_weight_kg >= p.weight_kg) return 'Para perder gordura, o peso-alvo fica abaixo do peso atual.'
        if (p.weight_kg && p.goal === 'gain' && p.target_weight_kg <= p.weight_kg) return 'Para ganhar massa, o peso-alvo fica acima do peso atual.'
      }
      return null
    case 'activity':
      return p.activity_level ? null : 'Escolha o nível de atividade.'
    default:
      return null
  }
}

/** Primeiro passo que ainda falta, para quem já preencheu parte do perfil em outra tela. */
export function firstOpenStep(p: ProfileSetup): number {
  const i = STEPS.findIndex(s => s !== 'done' && stepError(s, p) !== null)
  return i === -1 ? 0 : i
}

/** Perfil de nutrição a partir do cadastro, mantendo o que a pessoa já tinha ajustado. */
export function toNutritionProfile(p: ProfileSetup, base: Partial<NutritionProfile> = {}): NutritionProfile {
  return {
    kcal_target: null,
    protein_target_g: null,
    carbs_target_g: null,
    fat_target_g: null,
    weekly_rate_kg: null,
    add_workout_kcal: true,
    ...base,
    sex: p.sex,
    birth_date: p.birth_date,
    height_cm: p.height_cm,
    activity_level: p.activity_level,
    goal: p.goal,
    target_weight_kg: p.goal === 'maintain' ? null : p.target_weight_kg,
  }
}

/** Aparência guardada nos dados da conta; valores fora da lista voltam ao padrão. */
export function readLook(meta: unknown): AvatarLook | null {
  const a = (meta as { avatar?: { skin?: unknown; hair?: unknown } } | null)?.avatar
  if (!a) return null
  const ok = (v: unknown, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < max
  return { skin: ok(a.skin, SKIN_TONES.length) ? (a.skin as number) : 1, hair: ok(a.hair, HAIR_COLORS.length) ? (a.hair as number) : 0 }
}
