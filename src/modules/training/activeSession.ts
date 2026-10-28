// O treino em andamento fica salvo no navegador, para não se perder se a página recarregar.
import { useCallback, useState } from 'react'
import type { Session } from './session'

const KEY = 'nutrimax.activeSession'

export function readActiveSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function writeActiveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch {
    // Sem armazenamento (aba anônima, por exemplo): o treino só vive na memória.
  }
}

export function useActiveSession() {
  const [session, setSession] = useState<Session | null>(readActiveSession)
  const update = useCallback((next: Session | null | ((prev: Session | null) => Session | null)) => {
    setSession(prev => {
      const value = typeof next === 'function' ? next(prev) : next
      writeActiveSession(value)
      return value
    })
  }, [])
  return [session, update] as const
}
