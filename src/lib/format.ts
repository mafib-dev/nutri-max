export const formatKg = (kg: number) => `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })

export function formatDuration(fromIso: string, toIso: string | null) {
  if (!toIso) return ''
  const min = Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000)
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
}

export const formatClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
