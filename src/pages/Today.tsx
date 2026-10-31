import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, useNavigate } from 'react-router-dom'
import NutritionSummary from '../components/NutritionSummary'
import type { Pose } from '../components/Avatar'
import { Buddy3D } from '../components/Buddy3D'
import { listBodyWeights, listRoutines, loadState, onDay, saveBodyWeight, WEEKDAYS } from '../modules/training/data'
import { recoveryByMuscle } from '../modules/training/insights'
import { MUSCLE_NAME_PT } from '../modules/training/muscles'
import { getWater, listLogs, listLogTotals, loadFirstName, loadMealPlan, loadNutritionProfile, setWater, todayIso, workoutMinutesOn } from '../modules/nutrition/data'
import { sumMacros } from '../modules/nutrition/foods'
import { dailyTargets, waterTarget, type Sex, weeksToTarget, weightTrend, workoutKcal } from '../modules/nutrition/targets'
import { portion, replanDay } from '../modules/nutrition/plan'
import { dayTips, daysBetween, greeting, weekNutrition } from '../modules/home/today'
import { startRoutine } from '../modules/training/start'
import { useActiveSession } from '../modules/training/activeSession'
import { useAsync } from '../lib/useAsync'
import { useDataChanged } from '../lib/events'
import { useAuth } from '../lib/auth'
import { buddyLines, buddyPose } from '../modules/home/buddy'
import { readLook } from '../modules/profile/setup'
import { DEFAULT_LOOK, type AvatarLook } from '../modules/profile/look'
import { supabase } from '../lib/supabase'
import { formatKg } from '../lib/format'

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const liters = (ml: number) => (ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })

const shift = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return todayIso(d)
}

export default function Today() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [active, setActive] = useActiveSession()
  const [now] = useState(() => new Date())
  const today = todayIso(now)
  const training = useAsync(() => Promise.all([listRoutines(), loadState(), workoutMinutesOn(today)]))
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
  const [routines, state, minutesToday] = training.data ?? [[], null, []]
  const [name, profile, weights] = body.data ?? [null, null, []]
  const [logs, savedWater, weekRows] = food.data ?? [[], 0, []]

  const todays = routines.filter(r => onDay(r, weekday))
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

  const buddy = {
    hour: now.getHours() + now.getMinutes() / 60,
    name,
    inWorkout: !!active,
    trainedToday,
    pendingRoutine: !trainedToday && todays.length ? todays.map(r => r.name).join(' e ') : null,
    waterMl: water,
    waterGoal,
    proteinLeft: targets ? targets.protein_g - eaten.protein_g : null,
    kcalLeft: targets ? targets.kcal - eaten.kcal : null,
    nextMeal: upcoming ? `${upcoming.label.toLowerCase()} às ${upcoming.time}` : null,
    tip: tips[0]?.text ?? null,
  }

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
        <div className="row" style={{ gap: 6 }}>
          <Link to="/perfil" className="btn ghost small">
            Perfil
          </Link>
          <button type="button" className="btn ghost small" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </div>
      </div>

      {ready && (
        <Buddy
          sex={profile?.sex ?? null}
          look={readLook(session?.user.user_metadata) ?? DEFAULT_LOOK}
          lines={buddyLines(buddy)}
          pose={buddyPose(buddy)}
        />
      )}

      {error && <p className="error">{error}</p>}
      {loadError && <p className="error">{loadError}</p>}
      {!ready && !loadError && <p className="muted">Carregando…</p>}

      <div className="cols">
        <div className="col">
          {active ? (
            <Link to="/treino" className="card today-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="grow">
                <span className="label">Treino em andamento</span>
                <div className="title ellipsis">{active.name}</div>
                <div className="muted small">
                  {active.entries.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0)} de {active.entries.reduce((n, e) => n + e.sets.length, 0)} séries
                </div>
              </div>
              <span className="btn primary small">Continuar</span>
            </Link>
          ) : trainedToday ? (
            <div className="card today-row">
              <div className="grow">
                <span className="label">Treino de hoje</span>
                <div className="title">Feito</div>
                <div className="muted small">
                  {fmt(minutesToday.reduce((a, m) => a + m, 0))} min{weight ? ` · ~${fmt(trainingKcal || minutesToday.reduce((a, m) => a + workoutKcal(m, weight), 0))} kcal` : ''}
                </div>
              </div>
            </div>
          ) : todays.length > 0 ? (
            todays.map(r => (
              <div key={r.id} className="card today-row">
                <div className="grow">
                  <span className="label">Treino de hoje</span>
                  <div className="title ellipsis">{r.name}</div>
                  {tired.length > 0 && <div className="muted small ellipsis">Ainda se recuperando: {tired.slice(0, 3).join(', ')}</div>}
                </div>
                <button type="button" className="btn primary small" onClick={() => start(r.id)} disabled={starting === r.id}>
                  {starting === r.id ? 'Preparando…' : 'Começar'}
                </button>
              </div>
            ))
          ) : training.data && routines.length === 0 ? (
            <Link to="/rotinas" className="card today-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="grow">
                <span className="label">Treino</span>
                <div className="title">Crie sua primeira rotina</div>
              </div>
              <span className="chev">›</span>
            </Link>
          ) : (
            training.data && (
              <Link to="/rotinas" className="card today-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="grow">
                  <span className="label">Treino de hoje</span>
                  <div className="title">Descanso</div>
                </div>
                <span className="chev">›</span>
              </Link>
            )
          )}

          {food.data && body.data && (
            <>
              <Link to="/nutricao" style={{ textDecoration: 'none', color: 'inherit' }} aria-label="Abrir o diário alimentar">
                <NutritionSummary total={eaten} targets={targets} trainingKcal={trainingKcal} />
              </Link>

              <div className="card today-row water-row">
                <div className="grow">
                  <span className="label">Água</span>
                  <div className="title">
                    {liters(water)} <span className="muted small">de {liters(waterGoal)} L</span>
                  </div>
                  <div className="meter">
                    <span className="macro w" style={{ width: `${Math.min((water / waterGoal) * 100, 100)}%` }} />
                  </div>
                </div>
                <button type="button" className="btn small" onClick={() => addWater(250)} aria-label="Adicionar 250 ml de água">
                  + 250 ml
                </button>
              </div>
            </>
          )}
        </div>
        <div className="col">
          {upcoming ? (
            <Link to="/nutricao/plano" className="card next-meal" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="spread">
                <span className="label">Próxima refeição · {upcoming.time}</span>
                <span className="muted small">{fmt(upcoming.total.kcal)} kcal</span>
              </div>
              <div className="title">{upcoming.label}</div>
              <ul>
                {upcoming.items.map(i => (
                  <li key={`${i.role}-${i.key}`} className="small">
                    <span>{i.food.name}</span> <span className="muted">{portion(i.food, i.grams)}</span>
                  </li>
                ))}
              </ul>
              {day?.adjusted && (
                <p className="muted small" style={{ margin: '8px 0 0' }}>
                  {day.skipped.length ? `Ajustada porque você não registrou ${day.skipped.map(s => s.label.toLowerCase()).join(', ')}.` : 'Ajustada ao que você já comeu hoje.'}
                </p>
              )}
            </Link>
          ) : (
            mealPlan.data === null &&
            !mealPlan.loading &&
            baseTargets && (
              <Link to="/nutricao/plano" className="card today-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="grow">
                  <span className="label">Plano alimentar</span>
                  <div className="title">Monte o que comer em cada refeição</div>
                </div>
                <span className="chev">›</span>
              </Link>
            )
          )}

          {body.data && (
            <BodyCard
              weight={weight}
              trend={trend}
              targetKg={profile?.target_weight_kg ?? null}
              rateKg={profile?.weekly_rate_kg ?? null}
              weighedToday={weights.at(-1)?.date === today}
              onSaved={body.reload}
              today={today}
            />
          )}

        </div>
      </div>
    </main>
  )
}

/** O boneco com um balão de fala. Tocar nele faz acenar e passa para a próxima fala. */
function Buddy({ sex, look, lines, pose }: { sex: Sex | null; look: AvatarLook; lines: string[]; pose: Pose }) {
  const [index, setIndex] = useState(0)
  // Acena ao abrir a tela e a cada toque, depois volta para a pose do momento.
  const [waving, setWaving] = useState(pose !== 'sleep')
  useEffect(() => {
    if (!waving) return
    const t = setTimeout(() => setWaving(false), 2400)
    return () => clearTimeout(t)
  }, [waving, index])
  const line = lines[index % lines.length]

  function tap() {
    setIndex(i => i + 1)
    if (pose !== 'sleep') setWaving(true)
  }

  return (
    <section className="card buddy" aria-label="Seu personagem">
      <button type="button" className="buddy-figure" onClick={tap} aria-label="Próxima mensagem">
        <Buddy3D sex={sex} look={look} pose={waving ? 'wave' : pose} size={120} />
      </button>
      <div className="buddy-bubble" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={index} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {line}
          </motion.p>
        </AnimatePresence>
        {lines.length > 1 && (
          <button type="button" className="buddy-next muted tiny" onClick={tap}>
            {(index % lines.length) + 1} de {lines.length} · próxima
          </button>
        )}
      </div>
    </section>
  )
}

function BodyCard(props: { weight: number | null; trend: number | null; targetKg: number | null; rateKg: number | null; weighedToday: boolean; today: string; onSaved: () => void }) {
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
    <div className="card">
      <div className="today-row">
        <div className="grow">
          <span className="label">Peso</span>
          <div className="title">{props.weight != null ? formatKg(props.weight) : '–'}</div>
          <div className="muted small">
            {toGo != null && Math.abs(toGo) >= 0.1 ? (
              <>
                faltam {formatKg(Math.abs(toGo))} para {formatKg(props.targetKg!)}
                {weeks ? ` · ~${weeks} semanas` : ''}
              </>
            ) : props.targetKg != null ? (
              'no peso-alvo'
            ) : (
              <Link to="/nutricao/metas">Definir peso-alvo</Link>
            )}
          </div>
        </div>
        {!props.weighedToday && !open && (
          <button type="button" className="btn small" onClick={() => setOpen(true)}>
            Registrar
          </button>
        )}
      </div>
      {open && (
        <form className="row" style={{ gap: 8, marginTop: 12 }} onSubmit={save}>
          <input className="input" inputMode="decimal" placeholder="Peso de hoje (kg)" value={value} onChange={e => setValue(e.target.value)} autoFocus aria-label="Peso de hoje em kg" />
          <button className="btn primary" disabled={busy || !value.trim()}>
            Salvar
          </button>
        </form>
      )}
      {err && <p className="error small">{err}</p>}
    </div>
  )
}
