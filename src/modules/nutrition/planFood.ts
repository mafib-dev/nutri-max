// Alimento do plano: valores por 100 g, medida caseira e marcações para as trocas.
export type Role = 'protein' | 'carb' | 'legume' | 'veg' | 'salad' | 'fruit' | 'fat'
/** processed = embutido (muito sódio); highGI = sobe a glicose rápido; acid = fruta ácida (refluxo). */
export type Tag = 'meat' | 'fish' | 'pork' | 'egg' | 'lactose' | 'gluten' | 'processed' | 'highGI' | 'acid'

export interface PlanFood {
  /** id na tabela foods (TACO). */
  id: string
  name: string
  /** Por 100 g, copiados da TACO. */
  kcal: number
  p: number
  c: number
  f: number
  fiber: number
  tags: Tag[]
  /** Medida caseira: nome no singular e no plural e gramas de uma unidade. */
  unit: [string, string, number]
  /** Conta em unidades inteiras (ovo, pão) em vez de gramas. */
  whole?: boolean
  /** Teto por refeição (ninguém come 5 bananas de uma vez). */
  max?: number
  /** 1 = barato, 2 = médio, 3 = caro. */
  price?: 1 | 2 | 3
  /** Pronto ou quase: abrir, esquentar, cozinhar rápido. */
  quick?: boolean
}

export const food = (id: string, name: string, kcal: number, p: number, c: number, f: number, fiber: number, tags: Tag[], unit: [string, string, number], whole = false, max?: number, extra: Pick<PlanFood, 'price' | 'quick'> = {}): PlanFood => ({
  id,
  name,
  kcal,
  p,
  c,
  f,
  fiber,
  tags,
  unit,
  whole,
  max,
  ...extra,
})

