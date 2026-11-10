import type { Transition } from 'motion/react'

export const EASE = [0.16, 1, 0.3, 1] as const

/** Entrada e saída de itens de lista: aparece subindo um pouco, sai encolhendo, e os vizinhos deslizam. */
export const listItem = {
  layout: 'position',
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
  transition: { duration: 0.22, ease: EASE } satisfies Transition,
} as const

/**
 * Chaves que não mudam quando um item do meio sai ou troca de lugar: o id mais a ocorrência
 * (o mesmo exercício duas vezes vira "id#0" e "id#1").
 */
export function stableKeys<T>(list: T[], id: (item: T) => string): string[] {
  const seen = new Map<string, number>()
  return list.map(item => {
    const k = id(item)
    const n = seen.get(k) ?? 0
    seen.set(k, n + 1)
    return `${k}#${n}`
  })
}
