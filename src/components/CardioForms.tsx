// Janelas para registrar uma atividade de cardio e para montar um plano de cardio.
import { useState, type FormEvent, type ReactNode } from 'react'
import { Modal } from './ui'
import {
  ACTIVITIES,
  distanceInput,
  estimateKcal,
  formatDistance,
  formatDuration,
  formatPace,
  INTENSITIES,
  parseDistance,
  parseDuration,
  type Activity,
  type CardioLog,
  type CardioPlan,
  type Intensity,
  type Intervals,
} from '../modules/cardio/cardio'
import { deleteCardioLog, deleteCardioPlan, saveCardioLog, saveCardioPlan } from '../modules/cardio/data'
import { WEEKDAYS } from '../modules/training/data'

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const intOrNull = (s: string) => {
  const n = Number(s.replace(',', '.'))
  return s.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function ActivityChips({ value, onChange }: { value: Activity; onChange: (a: Activity) => void }) {
  return (
    <div className="field">
      <span>Atividade</span>
      <div className="chips wrap">
        {(Object.keys(ACTIVITIES) as Activity[]).map(a => (
          <button key={a} type="button" className={`chip ${value === a ? 'on' : ''}`} onClick={() => onChange(a)} aria-pressed={value === a}>
            {ACTIVITIES[a].label}
          </button>
        ))}
      </div>
    </div>
  )
}

function IntensityChips({ value, onChange }: { value: Intensity; onChange: (i: Intensity) => void }) {
  return (
    <div className="field">
      <span>Intensidade</span>
      <div className="chips wrap">
        {(Object.keys(INTENSITIES) as Intensity[]).map(i => (
          <button key={i} type="button" className={`chip ${value === i ? 'on' : ''}`} onClick={() => onChange(i)} aria-pressed={value === i} title={INTENSITIES[i].hint}>
            {INTENSITIES[i].label}
          </button>
        ))}
      </div>
      <small className="muted tiny">{INTENSITIES[value].hint}</small>
    </div>
  )
}

interface IntervalsText {
  on: boolean
  reps: string
  work: string
  workKind: 'm' | 'sec'
  rest: string
}

const intervalsText = (i: Intervals | null): IntervalsText => ({
  on: !!i,
  reps: i ? String(i.reps) : '',
  work: i?.work_m ? String(i.work_m) : i?.work_sec ? formatDuration(i.work_sec) : '',
  workKind: i?.work_sec ? 'sec' : 'm',
  rest: i?.rest_sec ? formatDuration(i.rest_sec) : '',
})

/** undefined = inválido; null = sem intervalos. */
function parseIntervals(t: IntervalsText): Intervals | null | undefined {
  if (!t.on) return null
  const reps = intOrNull(t.reps)
  const work = t.workKind === 'm' ? intOrNull(t.work) : parseDuration(t.work)
  const rest = t.rest.trim() ? parseDuration(t.rest) : null
  if (!reps || reps > 100 || !work || (t.rest.trim() && rest == null)) return undefined
  return { reps, work_m: t.workKind === 'm' ? work : null, work_sec: t.workKind === 'sec' ? work : null, rest_sec: rest }
}

function IntervalsFields({ value, onChange }: { value: IntervalsText; onChange: (v: IntervalsText) => void }) {
  const set = (patch: Partial<IntervalsText>) => onChange({ ...value, ...patch })
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={value.on} onChange={e => set({ on: e.target.checked })} />
        <span style={{ fontWeight: 700 }}>Intervalos (tiros)</span>
      </label>
      {value.on && (
        <>
          <div className="chips">
            <button type="button" className={`chip ${value.workKind === 'm' ? 'on' : ''}`} onClick={() => set({ workKind: 'm', work: '' })}>
              Por distância
            </button>
            <button type="button" className={`chip ${value.workKind === 'sec' ? 'on' : ''}`} onClick={() => set({ workKind: 'sec', work: '' })}>
              Por tempo
            </button>
          </div>
          <div className="grid-3">
            <label className="field">
              <span>Repetições</span>
              <input className="input" inputMode="numeric" placeholder="6" value={value.reps} onChange={e => set({ reps: e.target.value })} />
            </label>
            <label className="field">
              <span>{value.workKind === 'm' ? 'Cada tiro (m)' : 'Cada tiro'}</span>
              <input className="input" inputMode={value.workKind === 'm' ? 'numeric' : 'text'} placeholder={value.workKind === 'm' ? '400' : '1:00'} value={value.work} onChange={e => set({ work: e.target.value })} />
            </label>
            <label className="field">
              <span>Descanso</span>
              <input className="input" placeholder="2:00" value={value.rest} onChange={e => set({ rest: e.target.value })} />
            </label>
          </div>
        </>
      )}
    </div>
  )
}

function useRun(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onDone()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  return { busy, error, run }
}

function Footer(props: { busy: boolean; valid: boolean; onDelete?: () => void; error: string | null; extra?: ReactNode }) {
  return (
    <>
      {props.error && <p className="error small">{props.error}</p>}
      {props.onDelete ? (
        <div className="grid-2">
          <button type="button" className="btn danger" disabled={props.busy} onClick={props.onDelete}>
            Apagar
          </button>
          <button className="btn primary" disabled={!props.valid || props.busy}>
            {props.busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      ) : (
        <button className="btn primary big block" disabled={!props.valid || props.busy}>
          {props.busy ? 'Salvando…' : 'Salvar'}
        </button>
      )}
    </>
  )
}

export interface LogStart {
  plan: CardioPlan
  distance_m: number | null
  duration_sec: number | null
}

/** Registrar ou editar uma atividade. `from` preenche com a meta de um plano. */
export function CardioLogModal(props: { log?: CardioLog; from?: LogStart; date: string; weightKg: number | null; onClose: () => void; onSaved: () => void }) {
  const base = props.log
  const plan = props.from?.plan
  const [activity, setActivity] = useState<Activity>(base?.activity ?? plan?.activity ?? 'run')
  const [name, setName] = useState(base?.name ?? plan?.name ?? '')
  const [date, setDate] = useState(base?.date ?? props.date)
  const [distance, setDistance] = useState(distanceInput(base?.distance_m ?? props.from?.distance_m ?? null, activity))
  const [duration, setDuration] = useState(base ? formatDuration(base.duration_sec) : plan?.duration_sec ? formatDuration(plan.duration_sec) : '')
  const [intensity, setIntensity] = useState<Intensity>(base?.intensity ?? plan?.intensity ?? 'easy')
  const [intervals, setIntervals] = useState(intervalsText(base?.intervals ?? plan?.intervals ?? null))
  const [rpe, setRpe] = useState(base?.rpe ? String(base.rpe) : '')
  const [hr, setHr] = useState(base?.avg_hr ? String(base.avg_hr) : '')
  const [kcal, setKcal] = useState(base?.kcal_from_device ? String(base.kcal) : '')
  const [notes, setNotes] = useState(base?.notes ?? '')
  const { busy, error, run } = useRun(props.onSaved)

  const def = ACTIVITIES[activity]
  const distanceM = def.distance ? parseDistance(distance, activity) : null
  const durationSec = parseDuration(duration)
  const parsedIntervals = parseIntervals(intervals)
  const deviceKcal = intOrNull(kcal)
  const estimate = durationSec ? estimateKcal(activity, intensity, distanceM, durationSec, props.weightKg) : 0
  const pace = durationSec ? formatPace(activity, distanceM, durationSec) : null
  const rpeN = intOrNull(rpe)
  const hrN = intOrNull(hr)
  const valid =
    !!durationSec &&
    durationSec <= 86400 &&
    (!distance.trim() || !def.distance || distanceM != null) &&
    parsedIntervals !== undefined &&
    (!rpe.trim() || (rpeN != null && rpeN <= 10)) &&
    (!hr.trim() || (hrN != null && hrN >= 30 && hrN <= 250)) &&
    (!kcal.trim() || deviceKcal != null) &&
    !!date

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    run(() =>
      saveCardioLog(base?.id ?? null, {
        plan_id: base?.plan_id ?? plan?.id ?? null,
        date,
        activity,
        name: name.trim() || def.label,
        distance_m: distanceM,
        duration_sec: durationSec!,
        intensity,
        intervals: parsedIntervals ?? null,
        rpe: rpeN,
        avg_hr: hrN,
        kcal: deviceKcal ?? estimate,
        kcal_from_device: deviceKcal != null,
        notes: notes.trim() || null,
      }),
    )
  }

  function changeActivity(a: Activity) {
    // A natação usa metros no campo; as outras, km.
    if ((a === 'swim') !== (activity === 'swim')) setDistance(distanceInput(parseDistance(distance, activity), a))
    setActivity(a)
  }

  const target = props.from ? [props.from.distance_m ? formatDistance(props.from.distance_m) : null, props.from.duration_sec && plan?.duration_sec ? formatDuration(props.from.duration_sec) : null].filter(Boolean).join(' em ') : ''

  return (
    <Modal title={base ? 'Editar atividade' : plan ? `Registrar: ${plan.name}` : 'Registrar atividade'} onClose={props.onClose} tall>
      <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
        {target && <p className="muted small" style={{ margin: 0 }}>Meta de hoje: {target}. Ajuste com o que você fez de verdade.</p>}
        <ActivityChips value={activity} onChange={changeActivity} />
        <div className="grid-2">
          <label className="field">
            <span>Nome</span>
            <input className="input" placeholder={def.label} value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Data</span>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
        </div>
        <div className="grid-2">
          {def.distance && (
            <label className="field">
              <span>Distância ({activity === 'swim' ? 'm' : 'km'})</span>
              <input className="input" inputMode="decimal" placeholder={activity === 'swim' ? '1000' : '5'} value={distance} onChange={e => setDistance(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Tempo</span>
            <input className="input" placeholder="28:30 ou 30" value={duration} onChange={e => setDuration(e.target.value)} autoFocus={!!props.from} />
          </label>
        </div>
        <IntensityChips value={intensity} onChange={setIntensity} />
        {(def.distance || intervals.on) && <IntervalsFields value={intervals} onChange={setIntervals} />}
        <div className="grid-3">
          <label className="field">
            <span>Esforço (1–10)</span>
            <input className="input" inputMode="numeric" placeholder="6" value={rpe} onChange={e => setRpe(e.target.value)} />
          </label>
          <label className="field">
            <span>FC média</span>
            <input className="input" inputMode="numeric" placeholder="150" value={hr} onChange={e => setHr(e.target.value)} />
          </label>
          <label className="field">
            <span>Calorias</span>
            <input className="input" inputMode="numeric" placeholder={estimate ? String(estimate) : 'do relógio'} value={kcal} onChange={e => setKcal(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Observações</span>
          <input className="input" placeholder="Como foi, percurso, tênis…" value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
        {durationSec && (
          <p className="muted small" style={{ margin: 0 }}>
            {[pace, deviceKcal != null ? `${fmt(deviceKcal)} kcal (do relógio)` : estimate ? `cerca de ${fmt(estimate)} kcal` : props.weightKg ? null : 'registre seu peso para estimar as calorias'].filter(Boolean).join(' · ')}
          </p>
        )}
        <Footer busy={busy} valid={valid} error={error} onDelete={base ? () => confirm('Apagar esta atividade?') && run(() => deleteCardioLog(base.id)) : undefined} />
      </form>
    </Modal>
  )
}

/** Criar ou editar um plano de cardio: em quais dias, quanto, em que intensidade e como progredir. */
export function CardioPlanModal(props: { plan?: CardioPlan; onClose: () => void; onSaved: () => void }) {
  const p = props.plan
  const [activity, setActivity] = useState<Activity>(p?.activity ?? 'run')
  const [name, setName] = useState(p?.name ?? '')
  const [weekdays, setWeekdays] = useState<number[]>(p?.weekdays ?? [])
  const [time, setTime] = useState(p?.time ?? '')
  const [distance, setDistance] = useState(distanceInput(p?.distance_m ?? null, activity))
  const [duration, setDuration] = useState(p?.duration_sec ? formatDuration(p.duration_sec) : '')
  const [intensity, setIntensity] = useState<Intensity>(p?.intensity ?? 'easy')
  const [intervals, setIntervals] = useState(intervalsText(p?.intervals ?? null))
  const [step, setStep] = useState(distanceInput(p?.progression.step_m ?? null, activity))
  const [max, setMax] = useState(distanceInput(p?.progression.max_m ?? null, activity))
  const [notes, setNotes] = useState(p?.notes ?? '')
  const { busy, error, run } = useRun(props.onSaved)

  const def = ACTIVITIES[activity]
  const distanceM = def.distance ? parseDistance(distance, activity) : null
  const durationSec = duration.trim() ? parseDuration(duration) : null
  const parsedIntervals = parseIntervals(intervals)
  const stepM = def.distance && step.trim() ? parseDistance(step, activity) : null
  const maxM = def.distance && max.trim() ? parseDistance(max, activity) : null
  const valid =
    (!distance.trim() || !def.distance || distanceM != null) &&
    (!duration.trim() || durationSec != null) &&
    (!step.trim() || stepM != null) &&
    (!max.trim() || (maxM != null && (!distanceM || maxM >= distanceM))) &&
    parsedIntervals !== undefined

  function toggleDay(d: number) {
    setWeekdays(w => (w.includes(d) ? w.filter(x => x !== d) : [...w, d].sort((a, b) => a - b)))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    run(() =>
      saveCardioPlan(p?.id ?? null, {
        name: name.trim() || def.label,
        activity,
        weekdays,
        time: time || null,
        distance_m: distanceM,
        duration_sec: durationSec,
        intensity,
        intervals: parsedIntervals ?? null,
        progression: stepM && distanceM ? { step_m: stepM, ...(maxM ? { max_m: maxM } : {}) } : {},
        notes: notes.trim() || null,
      }),
    )
  }

  const unit = activity === 'swim' ? 'm' : 'km'

  return (
    <Modal title={p ? 'Editar plano de cardio' : 'Novo plano de cardio'} onClose={props.onClose} tall>
      <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
        <ActivityChips value={activity} onChange={setActivity} />
        <label className="field">
          <span>Nome</span>
          <input className="input" placeholder={`${def.label} leve, longão, tiros…`} value={name} onChange={e => setName(e.target.value)} />
        </label>
        <div className="field">
          <span>Dias</span>
          <div className="chips wrap">
            {WEEKDAYS.map((d, i) => (
              <button key={d} type="button" className={`chip ${weekdays.includes(i) ? 'on' : ''}`} onClick={() => toggleDay(i)} aria-pressed={weekdays.includes(i)}>
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
          {!weekdays.length && <small className="muted tiny">Sem dia fixo: aparece na lista, mas não na tela Hoje.</small>}
        </div>
        <div className="grid-3">
          <label className="field">
            <span>Horário</span>
            <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </label>
          {def.distance && (
            <label className="field">
              <span>Distância ({unit})</span>
              <input className="input" inputMode="decimal" placeholder={activity === 'swim' ? '1000' : '5'} value={distance} onChange={e => setDistance(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Tempo</span>
            <input className="input" placeholder="30:00" value={duration} onChange={e => setDuration(e.target.value)} />
          </label>
        </div>
        <IntensityChips value={intensity} onChange={setIntensity} />
        {def.distance && <IntervalsFields value={intervals} onChange={setIntervals} />}
        {def.distance && (
          <div className="card stack" style={{ gap: 12 }}>
            <div style={{ fontWeight: 700 }}>Progressão</div>
            <div className="grid-2">
              <label className="field">
                <span>Aumentar a cada sessão ({unit})</span>
                <input className="input" inputMode="decimal" placeholder={activity === 'swim' ? '100' : '0,5'} value={step} onChange={e => setStep(e.target.value)} />
              </label>
              <label className="field">
                <span>Até ({unit})</span>
                <input className="input" inputMode="decimal" placeholder={activity === 'swim' ? '2000' : '8'} value={max} onChange={e => setMax(e.target.value)} />
              </label>
            </div>
            <small className="muted tiny">
              Opcional. A próxima meta é a última sessão feita mais esse valor, sem passar do máximo. Se faltar uma semana, a meta espera você.
            </small>
          </div>
        )}
        <label className="field">
          <span>Como fazer</span>
          <input className="input" placeholder="Ex.: 1,5 km de trote antes dos tiros" value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
        <Footer busy={busy} valid={valid} error={error} onDelete={p ? () => confirm('Apagar este plano? Os registros feitos continuam no histórico.') && run(() => deleteCardioPlan(p.id)) : undefined} />
      </form>
    </Modal>
  )
}
