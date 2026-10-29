import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NutritionSummary from '../components/NutritionSummary'
import { listBodyWeights, listRoutines, listWorkouts, loadState, saveBodyWeight, WEEKDAYS } from '../modules/training/data'
import { recoveryByMuscle, weeklyTotals } from '../modules/training/insights'
import { MUSCLE_NAME_PT } from '../modules/training/muscles'
import { getWater, listLogs, listLogTotals, loadFirstName, loadMealPlan, loadNutritionProfile, setWater, todayIso, workoutMinutesOn } from '../modules/nutrition/data'
import { sumMacros } from '../modules/nutrition/foods'
import { dailyTargets, GOALS, waterTarget, weeksToTarget, weightTrend, workoutKcal } from '../modules/nutrition/targets'
import { portion, replanDay } from '../modules/nutrition/plan'
import { QUICK_PROMPTS } from '../modules/coach/coach'
import { dayTips, daysBetween, greeting, waterExpected, weekNutrition } from '../modules/home/today'
import { startRoutine } from '../modules/training/start'
import { useActiveSession } from '../modules/training/activeSession'
import { useAsync } from '../lib/useAsync'
import { openCoach, useDataChanged } from '../lib/events'
import { supabase } from '../lib/supabase'
import { formatDay, formatKg } from '../lib/format'

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const liters = (ml: number) => (ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const formatTons = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t` : `${Math.round(kg)} kg`)

const shift = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return todayIso(d)
}

export default function Today() {
  const navigate = useNavigate()
  const [active, setActive] = useActiveSession()
  const [now] = useState(() => new Date())
  const today = todayIso(now)
  const training = useAsync(() => Promise.all([listRoutines(), listWorkouts(1), loadState(), workoutMinutesOn(today)]))
  const body = useAsync(() => Promise.all([loadFirstName(), loadNutritionProfile(), listBodyWeights(60)]))
  const food = useAsync(() => Promise.all([listLogs(today), getWater(today), listLogTotals(shift(today, -7), today)]))
  const mealPlan = useAsync(loadMealPlan)
  // O nutricionista flutuante pode lançar água, refeição, peso ou mudar o plano.
  useDataChanged(() => {
    body.reload()
    food.reload()
    mealPlan.reload()
  })
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waterMl, setWaterMl] = useState<number | null>(null)

  const weekday = now.getDay()
  const [routines, recent, state, minutesToday] = training.data ?? [[], [], null, []]
  const [name, profile, weights] = body.data ?? [null, null, []]
  const [logs, savedWater, weekRows] = food.data ?? [[], 0, []]

  const last = recent[0]
  const todays = routines.filter(r => r.weekday === weekday)
  const others = routines.filter(r => r.weekday !== weekday)
  const trainedToday = minutesToday.length > 0

  const weight = weights.at(-1)?.weight_kg ?? null
  const trend = weightTrend(weights).at(-1)?.avg ?? null
  const trainingKcal = profile?.add_workout_kcal && weight ? minutesToday.reduce((a, m) => a + workoutKcal(m, weight), 0) : 0
  const targets = profile ? dailyTargets(profile, weight, now, trainingKcal) : null
  const eaten = sumMacros(logs)
  const water = waterMl ?? savedWater
  const waterGoal = waterTarget(weight)
  const week = weekNutrition(weekRows, today, targets?.protein_g ?? null)

  const baseTargets = profile ? dailyTargets(profile, weight, now) : null
  // O dia real contra o plano: refeição pulada ou comida a mais reajusta as próximas.
  const day =
    targets && mealPlan.data && food.data
      ? replanDay(
          targets,
          mealPlan.data,
          eaten,
          logs.map(l => l.meal),
          now.getHours() * 60 + now.getMinutes(),
        )
      : null
  const upcoming = day?.rest[0] ?? null

  const recovery = state ? recoveryByMuscle(state, now.getTime(), weight ?? undefined) : []
  const tired = recovery.filter(m => m.state !== 'ready').map(m => MUSCLE_NAME_PT[m.muscle])
  const thisWeek = state ? weeklyTotals(state, 1, now.getTime())[0] : null
  const planned = routines.filter(r => r.weekday != null).length

  const ready = training.data && body.data && food.data
  const tips = ready
    ? dayTips({
        hour: now.getHours() + now.getMinutes() / 60,
        goal: profile?.goal ?? null,
        targets,
        eaten,
        logged: logs.length,
        trainedToday,
        trainingKcal,
        workoutPending: todays.length > 0 && !trainedToday,
        waterMl: water,
        waterGoal,
        week,
        weightKg: weight,
        daysSinceWeighIn: weights.length ? daysBetween(weights.at(-1)!.date, today) : null,
        tiredMuscles: tired,
      })
    : []

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

  async function addWater(delta: number) {
    const next = Math.max(0, water + delta)
    setWaterMl(next)
    try {
      await setWater(today, next)
    } catch {
      setWaterMl(water)
    }
  }

  const loadError = training.error ?? body.error ?? food.error

  return (
    <main className="page stack">
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">
            {WEEKDAYS[weekday]}, {now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
          </span>
          <h1 className="ellipsis">
            {greeting(now.getHours())}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
        <button type="button" className="btn ghost small" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loadError && <p className="error">{loadError}</p>}
      {!ready && !loadError && <p className="muted">Carregando…</p>}

      {body.data && (
        <BodyCard
          weight={weight}
          trend={trend}
          goal={profile?.goal ?? null}
          targetKg={profile?.target_weight_kg ?? null}
          rateKg={profile?.weekly_rate_kg ?? null}
          weighedToday={weights.at(-1)?.date === today}
          onSaved={body.reload}
          today={today}
        />
      )}

      {active ? (
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
      ) : trainedToday ? (
        <div className="card hero">
          <span className="eyebrow">Treino de hoje</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: 4 }}>Feito ✓</h3>
          <div className="muted small">
            {fmt(minutesToday.reduce((a, m) => a + m, 0))} min de musculação
            {weight ? ` · cerca de ${fmt(minutesToday.reduce((a, m) => a + workoutKcal(m, weight), 0))} kcal gastas` : ''}
          </div>
        </div>
      ) : (
        todays.map(r => <RoutineCard key={r.id} name={r.name} hint="Programado para hoje" starting={starting === r.id} onStart={() => start(r.id)} highlight />)
      )}

      {training.data && routines.length === 0 && (
        <div className="empty">
          <h3>Nenhuma rotina ainda</h3>
          <span className="muted small">Monte seu primeiro treino: escolha os exercícios, as séries e o dia da semana.</span>
          <Link to="/rotinas" className="btn primary">
            Criar rotina
          </Link>
        </div>
      )}

      {day && day.adjusted && day.rest.length > 0 && (
        <p className="card small replan-note" style={{ margin: 0 }}>
          {day.skipped.length
            ? `Você não registrou ${day.skipped.map(s => s.label.toLowerCase()).join(', ')}. `
            : 'O que você comeu até agora fugiu do plano. '}
          Ajustei {day.rest.length === 1 ? 'a próxima refeição' : `as próximas ${day.rest.length} refeições`} para fechar o dia: faltam {fmt(day.missing.kcal)} kcal e {fmt(day.missing.p)} g de proteína.
        </p>
      )}

      {upcoming ? (
        <Link to="/nutricao/plano" className="card next-meal" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="spread">
            <span className="eyebrow">
              Próxima refeição · {upcoming.time}
              {day?.adjusted ? ' · ajustada' : ''}
            </span>
            <span className="muted tiny">{fmt(upcoming.total.kcal)} kcal</span>
          </div>
          <h3 style={{ marginTop: 4 }}>{upcoming.label}</h3>
          <ul>
            {upcoming.items.map(i => (
              <li key={`${i.role}-${i.key}`} className="small">
                <span>{i.food.name}</span> <span className="muted">{portion(i.food, i.grams)}</span>
              </li>
            ))}
          </ul>
        </Link>
      ) : (
        mealPlan.data === null &&
        !mealPlan.loading &&
        baseTargets && (
          <Link to="/nutricao/plano" className="list-item" style={{ padding: 14 }}>
            <div className="grow">
              <div className="title">Monte seu plano alimentar</div>
              <div className="muted small">O que comer em cada refeição, com horários e quantidades para bater a meta.</div>
            </div>
            <span className="chev">›</span>
          </Link>
        )
      )}

      <section className="card coach-card" aria-label="Seu nutricionista">
        <div className="spread">
          <div>
            <span className="eyebrow">Seu nutricionista · IA</span>
            <h3 style={{ marginTop: 4 }}>Precisa de ajuda com o dia?</h3>
          </div>
          <button type="button" className="btn small" onClick={() => openCoach()}>
            Conversar
          </button>
        </div>
        <div className="chips wrap">
          {QUICK_PROMPTS.slice(0, 3).map(q => (
            <button key={q} type="button" className="chip small-chip" onClick={() => openCoach(q)}>
              {q}
            </button>
          ))}
        </div>
      </section>

      {tips.length > 0 && (
        <section className="card stack tips" style={{ gap: 10 }} aria-label="Dicas do dia">
          <span className="eyebrow">Treino + dieta hoje</span>
          {tips.map(t => (
            <p key={t.text} className={`tip ${t.tone}`}>
              {t.text}
            </p>
          ))}
        </section>
      )}

      {food.data && body.data && (
        <>
          <div className="spread">
            <h2>Alimentação de hoje</h2>
            <Link to="/nutricao" className="btn ghost small">
              Lançar
            </Link>
          </div>
          <Link to="/nutricao" style={{ textDecoration: 'none', color: 'inherit' }} aria-label="Abrir o diário alimentar">
            <NutritionSummary total={eaten} targets={targets} trainingKcal={trainingKcal} />
          </Link>

          <div className="card">
            <div className="spread small">
              <span style={{ fontWeight: 600 }}>Água</span>
              <span className="muted">
                {liters(water)} / {liters(waterGoal)} L
              </span>
            </div>
            <div className="meter">
              <span className="macro w" style={{ width: `${Math.min((water / waterGoal) * 100, 100)}%` }} />
            </div>
            <div className="spread" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn small" onClick={() => addWater(250)}>
                  + 250 ml
                </button>
                <button type="button" className="btn small" onClick={() => addWater(500)}>
                  + 500 ml
                </button>
              </div>
              <span className="muted small">Ideal até agora: {liters(waterExpected(waterGoal, now.getHours() + now.getMinutes() / 60))} L</span>
            </div>
          </div>
        </>
      )}

      {training.data && food.data && (
        <>
          <h2>Sua semana</h2>
          <div className="grid-2 week-stats">
            <Stat label="Treinos" value={`${thisWeek?.workouts ?? 0}${planned ? ` / ${planned}` : ''}`} hint={planned ? 'feitos / planejados' : 'nesta semana'} />
            <Stat label="Volume" value={formatTons(thisWeek?.volume ?? 0)} hint={`${thisWeek?.sets ?? 0} séries`} />
            <Stat
              label="Média kcal"
              value={week.days ? fmt(week.avgKcal) : '–'}
              hint={week.days ? (targets ? `meta ${fmt(targets.kcal - trainingKcal)} · ${week.days} dias` : `${week.days} dias`) : 'sem registros'}
            />
            <Stat
              label="Proteína"
              value={week.days ? `${fmt(week.avgProtein)} g` : '–'}
              hint={week.days && targets ? `meta batida em ${week.proteinDays} de ${week.days} dias` : 'média por dia'}
            />
          </div>
          {recovery.length > 0 && state && state.workouts.length > 0 && (
            <Link to="/progresso" className="list-item" style={{ padding: 14 }}>
              <div className="grow">
                <div className="title">{tired.length ? `${tired.length} músculos se recuperando` : 'Todos os músculos recuperados'}</div>
                <div className="muted small ellipsis">{tired.length ? tired.join(', ') : 'Pode treinar o que quiser.'}</div>
              </div>
              <span className="chev">›</span>
            </Link>
          )}
        </>
      )}

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

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card stat">
      <span>{label}</span>
      <strong style={{ fontSize: '1.6rem' }}>{value}</strong>
      <small className="muted">{hint}</small>
    </div>
  )
}

function BodyCard(props: {
  weight: number | null
  trend: number | null
  goal: keyof typeof GOALS | null
  targetKg: number | null
  rateKg: number | null
  weighedToday: boolean
  today: string
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const base = props.trend ?? props.weight
  const toGo = base != null && props.targetKg != null ? props.targetKg - base : null
  const weeks = base != null ? weeksToTarget(base, props.targetKg, props.rateKg) : null

  async function save(e: FormEvent) {
    e.preventDefault()
    const kg = Number(value.replace(',', '.'))
    if (!(kg >= 30 && kg <= 300)) return setErr('Informe um peso entre 30 e 300 kg.')
    setBusy(true)
    try {
      await saveBodyWeight(props.today, kg)
      setOpen(false)
      setValue('')
      props.onSaved()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card body-card">
      <div className="body-stats">
        <div className="stat">
          <span>Peso</span>
          <strong>{props.weight != null ? formatKg(props.weight) : '–'}</strong>
          {props.trend != null && <small className="muted">média 7 dias {formatKg(props.trend)}</small>}
        </div>
        <div className="stat">
          <span>Objetivo</span>
          <strong style={{ fontSize: '1.3rem' }}>{props.goal ? GOALS[props.goal].label : '–'}</strong>
          {toGo != null && Math.abs(toGo) >= 0.1 ? (
            <small className="muted">
              {formatKg(Math.abs(toGo))} até {formatKg(props.targetKg!)}
              {weeks ? ` · ~${weeks} sem.` : ''}
            </small>
          ) : props.targetKg != null ? (
            <small className="muted">no peso-alvo</small>
          ) : (
            <Link to="/nutricao/metas" className="small">
              Definir metas
            </Link>
          )}
        </div>
      </div>
      {open ? (
        <form className="row" style={{ gap: 8, marginTop: 12 }} onSubmit={save}>
          <input className="input" inputMode="decimal" placeholder="Peso de hoje (kg)" value={value} onChange={e => setValue(e.target.value)} autoFocus aria-label="Peso de hoje em kg" />
          <button className="btn primary" disabled={busy || !value.trim()}>
            Salvar
          </button>
        </form>
      ) : (
        !props.weighedToday && (
          <button type="button" className="btn small" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
            Registrar peso de hoje
          </button>
        )
      )}
      {err && <p className="error small">{err}</p>}
    </div>
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
