import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ExerciseBrowser from '../components/ExerciseBrowser'
import { useActiveSession } from '../modules/training/activeSession'
import { exerciseName, loadState, saveWorkout } from '../modules/training/data'
import { buildEntry, newRecords, sessionVolume, type NewRecord, type SessionSet } from '../modules/training/session'
import { explain } from '../modules/training/why'
import { formatClock, formatKg } from '../lib/format'

const parseNum = (v: string) => {
  if (v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export default function Workout() {
  const navigate = useNavigate()
  const [session, setSession] = useActiveSession()
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ volume: number; sets: number; records: NewRecord[]; minutes: number } | null>(null)
  const now = useNow()

  const restLeft = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0
  useEffect(() => {
    if (restUntil && restLeft === 0) {
      navigator.vibrate?.([200, 100, 200])
      setRestUntil(null)
    }
  }, [restUntil, restLeft])

  if (summary) return <Summary {...summary} onClose={() => navigate('/')} />

  if (!session) {
    return (
      <main className="page stack">
        <h1>Nenhum treino em andamento</h1>
        <Link to="/" className="btn primary">
          Escolher um treino
        </Link>
      </main>
    )
  }

  const elapsed = Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000))
  const doneCount = session.entries.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0)

  const editSet = (ei: number, si: number, change: Partial<SessionSet>) =>
    setSession(s =>
      s && {
        ...s,
        entries: s.entries.map((e, i) => (i === ei ? { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, ...change } : x)) } : e)),
      },
    )

  const toggleDone = (ei: number, si: number) => {
    const set = session.entries[ei].sets[si]
    editSet(ei, si, { done: !set.done })
    if (!set.done && set.kind === 'work') setRestUntil(Date.now() + session.entries[ei].restSec * 1000)
  }

  const addSet = (ei: number, kind: SessionSet['kind']) =>
    setSession(s => {
      if (!s) return s
      return {
        ...s,
        entries: s.entries.map((e, i) => {
          if (i !== ei) return e
          const lastWork = [...e.sets].reverse().find(x => x.kind === 'work')
          const set: SessionSet =
            kind === 'warmup'
              ? { kind, weight: lastWork?.weight != null ? Math.round(lastWork.weight * 0.5 * 2) / 2 : null, reps: 10, rir: null, done: false }
              : { kind, weight: lastWork?.weight ?? null, reps: lastWork?.reps ?? null, rir: null, done: false }
          return { ...e, sets: kind === 'warmup' ? [set, ...e.sets] : [...e.sets, set] }
        }),
      }
    })

  const removeSet = (ei: number, si: number) =>
    setSession(s => s && { ...s, entries: s.entries.map((e, i) => (i === ei ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e)) })

  const removeEntry = (ei: number) => {
    if (!confirm(`Tirar ${session.entries[ei].name} deste treino?`)) return
    setSession(s => s && { ...s, entries: s.entries.filter((_, i) => i !== ei) })
  }

  async function finish() {
    if (!session) return
    if (doneCount === 0) {
      if (confirm('Nenhuma série marcada como feita. Descartar este treino?')) {
        setSession(null)
        navigate('/')
      }
      return
    }
    if (!confirm('Finalizar e salvar o treino?')) return
    setFinishing(true)
    setError(null)
    try {
      const before = await loadState()
      const records = newRecords(before, session)
      await saveWorkout(session, records)
      setSummary({
        volume: sessionVolume(session),
        sets: doneCount,
        records,
        minutes: Math.round(elapsed / 60),
      })
      setSession(null)
    } catch (err) {
      setError((err as Error).message)
    }
    setFinishing(false)
  }

  function discard() {
    if (!confirm('Descartar este treino? Nada será salvo.')) return
    setSession(null)
    navigate('/')
  }

  return (
    <main className="page stack" style={{ paddingBottom: restUntil ? 120 : 40 }}>
      <div className="spread">
        <div>
          <h1>{session.name}</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {formatClock(elapsed)} · {doneCount} séries feitas
          </p>
        </div>
        <button type="button" className="btn primary" onClick={finish} disabled={finishing}>
          {finishing ? 'Salvando…' : 'Finalizar'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {session.entries.map((entry, ei) => {
        const why = explain(entry.suggestion.why)
        return (
          <section key={`${entry.exerciseId}-${ei}`} className="card">
            <div className="spread">
              <strong>{entry.name}</strong>
              <button type="button" className="btn ghost small" onClick={() => removeEntry(ei)} aria-label={`Tirar ${entry.name}`}>
                ✕
              </button>
            </div>
            {why && <p className="why">{why}</p>}
            <div className="set-grid" style={{ marginTop: why ? 0 : 10 }}>
              <span className="head">#</span>
              <span className="head">kg</span>
              <span className="head">reps</span>
              <span className="head">feita</span>
              {entry.sets.map((set, si) => {
                const workIndex = entry.sets.slice(0, si + 1).filter(x => x.kind === 'work').length
                return (
                  <div key={si} className={set.done ? 'set-done' : ''} style={{ display: 'contents' }}>
                    <button
                      type="button"
                      className="idx btn ghost small"
                      style={{ padding: 0, minHeight: 44 }}
                      title="Toque e segure para remover"
                      onContextMenu={e => {
                        e.preventDefault()
                        removeSet(ei, si)
                      }}
                      onDoubleClick={() => removeSet(ei, si)}
                    >
                      {set.kind === 'warmup' ? 'A' : workIndex}
                    </button>
                    <input
                      className="input"
                      inputMode="decimal"
                      aria-label={`Carga da série ${si + 1}`}
                      value={set.weight ?? ''}
                      placeholder="–"
                      onChange={e => editSet(ei, si, { weight: parseNum(e.target.value) })}
                    />
                    <input
                      className="input"
                      inputMode="numeric"
                      aria-label={`Repetições da série ${si + 1}`}
                      value={set.reps ?? ''}
                      placeholder="–"
                      onChange={e => editSet(ei, si, { reps: parseNum(e.target.value) })}
                    />
                    <button
                      type="button"
                      className={`check ${set.done ? 'on' : ''}`}
                      aria-pressed={set.done}
                      aria-label={`Série ${si + 1} feita`}
                      onClick={() => toggleDone(ei, si)}
                    >
                      ✓
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn small" onClick={() => addSet(ei, 'work')}>
                + Série
              </button>
              <button type="button" className="btn small ghost" onClick={() => addSet(ei, 'warmup')}>
                + Aquecimento
              </button>
              <span className="muted small" style={{ marginLeft: 'auto' }}>
                Descanso {formatClock(entry.restSec)}
              </span>
            </div>
          </section>
        )
      })}
      <p className="muted small" style={{ margin: 0 }}>
        Toque duas vezes no número da série para removê-la. "A" é série de aquecimento.
      </p>

      <button type="button" className="btn" onClick={() => setPicking(true)}>
        + Adicionar exercício
      </button>
      <button type="button" className="btn ghost danger" onClick={discard}>
        Descartar treino
      </button>

      {restUntil && (
        <div className="rest-bar" role="timer" aria-live="polite">
          <span>Descanso {formatClock(restLeft)}</span>
          <div className="row">
            <button type="button" className="btn small" onClick={() => setRestUntil(restUntil + 30000)}>
              +30s
            </button>
            <button type="button" className="btn small" onClick={() => setRestUntil(null)}>
              Pular
            </button>
          </div>
        </div>
      )}

      {picking && (
        <div className="sheet-backdrop" onClick={() => setPicking(false)}>
          <div className="sheet stack" onClick={e => e.stopPropagation()}>
            <div className="spread">
              <h2 style={{ margin: 0 }}>Adicionar exercício</h2>
              <button type="button" className="btn ghost small" onClick={() => setPicking(false)}>
                Fechar
              </button>
            </div>
            <ExerciseBrowser
              onPick={async ex => {
                setPicking(false)
                try {
                  const state = await loadState()
                  const entry = buildEntry(
                    state,
                    { routine_id: session.routineId ?? '', exercise_id: ex.id, sets: 3, rep_min: 8, rep_max: 12, rest_sec: 90, progression: { policy: 'double' } },
                    exerciseName(ex),
                  )
                  setSession(s => s && { ...s, entries: [...s.entries, entry] })
                } catch (err) {
                  setError((err as Error).message)
                }
              }}
            />
          </div>
        </div>
      )}
    </main>
  )
}

function Summary(props: { volume: number; sets: number; records: NewRecord[]; minutes: number; onClose: () => void }) {
  return (
    <main className="page stack">
      <h1>Treino salvo!</h1>
      <div className="grid-3">
        <div className="card stat">
          <span className="muted small">Duração</span>
          <strong>{props.minutes} min</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Séries</span>
          <strong>{props.sets}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Volume</span>
          <strong>{formatKg(props.volume)}</strong>
        </div>
      </div>
      {props.records.length > 0 && (
        <>
          <h2>Recordes novos</h2>
          {props.records.map(r => (
            <Link key={r.exerciseId} to={`/progresso/${r.exerciseId}`} className="list-item">
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div className="muted small">
                  1RM estimado {formatKg(r.value)}
                  {r.previous != null && ` (antes ${formatKg(r.previous)})`}
                </div>
              </div>
              <span className="badge accent">PR</span>
            </Link>
          ))}
        </>
      )}
      <button type="button" className="btn primary block" onClick={props.onClose}>
        Voltar ao início
      </button>
    </main>
  )
}
