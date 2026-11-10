// Medidas caseiras: "1 concha", "2 ovos", "½ col. de sopa". Os alimentos guardam tudo em
// gramas; as medidas só traduzem a quantidade para o que se usa na cozinha.
import type { Food } from './foods'

export interface Portion {
  /** Singular: "concha", "ovo", "col. de sopa". */
  name: string
  plural: string
  /** Gramas de uma medida. */
  g: number
  /** Conta-se inteiro (ovo, pão, banana): o plano arredonda para unidades. */
  whole?: boolean
}

/** Medidas do alimento, mais a porção do rótulo de um alimento criado pelo usuário. */
export function portionsOf(food: Pick<Food, 'portions' | 'serving_name' | 'serving_g'>): Portion[] {
  const list = Array.isArray(food.portions) ? [...food.portions] : []
  if (food.serving_g && !list.some(p => p.g === food.serving_g)) {
    const name = food.serving_name?.trim() || 'porção'
    // "1 scoop" vira medida "scoop"; o número do rótulo não faz parte do nome.
    const bare = name.replace(/^1\s+/, '')
    list.unshift({ name: bare, plural: bare, g: Number(food.serving_g) })
  }
  return list
}

/** Número de medidas: inteiros, "½" e meios com vírgula ("1,5"). */
export function formatCount(n: number): string {
  if (n === 0.5) return '½'
  if (n === 0.25) return '¼'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export const measureText = (p: Pick<Portion, 'name' | 'plural'>, n: number) => `${formatCount(n)} ${n > 1 ? p.plural : p.name}`

/** Arredonda a quantidade de medidas: inteiros para o que se conta, meios para o resto. */
export function roundCount(p: Portion, count: number): number {
  return p.whole ? Math.round(count) : Math.round(count * 2) / 2
}

/**
 * A medida que melhor descreve uma quantidade em gramas: a que chega mais perto com um
 * número redondo de medidas, até 12 delas e errando no máximo 20%. Null se nenhuma servir.
 */
export function describeGrams(portions: Portion[], grams: number): string | null {
  let best: { text: string; score: number } | null = null
  for (const p of portions) {
    if (!(p.g > 0)) continue
    const n = roundCount(p, grams / p.g)
    if (n < (p.whole ? 1 : 0.5) || n > 12) continue
    const err = Math.abs(n * p.g - grams) / grams
    if (err > 0.2) continue
    // Entre medidas que servem, prefere a que erra menos e, por pouco, a de menos unidades.
    const score = err + (n > 6 ? 0.04 : 0)
    if (!best || score < best.score) best = { text: measureText(p, n), score }
  }
  return best?.text ?? null
}
