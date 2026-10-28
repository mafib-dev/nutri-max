export interface OgExercise {
  id: string
  n: string
  bp: string
  eq: string
  tg: string
  sm: string[]
  [key: string]: unknown
}
export const EXDB: OgExercise[]
export const EXIDX: Record<string, OgExercise>
export function fromExerciseRow(row: object): OgExercise
export function registerCatalogue(rows: readonly object[]): void
export function exerciseOf(idOrEx: string | OgExercise): OgExercise | undefined
export function isAssisted(idOrEx: unknown): boolean
export function isCardio(idOrEx: unknown): boolean
export function isBodyweightEq(idOrEx: unknown): boolean
export function isLoadedEq(idOrEx: unknown): boolean
export function defaultIncrement(exId: string, unit: 'kg' | 'lb'): number
