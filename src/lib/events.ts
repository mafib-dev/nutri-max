// Avisos entre partes do app que não se conhecem: o nutricionista flutuante abre de qualquer
// tela, e o que ele lança (água, refeição, peso, plano) precisa aparecer na tela aberta.
import { useEffect, useLayoutEffect, useRef } from 'react'

const OPEN = 'nutrimax:coach-open'
const CHANGED = 'nutrimax:data-changed'

/** Abre o nutricionista; com `question`, já envia a pergunta. */
export function openCoach(question?: string) {
  window.dispatchEvent(new CustomEvent(OPEN, { detail: question }))
}

export function useCoachOpen(handler: (question?: string) => void) {
  const ref = useRef(handler)
  useLayoutEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    const on = (e: Event) => ref.current((e as CustomEvent<string | undefined>).detail)
    window.addEventListener(OPEN, on)
    return () => window.removeEventListener(OPEN, on)
  }, [])
}

/** Avisa que dados do dia mudaram fora da tela atual. */
export function notifyDataChanged() {
  window.dispatchEvent(new Event(CHANGED))
}

export function useDataChanged(handler: () => void) {
  const ref = useRef(handler)
  useLayoutEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    const on = () => ref.current()
    window.addEventListener(CHANGED, on)
    return () => window.removeEventListener(CHANGED, on)
  }, [])
}
