import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listRoutines, listWorkouts, WEEKDAYS } from '../modules/training/data'
import { startRoutine } from '../modules/training/start'
import { useActiveSession } from '../modules/training/activeSession'
import { useAsync } from '../lib/useAsync'
import { supabase } from '../lib/supabase'
import { formatDay, formatKg } from '../lib/format'

export default function Today() {
  const navigate = useNavigate()
  const [active, setActive] = useActiveSession()
  const data = useAsync(() => Promise.all([listRoutines(), listWorkouts(1)]))
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().getDay()
  const routines = data.data?.[0] ?? []
  const last = data.data?.[1][0]
  const todays = routines.filter(r => r.weekday === today)
  const others = routines.filter(r => r.weekday !== today)

  async function start(id: string) {
    if (active && !confirm('Já existe um treino em andamento. Descartar e começar outro?')) return
    setStarting(id)
    setError(null)
    try {
      setActive(await startRoutine(id))
      navigate('/treino')
    } catch (err) {
      setError((err as Error).message)
      setStarting(null)
    }
  }

  return (
    <main className="page stack">
      <div className="spread">
        <div>
          <h1>Hoje</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {WEEKDAYS[today]}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button type="button" className="btn ghost small" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>

      {active && (
        <Link to="/treino" className="card" style={{ textDecoration: 'none', color: 'inherit', borderColor: 'var(--accent)' }}>
          <div className="spread">
            <div>
              <div style={{ fontWeight: 600 }}>{active.name} em andamento</div>
              <div className="muted small">
                {active.entries.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0)} séries feitas
              </div>
            </div>
            <span className="btn primary small">Continuar</span>
          </div>
        </Link>
      )}

      {error && <p className="error">{error}</p>}
      {data.loading && <p className="muted">Carregando…</p>}
      {data.error && <p className="error">{data.error}</p>}

      {data.data && routines.length === 0 && (
        <div className="card">
          <p style={{ marginTop: 0 }}>Comece criando uma rotina de treino.</p>
          <Link to="/rotinas" className="btn primary">
            Criar rotina
          </Link>
        </div>
      )}

      {todays.length > 0 && <h2>Treino de hoje</h2>}
      {todays.map(r => (
        <RoutineCard key={r.id} name={r.name} hint="Programado para hoje" starting={starting === r.id} onStart={() => start(r.id)} highlight />
      ))}

      {others.length > 0 && <h2>{todays.length ? 'Outras rotinas' : 'Suas rotinas'}</h2>}
      {others.map(r => (
        <RoutineCard
          key={r.id}
          name={r.name}
          hint={r.weekday == null ? 'Sem dia fixo' : WEEKDAYS[r.weekday]}
          starting={starting === r.id}
          onStart={() => start(r.id)}
        />
      ))}

      {last && (
        <>
          <h2>Último treino</h2>
          <Link to="/historico" className="list-item">
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{last.name ?? 'Treino'}</div>
              <div className="muted small">
                {formatDay(last.started_at)} · {last.sets} séries · {formatKg(last.volume)}
              </div>
            </div>
            <span className="muted">›</span>
          </Link>
        </>
      )}
    </main>
  )
}

function RoutineCard(props: { name: string; hint: string; starting: boolean; onStart: () => void; highlight?: boolean }) {
  return (
    <div className="card spread" style={props.highlight ? { borderColor: 'var(--accent)' } : undefined}>
      <div>
        <div style={{ fontWeight: 600 }}>{props.name}</div>
        <div className="muted small">{props.hint}</div>
      </div>
      <button type="button" className={`btn small ${props.highlight ? 'primary' : ''}`} onClick={props.onStart} disabled={props.starting}>
        {props.starting ? 'Preparando…' : 'Começar'}
      </button>
    </div>
  )
}
