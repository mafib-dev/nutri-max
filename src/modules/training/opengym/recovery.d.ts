export function fatigueOf(workouts: object[], now: number, opts?: { unit?: string; bodyweightKg?: number }): Record<string, number>
export function strengthOf(workouts: object[], now: number, opts?: object): Record<string, number>
export function fatigueHalfLifeOf(slug: string): number
