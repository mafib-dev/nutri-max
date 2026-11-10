import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { exerciseName, listBodyWeights, loadCatalogue, loadState, saveBodyWeight } from '../modules/training/data'
import { recoveryByMuscle, setsByMuscle, trainedExercises, weeklyTotals, type MuscleRecovery } from '../modules/training/insights'
import { MUSCLE_NAME_PT } from '../modules/training/muscles'
import { fmtRecoveryIn } from '../modules/training/opengym/recovery-view.js'
import { BarChart, LineChart } from '../components/charts'
import { useAsync } from '../lib/useAsync'
import { loadNutritionProfile } from '../modules/nutrition/data'
import { weeksToTarget, weightTrend } from '../modules/nutrition/targets'
import { formatKg } from '../lib/format'

const STATE_LABEL: Record<MuscleRecovery['state'], string> = {
  ready: 'Pronto',
  recovering: 'Recuperando',
  fatigued: 'Cansado',
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const weekLabel = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: 'numeric', month: 'numeric' })

const formatTons = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t` : `${Math.round(kg)} kg`)

export default function Overview() {
  const data = useAsync(async () => [...(await Promise.all([loadState(), loadCatalogue(), listBodyWeights()])), Date.now()] as const)
  const [showAll, setShowAll] = useState(false)

  const [state, catalogue, weights, now] = data.data ?? [null, [], [], 0]
  const byId = useMemo(() => new Map(catalogue.map(e => [e.id, e])), [catalogue])
  const bodyweight = weights.at(-1)?.weight_kg

  const recovery = useMemo(() => (state ? recoveryByMuscle(state, now, bodyweight) : []), [state, now, bodyweight])
  const weeks = useMemo(() => (state ? weeklyTotals(state, 8, now) : []), [state, now])
  const muscles = useMemo(() => (state ? setsByMuscle(state, now) : []), [state, now])
  const trained = useMemo(() => (state ? trainedExercises(state) : []), [state])

  const tired = recovery.filter(m => m.state !== 'ready')
  const thisWeek = weeks.at(-1)
  const empty = state && state.workouts.length === 0

  return (
    <main className="page stack">
      <span className="eyebrow">Como seu corpo está</span>
      <h1>Progresso</h1>
      {data.loading && !data.data && <p className="muted">Carregando…</p>}
      {data.error && <p className="error">{data.error}</p>}
      {empty && <p className="muted">Assim que você salvar um treino, a recuperação dos músculos e o volume aparecem aqui.</p>}

      <div className="cols">
        <div className="col">
          {state && !empty && (
            <>
              <h2>Recuperação</h2>
              {tired.length === 0 ? (
                <p className="card" style={{ margin: 0 }}>
                  Todos os músculos estão recuperados. Pode treinar o que quiser.
                </p>
              ) : (
                <div className="card stack">
                  {(showAll ? recovery : tired).map(m => (
                    <RecoveryRow key={m.muscle} item={m} />
                  ))}
                  <button type="button" className="btn ghost small" style={{ justifySelf: 'start' }} onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Mostrar só os cansados' : 'Ver todos os músculos'}
                  </button>
                </div>
              )}
              <p className="muted small" style={{ margin: 0 }}>
                Estimativa a partir das séries feitas, de quão perto da falha você foi e do tempo que cada músculo leva para se recuperar.
              </p>

              <h2>Esta semana</h2>
              <div className="grid-3">
                <div className="card stat">
                  <span className="muted small">Treinos</span>
                  <strong>{thisWeek?.workouts ?? 0}</strong>
                </div>
                <div className="card stat">
                  <span className="muted small">Séries</span>
                  <strong>{thisWeek?.sets ?? 0}</strong>
                </div>
                <div className="card stat">
                  <span className="muted small">Volume</span>
                  <strong>{formatTons(thisWeek?.volume ?? 0)}</strong>
                </div>
              </div>

              <h2>Volume por semana</h2>
              <BarChart label="Volume por semana" bars={weeks.map(w => ({ label: weekLabel(w.start), value: w.volume }))} format={formatTons} />

              {muscles.length > 0 && (
                <>
                  <h2>Séries por músculo</h2>
                  <div className="card stack">
                    {muscles.map(m => (
                      <SetsRow key={m.muscle} name={MUSCLE_NAME_PT[m.muscle]} thisWeek={m.thisWeek} average={m.average} />
                    ))}
                  </div>
                  <p className="muted small" style={{ margin: 0 }}>
                    Séries em que o músculo é o principal. O tracinho é a sua média das 4 semanas anteriores. Para ganhar massa, 10 a 20 séries por semana costuma ser uma boa faixa.
                  </p>
                </>
              )}
            </>
          )}

        </div>
        <div className="col">
          {data.data && <BodyWeightSection weights={weights} onSaved={data.reload} />}

          {trained.length > 0 && (
            <>
              <h2>Evolução por exercício</h2>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {trained.map(id => (
                  <Link key={id} to={`/progresso/${id}`} className="chip" style={{ textDecoration: 'none', color: 'inherit' }}>
                    {exerciseName(byId.get(id))}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function RecoveryRow({ item }: { item: MuscleRecovery }) {
  const pct = Math.round(item.fatigue * 100)
  return (
    <div>
      <div className="spread small">
        <span style={{ fontWeight: 600 }}>{MUSCLE_NAME_PT[item.muscle]}</span>
        <span className={`fatigue-label ${item.state}`}>
          {STATE_LABEL[item.state]}
          {item.readyInMs != null && ` · pronto ${fmtRecoveryIn(item.readyInMs)}`}
        </span>
      </div>
      <div className="meter" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Cansaço de ${MUSCLE_NAME_PT[item.muscle]}`}>
        <span className={item.state} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  )
}

function SetsRow({ name, thisWeek, average }: { name: string; thisWeek: number; average: number }) {
  const scale = Math.max(20, thisWeek, average)
  return (
    <div>
      <div className="spread small">
        <span style={{ fontWeight: 600 }}>{name}</span>
        <span className="muted">
          {thisWeek} {thisWeek === 1 ? 'série' : 'séries'}
          {average > 0 && ` · média ${average.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`}
        </span>
      </div>
      <div className="meter">
        <span className="ready" style={{ width: `${(thisWeek / scale) * 100}%` }} />
        {average > 0 && <i style={{ left: `${(average / scale) * 100}%` }} aria-hidden="true" />}
      </div>
    </div>
  )
}

function BodyWeightSection({ weights, onSaved }: { weights: { date: string; weight_kg: number }[]; onSaved: () => void }) {
  const profile = useAsync(() => loadNutritionProfile().catch(() => null))
  const target = profile.data?.target_weight_kg ?? null
  const trend = weightTrend(weights)
  const trendNow = trend.at(-1)
  const weeks = trendNow ? weeksToTarget(trendNow.avg, target, profile.data?.weekly_rate_kg ?? null) : null
  const today = todayIso()
  const todays = weights.find(w => w.date === today)
  const [value, setValue] = useState(todays ? String(todays.weight_kg).replace('.', ',') : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const last = weights.at(-1)
  const first = weights[0]
  const change = last && first && last !== first ? last.weight_kg - first.weight_kg : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    const kg = Number(value.replace(',', '.'))
    if (!Number.isFinite(kg) || kg < 20 || kg > 400) {
      setError('Digite o peso em kg, por exemplo 78,4.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveBodyWeight(today, Math.round(kg * 10) / 10)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  return (
    <>
      <h2>Peso corporal</h2>
      <form className="card stack" onSubmit={submit}>
        <label className="field">
          <span>{todays ? 'Peso de hoje (pode corrigir)' : 'Peso de hoje'}</span>
          <div className="row">
            <input className="input" inputMode="decimal" placeholder="kg" value={value} onChange={e => setValue(e.target.value)} />
            <button className="btn primary" disabled={busy || !value.trim()}>
              {busy ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </label>
        {error && <p className="error small" style={{ margin: 0 }}>{error}</p>}
        {last && (
          <p className="muted small" style={{ margin: 0 }}>
            Último: {formatKg(last.weight_kg)}
            {change != null && ` · ${change > 0 ? '+' : ''}${formatKg(Math.round(change * 10) / 10)} desde ${new Date(first.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`}
          </p>
        )}
      </form>
      {weights.length >= 2 && (
        <LineChart label="Peso corporal" points={weights.map(w => ({ label: w.date, value: w.weight_kg }))} trend={weights.length >= 3 ? trend.map(t => t.avg) : undefined} target={target} />
      )}
      {trendNow && trendNow.samples >= 2 && (
        <p className="muted small" style={{ margin: 0 }}>
          Média dos últimos 7 dias: <strong style={{ color: 'var(--text)' }}>{formatKg(trendNow.avg)}</strong>. O peso do dia varia até 2 kg com água e sal; a linha grossa mostra a tendência.
          {target != null && weeks != null && (weeks === 0 ? ' Você chegou ao peso-alvo!' : ` No ritmo escolhido, faltam cerca de ${weeks} ${weeks === 1 ? 'semana' : 'semanas'} para o alvo.`)}
        </p>
      )}
    </>
  )
}
