import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listBodyWeights, listRoutines, listWorkouts, WEEKDAYS } from '../modules/training/data'
import { listLogs, loadNutritionProfile, todayIso } from '../modules/nutrition/data'
import { sumMacros } from '../modules/nutrition/foods'
import { dailyTargets } from '../modules/nutrition/targets'
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
  const food = useAsync(() => Promise.all([loadNutritionProfile(), listBodyWeights(1), listLogs(todayIso())]))

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
      <div className="page-head">
        <div>
          <span className="eyebrow">
            {WEEKDAYS[today]}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
          </span>
          <h1>Bora treinar</h1>
        </div>
        <button type="button" className="btn ghost small" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>

      {active && (
        <Link to="/treino" className="card hero" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="eyebrow">Em andamento</span>
          <div className="spread" style={{ marginTop: 6 }}>
            <div style={{ minWidth: 0 }}>
              <h3 className="ellipsis" style={{ fontSize: '1.6rem' }}>{active.name}</h3>
              <div className="muted small">
                {active.entries.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0)} de{' '}
                {active.entries.reduce((n, e) => n + e.sets.length, 0)} séries feitas
              </div>
            </div>
            <span className="btn primary">Continuar</span>
          </div>
        </Link>
      )}

      {error && <p className="error">{error}</p>}
      {data.loading && <p className="muted">Carregando…</p>}
      {data.error && <p className="error">{data.error}</p>}

      {data.data && routines.length === 0 && (
        <div className="empty">
          <h3>Nenhuma rotina ainda</h3>
          <span className="muted small">Monte seu primeiro treino: escolha os exercícios, as séries e o dia da semana.</span>
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

      {food.data && <FoodToday data={food.data} />}

      {last && (
        <>
          <h2>Último treino</h2>
          <Link to="/historico" className="list-item" style={{ padding: 14 }}>
            <div className="grow">
              <div className="title">{last.name ?? 'Treino'}</div>
              <div className="muted small">
                {formatDay(last.started_at)} · {last.sets} séries · {formatKg(last.volume)}
              </div>
            </div>
            <span className="chev">›</span>
          </Link>
        </>
      )}
    </main>
  )
}

function RoutineCard(props: { name: string; hint: string; starting: boolean; onStart: () => void; highlight?: boolean }) {
  if (props.highlight) {
    return (
      <div className="card hero stack" style={{ gap: 14, padding: 20 }}>
        <div>
          <span className="eyebrow">{props.hint}</span>
          <h3 style={{ fontSize: '2.2rem', marginTop: 4 }}>{props.name}</h3>
        </div>
        <button type="button" className="btn primary big block" onClick={props.onStart} disabled={props.starting}>
          {props.starting ? 'Preparando…' : 'Começar treino'}
        </button>
      </div>
    )
  }
  return (
    <div className="card spread">
      <div style={{ minWidth: 0 }}>
        <div className="title ellipsis" style={{ fontWeight: 700 }}>
          {props.name}
        </div>
        <div className="muted small">{props.hint}</div>
      </div>
      <button type="button" className="btn small" onClick={props.onStart} disabled={props.starting}>
        {props.starting ? 'Preparando…' : 'Começar'}
      </button>
    </div>
  )
}

function FoodToday({ data: [profile, weights, logs] }: { data: [Parameters<typeof dailyTargets>[0], { weight_kg: number }[], Parameters<typeof sumMacros>[0]] }) {
  const total = sumMacros(logs)
  const targets = dailyTargets(profile, weights.at(-1)?.weight_kg ?? null)
  const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  return (
    <>
      <h2>Alimentação de hoje</h2>
      <Link to="/nutricao" className="list-item" style={{ padding: 14 }}>
        <div className="grow">
          <div className="title">
            {fmt(total.kcal)}
            {targets ? ` de ${fmt(targets.kcal)}` : ''} kcal
          </div>
          <div className="muted small">
            {logs.length === 0
              ? 'Nada registrado ainda. Toque para lançar uma refeição.'
              : `Proteína ${fmt(total.protein_g)}${targets ? ` de ${fmt(targets.protein_g)}` : ''} g`}
          </div>
        </div>
        <span className="chev">›</span>
      </Link>
    </>
  )
}
