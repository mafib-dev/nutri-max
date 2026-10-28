export function fatigueStateOf(value: number): 'ready' | 'recovering' | 'fatigued'
export function fatigueRecoveryMs(value: number, slug: string): { toRecoveringMs: number | null; toReadyMs: number | null }
export function fmtRecoveryIn(ms: number | null): string | null
