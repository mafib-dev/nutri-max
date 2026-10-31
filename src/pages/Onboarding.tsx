import { useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Avatar, type Pose } from '../components/Avatar'
import { ACTIVITY, dailyTargets, GOALS, type ActivityLevel, type Goal } from '../modules/nutrition/targets'
import { EXPERIENCE, firstOpenStep, parseNumber, stepError, STEPS, toNutritionProfile, type Experience, type ProfileSetup, type Step } from '../modules/profile/setup'
import type { AvatarLook } from '../modules/profile/look'
import { saveSetup } from '../modules/profile/data'
import { todayIso } from '../modules/nutrition/data'

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const numText = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))

const TITLES: Record<Step, { title: string; hint?: string }> = {
  name: { title: 'Como podemos te chamar?', hint: 'É assim que vamos falar com você no app.' },
  sex: { title: 'Qual é o seu sexo?', hint: 'Escolhe o seu personagem e entra no cálculo das calorias.' },
  birth: { title: 'Quando você nasceu?', hint: 'A idade muda quanto o corpo gasta por dia.' },
  body: { title: 'Sua altura e seu peso', hint: 'Use o peso de hoje. Você atualiza quando quiser.' },
  goal: { title: 'Qual é o seu objetivo?' },
  activity: { title: 'Quanto você se movimenta?', hint: 'Conte treinos e trabalho. Na dúvida, escolha o menor.' },
  done: { title: 'Tudo pronto!', hint: 'Estas são suas metas diárias. Dá para ajustar depois em Nutrição.' },
}

export default function Onboarding({ initial, initialLook, mode = 'first', onDone, onCancel }: { initial: ProfileSetup; initialLook: AvatarLook; mode?: 'first' | 'edit'; onDone: () => void; onCancel?: () => void }) {
  const [p, setP] = useState(initial)
  const [look] = useState(initialLook)
  const [index, setIndex] = useState(() => (mode === 'first' ? firstOpenStep(initial) : 0))
  const [dir, setDir] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [today] = useState(() => todayIso())
  // Os números ficam como texto enquanto a pessoa digita ("80," ainda não é número).
  const [text, setText] = useState({ height: numText(initial.height_cm), weight: numText(initial.weight_kg), target: numText(initial.target_weight_kg) })

  const step = STEPS[index]
  const set = (patch: Partial<ProfileSetup>) => {
    setP(prev => ({ ...prev, ...patch }))
    setError(null)
  }
  const setNum = (key: keyof typeof text, field: 'height_cm' | 'weight_kg' | 'target_weight_kg', value: string) => {
    setText(t => ({ ...t, [key]: value }))
    set({ [field]: parseNumber(value) })
  }

  const targets = step === 'done' ? dailyTargets(toNutritionProfile(p), p.weight_kg) : null

  async function next(e?: FormEvent) {
    e?.preventDefault()
    const problem = stepError(step, p)
    if (problem) return setError(problem)
    if (step !== 'done') {
      setDir(1)
      setIndex(i => i + 1)
      return
    }
    setSaving(true)
    try {
      await saveSetup(p, look, initial.weight_kg)
      onDone()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  function back() {
    setError(null)
    if (index === 0) return onCancel?.()
    setDir(-1)
    setIndex(i => i - 1)
  }

  const pose: Pose = step === 'done' ? 'celebrate' : step === 'name' ? 'wave' : step === 'activity' ? 'train' : 'idle'
  const { title, hint } = TITLES[step]

  return (
    <div className="onboarding">
      <div className="onb-stage" aria-hidden={step === 'sex' ? undefined : true}>
        <Avatar sex={p.sex ?? 'male'} look={look} pose={pose} size={150} />
        {p.display_name?.trim() && step !== 'name' && <div className="onb-name">{p.display_name.trim()}</div>}
      </div>

      <form className="onb-panel" onSubmit={next} noValidate>
        <div className="onb-top">
          {index > 0 || onCancel ? (
            <button type="button" className="btn ghost small" onClick={back}>
              Voltar
            </button>
          ) : (
            <span />
          )}
          <span className="muted small">
            {index + 1} de {STEPS.length}
          </span>
        </div>
        <div className="onb-progress" aria-hidden="true">
          <span style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
        </div>

        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            className="onb-step stack"
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.18 }}
          >
            <div>
              <h1>{title}</h1>
              {hint && <p className="muted" style={{ margin: '6px 0 0' }}>{hint}</p>}
            </div>

            {step === 'name' && (
              <input className="input big-input" autoFocus autoComplete="given-name" placeholder="Seu nome" maxLength={40} value={p.display_name ?? ''} onChange={e => set({ display_name: e.target.value })} aria-label="Seu nome" />
            )}

            {step === 'sex' && (
              <>
                <div className="onb-options two" role="radiogroup" aria-label="Sexo">
                  {(['male', 'female'] as const).map(s => (
                    <Option key={s} on={p.sex === s} onClick={() => set({ sex: s })}>
                      <Avatar sex={s} look={look} size={64} pose="idle" />
                      <strong>{s === 'male' ? 'Masculino' : 'Feminino'}</strong>
                    </Option>
                  ))}
                </div>
              </>
            )}

            {step === 'birth' && (
              <input className="input big-input" type="date" autoFocus max={today} value={p.birth_date ?? ''} onChange={e => set({ birth_date: e.target.value || null })} aria-label="Data de nascimento" />
            )}

            {step === 'body' && (
              <div className="onb-pair">
                <label className="field">
                  <span>Altura (cm)</span>
                  <input className="input big-input" inputMode="numeric" autoFocus placeholder="175" value={text.height} onChange={e => setNum('height', 'height_cm', e.target.value)} />
                </label>
                <label className="field">
                  <span>Peso (kg)</span>
                  <input className="input big-input" inputMode="decimal" placeholder="80,5" value={text.weight} onChange={e => setNum('weight', 'weight_kg', e.target.value)} />
                </label>
              </div>
            )}

            {step === 'goal' && (
              <>
                <div className="onb-options" role="radiogroup" aria-label="Objetivo">
                  {(Object.keys(GOALS) as Goal[]).map(g => (
                    <Option key={g} on={p.goal === g} onClick={() => set({ goal: g })}>
                      <strong>{GOALS[g].label}</strong>
                      <span className="muted small">{g === 'lose' ? 'Comer um pouco menos do que gasta' : g === 'gain' ? 'Comer um pouco mais e treinar pesado' : 'Comer o que gasta'}</span>
                    </Option>
                  ))}
                </div>
                {p.goal && p.goal !== 'maintain' && (
                  <label className="field">
                    <span>Peso-alvo em kg (opcional)</span>
                    <input className="input" inputMode="decimal" placeholder={p.weight_kg ? fmt(p.goal === 'lose' ? p.weight_kg - 5 : p.weight_kg + 5) : ''} value={text.target} onChange={e => setNum('target', 'target_weight_kg', e.target.value)} />
                  </label>
                )}
              </>
            )}

            {step === 'activity' && (
              <>
                <div className="onb-options" role="radiogroup" aria-label="Nível de atividade">
                  {(Object.keys(ACTIVITY) as ActivityLevel[]).map(a => (
                    <Option key={a} on={p.activity_level === a} onClick={() => set({ activity_level: a })}>
                      <strong>{ACTIVITY[a].label}</strong>
                      <span className="muted small">{ACTIVITY[a].hint}</span>
                    </Option>
                  ))}
                </div>
                <div className="field">
                  <span>Experiência na musculação (opcional)</span>
                  <div className="chips wrap">
                    {(Object.keys(EXPERIENCE) as Experience[]).map(x => (
                      <button key={x} type="button" className={`chip${p.level === x ? ' on' : ''}`} onClick={() => set({ level: p.level === x ? null : x })} title={EXPERIENCE[x].hint} aria-pressed={p.level === x}>
                        {EXPERIENCE[x].label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === 'done' && (
              <div className="onb-summary">
                <div>
                  <span className="label">Calorias</span>
                  <div className="title">{targets ? `${targets.kcal.toLocaleString('pt-BR')} kcal` : '–'}</div>
                </div>
                <div>
                  <span className="label">Proteína</span>
                  <div className="title">{targets ? `${targets.protein_g} g` : '–'}</div>
                </div>
                <div>
                  <span className="label">Objetivo</span>
                  <div className="title">{p.goal ? GOALS[p.goal].label : '–'}</div>
                </div>
                <div>
                  <span className="label">Peso</span>
                  <div className="title">
                    {p.weight_kg ? `${fmt(p.weight_kg)} kg` : '–'}
                    {p.target_weight_kg && p.goal !== 'maintain' ? ` → ${fmt(p.target_weight_kg)} kg` : ''}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary big block" disabled={saving}>
          {step === 'done' ? (saving ? 'Salvando…' : mode === 'first' ? 'Começar' : 'Salvar') : 'Continuar'}
        </button>
      </form>
    </div>
  )
}

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`onb-option${on ? ' on' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}
