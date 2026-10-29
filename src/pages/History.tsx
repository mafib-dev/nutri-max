import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteWorkout, exerciseName, listWorkouts, loadCatalogue, loadState } from '../modules/training/data'
import { useAsync } from '../lib/useAsync'
import { formatDay, formatDuration, formatKg } from '../lib/format'

export default function History() {
  const list = useAsync(() => Promise.all([listWorkouts(100), loadState(), loadCatalogue()]))
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [workouts, state, catalogue] = list.data ?? [[], null, []]
  const byId = useMemo(() => new Map(catalogue.map(e => [e.id, e])), [catalogue])
  const detail = useMemo(() => new Map((state?.workouts ?? []).map(w => [w.id, w])), [state])

  async function remove(id: string) {
    if (!confirm('Apagar este treino do histórico?')) return
    try {
      await deleteWorkout(id)
      list.reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <main className="page stack">
      <span className="eyebrow">Tudo o que você já fez</span>
      <h1>Histórico</h1>
      {list.loading && <p className="muted">Carregando…</p>}
      {(list.error || error) && <p className="error">{list.error ?? error}</p>}
      {list.data && workouts.length === 0 && <p className="muted">Nenhum treino salvo ainda.</p>}

      {workouts.map(w => {
        const og = detail.get(w.id)
        const expanded = open === w.id
        return (
          <div key={w.id} className="card stack">
            <button type="button" className="spread" style={{ width: '100%', padding: 0, border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => setOpen(expanded ? null : w.id)}>
              <div>
                <div style={{ fontWeight: 600 }}>{w.name ?? 'Treino'}</div>
                <div className="muted small" style={{ fontWeight: 400 }}>
                  {formatDay(w.started_at)}
                  {w.ended_at && ` · ${formatDuration(w.started_at, w.ended_at)}`} · {w.sets} séries · {formatKg(w.volume)}
                </div>
              </div>
              <span className="muted">{expanded ? '−' : '+'}</span>
            </button>
            {expanded && og && (
              <>
                {og.entries.map((e, i) => (
                  <div key={i}>
                    <Link to={`/progresso/${e.id}`} style={{ fontWeight: 600 }}>
                      {exerciseName(byId.get(e.id))}
                    </Link>
                    <div className="muted small">
                      {e.sets
                        .map(s => `${s.phase === 'warmup' ? 'A ' : ''}${s.w.toLocaleString('pt-BR')}×${s.r}${s.rir != null ? ` (RIR ${s.rir})` : ''}`)
                        .join(' · ')}
                    </div>
                  </div>
                ))}
                <button type="button" className="btn ghost small danger" style={{ justifySelf: 'start' }} onClick={() => remove(w.id)}>
                  Apagar treino
                </button>
              </>
            )}
          </div>
        )
      })}
    </main>
  )
}
