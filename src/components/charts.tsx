// Gráficos simples em SVG, sem biblioteca: uma linha (evolução) e barras (por semana).

const W = 360
const H = 190
const PAD = { l: 36, r: 10, t: 12, b: 26 }

const shortDate = (d: string) => new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

/**
 * Linha de evolução. Com trend, os pontos ficam discretos e a média móvel vira a linha
 * principal; com target, uma linha tracejada marca o alvo.
 */
export function LineChart({ points, label, unit = 'kg', trend, target }: { points: { label: string; value: number }[]; label: string; unit?: string; trend?: number[]; target?: number | null }) {
  const values = [...points.map(p => p.value), ...(target != null ? [target] : [])]
  const lo = Math.floor(Math.min(...values) * 0.95)
  const hi = Math.ceil(Math.max(...values) * 1.05)
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b)
  const ticks = [lo, (lo + hi) / 2, hi]
  const line = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const path = line(points.map(p => p.value))

  return (
    <svg className="chart card" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
          <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            {Math.round(t)}
          </text>
        </g>
      ))}
      {target != null && (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke="var(--warn)" strokeDasharray="5 4" />
          <text x={W - PAD.r} y={y(target) - 5} textAnchor="end" fontSize="10" fill="var(--warn)">
            alvo {target.toLocaleString('pt-BR')} {unit}
          </text>
        </g>
      )}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={trend ? 1.5 : 2.5} strokeLinejoin="round" opacity={trend ? 0.35 : 1} />
      {trend && <path d={line(trend)} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />}
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={trend ? 3 : 4} fill="var(--accent)" opacity={trend ? 0.6 : 1}>
          <title>{`${shortDate(p.label)}: ${p.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unit}`}</title>
        </circle>
      ))}
      <text x={PAD.l} y={H - 8} fontSize="11" fill="var(--muted)">
        {shortDate(points[0].label)}
      </text>
      <text x={W - PAD.r} y={H - 8} fontSize="11" textAnchor="end" fill="var(--muted)">
        {shortDate(points[points.length - 1].label)}
      </text>
    </svg>
  )
}

/** Barras verticais; a última (a semana atual) fica destacada. */
export function BarChart({ bars, label, format }: { bars: { label: string; value: number }[]; label: string; format: (v: number) => string }) {
  const max = Math.max(1, ...bars.map(b => b.value))
  const slot = (W - PAD.l - PAD.r) / bars.length
  const bw = Math.min(28, slot * 0.6)
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b)

  return (
    <svg className="chart card" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--border)" />
      <text x={PAD.l - 6} y={y(max) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
        {format(max)}
      </text>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(max)} y2={y(max)} stroke="var(--border)" strokeDasharray="3 3" />
      {bars.map((b, i) => {
        const cx = PAD.l + slot * i + slot / 2
        const top = y(b.value)
        const last = i === bars.length - 1
        return (
          <g key={i}>
            <rect
              x={cx - bw / 2}
              y={top}
              width={bw}
              height={Math.max(0, y(0) - top)}
              rx="4"
              fill="var(--accent)"
              opacity={last ? 1 : 0.45}
            >
              <title>{`${b.label}: ${format(b.value)}`}</title>
            </rect>
            {(i % 2 === bars.length % 2 || last) && (
              <text x={cx} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted)">
                {b.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
