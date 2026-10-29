// Contas da tela Hoje: saudação, ritmo da água, resumo da semana e as dicas que juntam treino e dieta.
import type { Goal, Targets } from '../nutrition/targets'
import type { Macros } from '../nutrition/foods'

export function greeting(hour: number) {
  if (hour < 5) return 'Boa noite'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Quanto de água já deveria ter sido bebido até `hour`, espalhando a meta entre 7h e 22h. */
export function waterExpected(goalMl: number, hour: number) {
  const pct = Math.min(Math.max((hour - 7) / 15, 0), 1)
  return Math.round((goalMl * pct) / 250) * 250
}

export interface WeekNutrition {
  /** Dias com algo registrado nos últimos 7 (sem contar hoje). */
  days: number
  avgKcal: number
  avgProtein: number
  /** Dias em que a proteína chegou a 90% da meta. */
  proteinDays: number
}

/** Média dos dias registrados, sem hoje (que ainda está pela metade). */
export function weekNutrition(rows: (Macros & { date: string })[], today: string, proteinTarget: number | null): WeekNutrition {
  const byDay = new Map<string, Macros>()
  for (const r of rows) {
    if (r.date >= today) continue
    const d = byDay.get(r.date) ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    d.kcal += r.kcal
    d.protein_g += r.protein_g
    d.carbs_g += r.carbs_g
    d.fat_g += r.fat_g
    byDay.set(r.date, d)
  }
  const days = [...byDay.values()]
  const n = days.length
  return {
    days: n,
    avgKcal: n ? Math.round(days.reduce((a, d) => a + d.kcal, 0) / n) : 0,
    avgProtein: n ? Math.round(days.reduce((a, d) => a + d.protein_g, 0) / n) : 0,
    proteinDays: proteinTarget ? days.filter(d => d.protein_g >= proteinTarget * 0.9).length : 0,
  }
}

export interface Tip {
  tone: 'good' | 'warn' | 'info'
  text: string
}

export interface DayContext {
  hour: number
  goal: Goal | null
  targets: Targets | null
  eaten: Macros
  /** Itens lançados hoje. */
  logged: number
  trainedToday: boolean
  trainingKcal: number
  /** Há rotina marcada para hoje e ainda não foi feita. */
  workoutPending: boolean
  waterMl: number
  waterGoal: number
  week: WeekNutrition
  weightKg: number | null
  /** Dias desde a última pesagem; null = nunca pesou. */
  daysSinceWeighIn: number | null
  /** Músculos ainda cansados, em português. */
  tiredMuscles: string[]
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')

/** Até 4 dicas, da mais útil para a menos, ligando o treino do dia ao que comer e beber. */
export function dayTips(c: DayContext): Tip[] {
  const tips: Tip[] = []
  const t = c.targets
  const proteinLeft = t ? t.protein_g - c.eaten.protein_g : 0
  const kcalLeft = t ? t.kcal - c.eaten.kcal : 0

  if (!t) tips.push({ tone: 'info', text: 'Preencha suas metas de nutrição para ver quanto comer de calorias e proteína por dia.' })

  if (c.trainedToday && t) {
    if (proteinLeft > 20) tips.push({ tone: 'warn', text: `Você treinou hoje. Faltam ${fmt(proteinLeft)} g de proteína para a recuperação dos músculos.` })
    else tips.push({ tone: 'good', text: 'Treino feito e proteína em dia. Ótima combinação para ganhar força.' })
    if (c.trainingKcal > 0) tips.push({ tone: 'info', text: `O treino de hoje rendeu cerca de ${fmt(c.trainingKcal)} kcal a mais na sua meta.` })
  } else if (c.workoutPending && t) {
    if (c.hour >= 10 && c.eaten.carbs_g < t.carbs_g * 0.25)
      tips.push({ tone: 'info', text: 'Tem treino hoje. Um carboidrato 1 a 2 horas antes (arroz, pão, fruta) ajuda a render mais.' })
    else tips.push({ tone: 'info', text: 'Tem treino hoje. Deixe pelo menos 25 g de proteína para depois dele.' })
  }

  if (t && c.hour >= 19 && c.logged > 0) {
    if (c.goal === 'lose' && kcalLeft < -150) tips.push({ tone: 'warn', text: `Você passou ${fmt(-kcalLeft)} kcal da meta de hoje. Amanhã é outro dia: mantenha a proteína alta.` })
    if (c.goal === 'gain' && kcalLeft > 500) tips.push({ tone: 'warn', text: `Para ganhar massa ainda faltam ${fmt(kcalLeft)} kcal hoje. Um lanche reforçado resolve.` })
  }

  const expected = waterExpected(c.waterGoal, c.hour)
  if (c.waterMl < expected - 500) tips.push({ tone: 'warn', text: `Água abaixo do ritmo: até agora o ideal seria ${(expected / 1000).toLocaleString('pt-BR')} L.` })
  else if (c.waterMl >= c.waterGoal) tips.push({ tone: 'good', text: 'Meta de água do dia cumprida.' })

  if (c.tiredMuscles.length && !c.trainedToday)
    tips.push({ tone: 'info', text: `Ainda se recuperando: ${c.tiredMuscles.slice(0, 3).join(', ').toLowerCase()}. Prefira treinar outros grupos.` })

  if (t && c.week.days >= 3 && c.week.proteinDays < c.week.days / 2)
    tips.push({ tone: 'warn', text: `Proteína bateu a meta em só ${c.week.proteinDays} de ${c.week.days} dias desta semana. É o que mais pesa no ganho de músculo.` })

  if (t && c.week.days >= 3) {
    const diff = c.week.avgKcal - (t.kcal - c.trainingKcal)
    if (c.goal === 'lose' && diff > 200) tips.push({ tone: 'warn', text: `Nesta semana a média foi ${fmt(diff)} kcal acima da meta. Assim o peso demora mais para cair.` })
    if (c.goal === 'gain' && diff < -200) tips.push({ tone: 'warn', text: `Nesta semana a média ficou ${fmt(-diff)} kcal abaixo da meta. Sem sobra de calorias o músculo cresce devagar.` })
  }

  if (c.daysSinceWeighIn == null) tips.push({ tone: 'info', text: 'Registre seu peso para calcular as metas e acompanhar a evolução.' })
  else if (c.daysSinceWeighIn >= 7) tips.push({ tone: 'info', text: `Faz ${c.daysSinceWeighIn} dias da última pesagem. Pese-se de manhã, em jejum.` })

  const order = { warn: 0, info: 1, good: 2 }
  return tips.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 4)
}

export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(toIso + 'T12:00:00Z') - Date.parse(fromIso + 'T12:00:00Z')) / 86400000)
