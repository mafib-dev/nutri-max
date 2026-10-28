import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { exerciseName, loadCatalogue, loadState } from '../modules/training/data'
import { bestEstimated1RM, estimated1RMSeries } from '../modules/training/state'
import { useAsync } from '../lib/useAsync'
import { formatDay, formatKg } from '../lib/format'

export default function Progress() {
  const { exerciseId = '' } = useParams()
  const navigate = useNavigate()
  const data = useAsync(() => Promise.all([loadState(), loadCatalogue()]), [exerciseId])

  const [state, catalogue] = data.data ?? [null, []]
  const exercise = catalogue.find(e => e.id === exerciseId)
  const series = useMemo(() => (state ? estimated1RMSeries(state, exerciseId) : []), [state, exerciseId])
  const best = state ? bestEstimated1RM(state, exerciseId) : null
  const sessions = useMemo(
    () =>
      (state?.workouts ?? [])
        .filter(w => w.entries.some(e => e.id === exerciseId))
        .reverse()
        .slice(0, 10)
        .map(w => ({ id: w.id, d: w.d, sets: w.entries.filter(e => e.id === exerciseId).flatMap(e => e.sets.filter(s => s.phase !== 'warmup')) })),
    [state, exerciseId],
  )

  return (
    <main className="page stack">
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start' }} onClick={() => navigate(-1)}>
        ‹ Voltar
      </button>
      {data.loading && <p className="muted">Carregando…</p>}
      {data.error && <p className="error">{data.error}</p>}
      {data.data && (
        <>
          <h1>{exerciseName(exercise)}</h1>
          <div className="grid-3">
            <div className="card stat">
              <span className="muted small">1RM estimado</span>
              <strong>{best ? formatKg(Math.round(best.est * 10) / 10) : '–'}</strong>
            </div>
            <div className="card stat">
              <span className="muted small">Melhor série</span>
              <strong>{best ? `${best.w.toLocaleString('pt-BR')}×${best.r}` : '–'}</strong>
            </div>
            <div className="card stat">
              <span className="muted small">Treinos</span>
              <strong>{sessions.length}</strong>
            </div>
          </div>
          <h2>Evolução do 1RM estimado</h2>
          {series.length >= 2 ? <LineChart points={series.map(p => ({ label: p.d, value: p.y }))} /> : <p className="muted small">Faça pelo menos dois treinos com este exercício para ver a curva.</p>}
          <h2>Últimos treinos</h2>
          {sessions.map(s => (
            <div key={s.id} className="card">
              <div className="muted small">{formatDay(s.d + 'T12:00:00')}</div>
              <div>{s.sets.map(x => `${x.w.toLocaleString('pt-BR')}×${x.r}`).join(' · ')}</div>
            </div>
          ))}
        </>
      )}
    </main>
  )
}

function LineChart({ points }: { points: { label: string; value: number }[] }) {
  const W = 360
  const H = 190
  const pad = { l: 36, r: 10, t: 12, b: 26 }
  const values = points.map(p => p.value)
  const lo = Math.floor(Math.min(...values) * 0.95)
  const hi = Math.ceil(Math.max(...values) * 1.05)
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b)
  const ticks = [lo, (lo + hi) / 2, hi]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const short = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

  return (
    <svg className="chart card" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução do 1RM estimado">
      {ticks.map(t => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            {Math.round(t)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r="4" fill="var(--accent)">
          <title>{`${short(p.label)}: ${p.value.toFixed(1)} kg`}</title>
        </circle>
      ))}
      <text x={pad.l} y={H - 8} fontSize="11" fill="var(--muted)">
        {short(points[0].label)}
      </text>
      <text x={W - pad.r} y={H - 8} fontSize="11" textAnchor="end" fill="var(--muted)">
        {short(points[points.length - 1].label)}
      </text>
    </svg>
  )
}
