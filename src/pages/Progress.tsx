import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { exerciseName, loadCatalogue, loadState } from '../modules/training/data'
import { bestEstimated1RM, estimated1RMSeries } from '../modules/training/state'
import { useAsync } from '../lib/useAsync'
import { formatDay, formatKg } from '../lib/format'
import { LineChart } from '../components/charts'

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
    <main className="page narrow stack">
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => navigate(-1)}>
        ‹ Voltar
      </button>
      <span className="eyebrow">Evolução do exercício</span>
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
          {series.length >= 2 ? <LineChart label="Evolução do 1RM estimado" points={series.map(p => ({ label: p.d, value: p.y }))} /> : <p className="muted small">Faça pelo menos dois treinos com este exercício para ver a curva.</p>}
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
