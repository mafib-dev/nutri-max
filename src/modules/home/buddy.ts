// O boneco da tela Hoje: a pose e as falas mudam conforme o que a pessoa já fez no dia.
import type { Pose } from '../../components/Avatar'

export interface BuddyContext {
  hour: number
  name: string | null
  /** Há um treino em andamento. */
  inWorkout: boolean
  trainedToday: boolean
  /** Nome da rotina de hoje ainda não feita. */
  pendingRoutine: string | null
  waterMl: number
  waterGoal: number
  proteinLeft: number | null
  kcalLeft: number | null
  /** Próxima refeição do plano, ex.: "Almoço às 12:30". */
  nextMeal: string | null
  /** Dica mais útil do dia (de dayTips). */
  tip: string | null
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')

export function buddyPose(c: BuddyContext): Pose {
  if (c.hour >= 23 || c.hour < 5) return 'sleep'
  if (c.inWorkout) return 'train'
  if (c.trainedToday) return 'celebrate'
  if (c.pendingRoutine) return 'train'
  return 'idle'
}

/** Falas na ordem em que aparecem; tocar no boneco passa para a próxima. */
export function buddyLines(c: BuddyContext): string[] {
  const hi = c.name ? `, ${c.name}` : ''
  const lines: string[] = []
  if (c.hour >= 23 || c.hour < 5) lines.push(`Já está tarde${hi}. Dormir bem também faz o músculo crescer.`)
  else if (c.hour < 12) lines.push(`Bom dia${hi}! Bora começar bem?`)
  else if (c.hour < 18) lines.push(`Boa tarde${hi}! Como está o dia?`)
  else lines.push(`Boa noite${hi}! Vamos fechar o dia bem.`)

  if (c.inWorkout) lines.push('Treino em andamento. Bora terminar!')
  else if (c.trainedToday) lines.push('Treino de hoje feito. Mandou bem!')
  else if (c.pendingRoutine) lines.push(`Hoje tem ${c.pendingRoutine}. Vamos treinar?`)
  else lines.push('Hoje é dia de descanso. O músculo cresce na recuperação.')

  if (c.waterMl >= c.waterGoal) lines.push('Meta de água cumprida!')
  else lines.push(`Faltam ${(Math.max(0, c.waterGoal - c.waterMl) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L de água hoje.`)

  if (c.proteinLeft != null) {
    if (c.proteinLeft > 5) lines.push(`Ainda faltam ${fmt(c.proteinLeft)} g de proteína.`)
    else lines.push('Proteína do dia batida!')
  }
  if (c.nextMeal) lines.push(`Próxima refeição: ${c.nextMeal}.`)
  if (c.tip) lines.push(c.tip)
  return [...new Set(lines)]
}
