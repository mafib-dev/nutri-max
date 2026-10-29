import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui'
import { loadNutritionProfile, saveNutritionProfile, todayIso } from '../modules/nutrition/data'
import { ACTIVITY, calculatedKcal, GOALS, missingForTargets, splitMacros, type ActivityLevel, type Goal, type NutritionProfile, type Sex } from '../modules/nutrition/targets'
import { listBodyWeights, saveBodyWeight } from '../modules/training/data'
import { useAsync } from '../lib/useAsync'

const toNum = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
const toStr = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

export default function NutritionGoals() {
  const navigate = useNavigate()
  const loaded = useAsync(() => Promise.all([loadNutritionProfile(), listBodyWeights(1)]))
  const [p, setP] = useState<NutritionProfile | null>(null)
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [manual, setManual] = useState({ kcal: '', protein: '', carbs: '', fat: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loaded.data) return
    const [profile, weights] = loaded.data
    setP(profile)
    setWeight(toStr(weights.at(-1)?.weight_kg))
    setHeight(toStr(profile.height_cm))
    setManual({ kcal: toStr(profile.kcal_target), protein: toStr(profile.protein_target_g), carbs: toStr(profile.carbs_target_g), fat: toStr(profile.fat_target_g) })
  }, [loaded.data])

  if (loaded.loading) return <main className="page muted">Carregando…</main>
  if (loaded.error || !p) return <main className="page error">{loaded.error}</main>

  const kg = toNum(weight)
  const current = { ...p, height_cm: toNum(height) }
  const missing = missingForTargets(current, kg)
  const autoKcal = kg ? calculatedKcal(current, kg, new Date()) : null
  const kcal = toNum(manual.kcal) ?? autoKcal
  const split = kcal && kg ? splitMacros(kcal, kg, p.goal ?? 'maintain') : null
  const set = <K extends keyof NutritionProfile>(k: K, v: NutritionProfile[K]) => setP({ ...p, [k]: v })
  const setManualField = (k: keyof typeof manual) => (e: { target: { value: string } }) => setManual(m => ({ ...m, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const h = toNum(height)
    if (h != null && !(h >= 100 && h <= 250)) return setError('Altura em centímetros, por exemplo 178.')
    if (kg != null && !(kg >= 20 && kg <= 400)) return setError('Peso em kg, por exemplo 78,4.')
    const ints = [manual.kcal, manual.protein, manual.carbs, manual.fat].map(toNum)
    if (ints.some(v => v != null && (!Number.isFinite(v) || v < 0))) return setError('Confira as metas definidas à mão.')
    if (ints[0] != null && (ints[0] < 800 || ints[0] > 6000)) return setError('A meta de calorias precisa ficar entre 800 e 6.000.')
    setBusy(true)
    setError(null)
    try {
      const round = (v: number | null) => (v == null ? null : Math.round(v))
      await saveNutritionProfile({
        ...p!,
        height_cm: h,
        kcal_target: round(ints[0]),
        protein_target_g: round(ints[1]),
        carbs_target_g: round(ints[2]),
        fat_target_g: round(ints[3]),
      })
      const last = loaded.data![1].at(-1)?.weight_kg
      if (kg != null && kg !== last) await saveBodyWeight(todayIso(), Math.round(kg * 10) / 10)
      navigate('/nutricao')
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <main className="page stack">
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => navigate('/nutricao')}>
        <Icon.back /> Nutrição
      </button>
      <div>
        <span className="eyebrow">Calorias e macros do dia</span>
        <h1>Suas metas</h1>
      </div>

      <form className="stack" onSubmit={submit}>
        <div className="field">
          <span>Objetivo</span>
          <div className="chips wrap">
            {(Object.keys(GOALS) as Goal[]).map(g => (
              <button key={g} type="button" className={`chip ${(p.goal ?? 'maintain') === g ? 'on' : ''}`} onClick={() => set('goal', g)}>
                {GOALS[g].label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Sexo</span>
          <div className="chips wrap">
            {(
              [
                ['male', 'Masculino'],
                ['female', 'Feminino'],
              ] as [Sex, string][]
            ).map(([v, label]) => (
              <button key={v} type="button" className={`chip ${p.sex === v ? 'on' : ''}`} onClick={() => set('sex', v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Data de nascimento</span>
          <input className="input" type="date" max={todayIso()} value={p.birth_date ?? ''} onChange={e => set('birth_date', e.target.value || null)} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Altura (cm)</span>
            <input className="input" inputMode="decimal" placeholder="178" value={height} onChange={e => setHeight(e.target.value)} />
          </label>
          <label className="field">
            <span>Peso (kg)</span>
            <input className="input" inputMode="decimal" placeholder="78,4" value={weight} onChange={e => setWeight(e.target.value)} />
          </label>
        </div>

        <div className="field">
          <span>Nível de atividade</span>
          <div className="list">
            {(Object.keys(ACTIVITY) as ActivityLevel[]).map(a => (
              <button key={a} type="button" className={`list-item option ${p.activity_level === a ? 'on' : ''}`} onClick={() => set('activity_level', a)} aria-pressed={p.activity_level === a}>
                <div className="grow">
                  <div className="title">{ACTIVITY[a].label}</div>
                  <div className="muted tiny">{ACTIVITY[a].hint}</div>
                </div>
                {p.activity_level === a && <Icon.check />}
              </button>
            ))}
          </div>
        </div>

        <div className="card hero stack" style={{ gap: 10 }}>
          <span className="eyebrow">Sua meta diária</span>
          {kcal ? (
            <>
              <div className="stat">
                <strong style={{ fontSize: '2.6rem' }}>{kcal.toLocaleString('pt-BR')} kcal</strong>
              </div>
              {split && (
                <div className="muted small">
                  Proteína {toNum(manual.protein) ?? split.protein_g} g · Carboidrato {toNum(manual.carbs) ?? split.carbs_g} g · Gordura {toNum(manual.fat) ?? split.fat_g} g
                </div>
              )}
              <p className="muted tiny" style={{ margin: 0 }}>
                {toNum(manual.kcal) != null
                  ? 'Calorias definidas por você.'
                  : `Gasto estimado pela fórmula de Mifflin-St Jeor${p.goal === 'lose' ? ', com 20% a menos para perder gordura' : p.goal === 'gain' ? ', com 10% a mais para ganhar massa' : ''}. Proteína de ${GOALS[p.goal ?? 'maintain'].proteinPerKg.toLocaleString('pt-BR')} g por kg e 25% das calorias em gordura.`}
              </p>
            </>
          ) : (
            <span className="muted small">Falta preencher: {missing.join(', ')}.</span>
          )}
        </div>

        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Definir as metas à mão</summary>
          <p className="muted small">Deixe em branco o que quiser que seja calculado. Útil se um nutricionista passou números para você.</p>
          <div className="grid-2">
            <label className="field">
              <span>Calorias</span>
              <input className="input" inputMode="numeric" placeholder={autoKcal ? String(autoKcal) : ''} value={manual.kcal} onChange={setManualField('kcal')} />
            </label>
            <label className="field">
              <span>Proteína (g)</span>
              <input className="input" inputMode="numeric" placeholder={split ? String(split.protein_g) : ''} value={manual.protein} onChange={setManualField('protein')} />
            </label>
            <label className="field">
              <span>Carboidrato (g)</span>
              <input className="input" inputMode="numeric" placeholder={split ? String(split.carbs_g) : ''} value={manual.carbs} onChange={setManualField('carbs')} />
            </label>
            <label className="field">
              <span>Gordura (g)</span>
              <input className="input" inputMode="numeric" placeholder={split ? String(split.fat_g) : ''} value={manual.fat} onChange={setManualField('fat')} />
            </label>
          </div>
        </details>

        {error && <p className="error">{error}</p>}
        <button className="btn primary big block" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar metas'}
        </button>
      </form>
    </main>
  )
}
