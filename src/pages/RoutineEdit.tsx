import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ExerciseBrowser from '../components/ExerciseBrowser'
import type { ExerciseRow } from '../modules/training/catalogue'
import {
  deleteRoutine,
  exerciseName,
  getRoutine,
  imageUrl,
  loadCatalogue,
  saveRoutineExercises,
  updateRoutine,
  WEEKDAYS,
  type RoutineExercise,
} from '../modules/training/data'
import { useAsync } from '../lib/useAsync'

type Item = Omit<RoutineExercise, 'id' | 'position' | 'routine_id'>

const POLICIES: { value: string; label: string; hint: string }[] = [
  { value: 'linear', label: 'Linear', hint: 'Completou todas as séries, a carga sobe.' },
  { value: 'double', label: 'Dupla', hint: 'Sobe as repetições até o topo da faixa, depois a carga.' },
  { value: 'triple', label: 'Tripla', hint: 'Repetições, depois séries, depois carga.' },
  { value: 'greyskull', label: 'Greyskull', hint: 'Linear com última série até a falha.' },
  { value: 'off', label: 'Manual', hint: 'Você escolhe a carga.' },
]

const newItem = (ex: ExerciseRow): Item => ({
  exercise_id: ex.id,
  sets: 3,
  rep_min: 8,
  rep_max: 12,
  rest_sec: 90,
  superset_group: null,
  backup_exercise_id: null,
  progression: { policy: 'double' },
})

const numberOrNull = (v: string) => (v === '' ? null : Math.max(0, Number(v)))

export default function RoutineEdit() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const loaded = useAsync(() => Promise.all([getRoutine(id), loadCatalogue()]), [id])
  const [name, setName] = useState('')
  const [weekday, setWeekday] = useState<number | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null)

  const byId = useMemo(() => new Map((loaded.data?.[1] ?? []).map(e => [e.id, e])), [loaded.data])

  useEffect(() => {
    if (!loaded.data) return
    const { routine, items } = loaded.data[0]
    setName(routine.name)
    setWeekday(routine.weekday)
    setItems(items.map(({ id: _id, position: _p, routine_id: _r, ...rest }) => rest))
  }, [loaded.data])

  const patch = (i: number, change: Partial<Item>) => setItems(list => list.map((it, j) => (j === i ? { ...it, ...change } : it)))
  const move = (i: number, dir: -1 | 1) =>
    setItems(list => {
      const j = i + dir
      if (j < 0 || j >= list.length) return list
      const out = [...list]
      ;[out[i], out[j]] = [out[j], out[i]]
      return out
    })

  async function save() {
    setSaving(true)
    setStatus(null)
    try {
      await updateRoutine(id, { name: name.trim() || 'Treino', weekday })
      await saveRoutineExercises(
        id,
        items.map(it => ({ ...it, rep_max: it.rep_max != null && it.rep_min != null && it.rep_max < it.rep_min ? it.rep_min : it.rep_max })),
      )
      setStatus({ text: 'Rotina salva.', error: false })
    } catch (err) {
      setStatus({ text: (err as Error).message, error: true })
    }
    setSaving(false)
  }

  async function remove() {
    if (!confirm(`Apagar a rotina "${name}"? Os treinos já feitos continuam no histórico.`)) return
    try {
      await deleteRoutine(id)
      navigate('/rotinas')
    } catch (err) {
      setStatus({ text: (err as Error).message, error: true })
    }
  }

  if (loaded.loading) return <main className="page muted">Carregando…</main>
  if (loaded.error) return <main className="page error">{loaded.error}</main>

  return (
    <main className="page stack">
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start' }} onClick={() => navigate('/rotinas')}>
        ‹ Rotinas
      </button>
      <label className="field">
        <span>Nome</span>
        <input className="input" value={name} onChange={e => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Dia da semana</span>
        <select className="input" value={weekday ?? ''} onChange={e => setWeekday(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Sem dia fixo</option>
          {WEEKDAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <h2>Exercícios</h2>
      {items.length === 0 && <p className="muted small">Nenhum exercício ainda.</p>}
      {items.map((it, i) => {
        const ex = byId.get(it.exercise_id)
        const policy = it.progression.policy ?? 'double'
        return (
          <div key={`${it.exercise_id}-${i}`} className="card stack">
            <div className="row">
              {ex?.images[0] ? <img className="thumb" src={imageUrl(ex.images[0])} alt="" /> : <div className="thumb" />}
              <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }} className="ellipsis">
                  {i + 1}. {exerciseName(ex)}
                </div>
              </div>
              <button type="button" className="btn ghost small" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0}>
                ↑
              </button>
              <button type="button" className="btn ghost small" aria-label="Descer" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                ↓
              </button>
            </div>
            <div className="grid-3">
              <label className="field">
                <span>Séries</span>
                <input className="input" type="number" inputMode="numeric" min={1} value={it.sets} onChange={e => patch(i, { sets: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
              <label className="field">
                <span>Reps mín.</span>
                <input className="input" type="number" inputMode="numeric" min={1} value={it.rep_min ?? ''} onChange={e => patch(i, { rep_min: numberOrNull(e.target.value) })} />
              </label>
              <label className="field">
                <span>Reps máx.</span>
                <input className="input" type="number" inputMode="numeric" min={1} value={it.rep_max ?? ''} onChange={e => patch(i, { rep_max: numberOrNull(e.target.value) })} />
              </label>
            </div>
            <div className="grid-3">
              <label className="field">
                <span>Descanso (s)</span>
                <input className="input" type="number" inputMode="numeric" min={0} step={15} value={it.rest_sec ?? ''} onChange={e => patch(i, { rest_sec: numberOrNull(e.target.value) })} />
              </label>
              <label className="field">
                <span>Incremento (kg)</span>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  placeholder="auto"
                  value={it.progression.increment ?? ''}
                  onChange={e => patch(i, { progression: { ...it.progression, increment: e.target.value === '' ? undefined : Number(e.target.value) } })}
                />
              </label>
              <label className="field">
                <span>Progressão</span>
                <select className="input" value={policy} onChange={e => patch(i, { progression: { ...it.progression, policy: e.target.value } })}>
                  {POLICIES.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="spread">
              <span className="muted small">{POLICIES.find(p => p.value === policy)?.hint}</span>
              <button type="button" className="btn ghost small danger" onClick={() => setItems(list => list.filter((_, j) => j !== i))}>
                Remover
              </button>
            </div>
          </div>
        )
      })}
      <button type="button" className="btn" onClick={() => setPicking(true)}>
        + Adicionar exercício
      </button>

      {status && <p className={status.error ? 'error' : 'muted'}>{status.text}</p>}
      <button type="button" className="btn primary block" onClick={save} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar rotina'}
      </button>
      <button type="button" className="btn ghost danger" onClick={remove}>
        Apagar rotina
      </button>

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
              onPick={ex => {
                setItems(list => [...list, newItem(ex)])
                setPicking(false)
              }}
            />
          </div>
        </div>
      )}
    </main>
  )
}
