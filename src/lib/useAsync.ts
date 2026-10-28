import { useCallback, useEffect, useState } from 'react'

/** Carrega dados assíncronos com estado de carregamento, erro e recarga. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  })
  const run = useCallback(load, deps)
  const reload = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: null }))
    run().then(
      data => setState({ data, error: null, loading: false }),
      (err: Error) => setState({ data: null, error: err.message, loading: false }),
    )
  }, [run])
  useEffect(reload, [reload])
  return { ...state, reload }
}
