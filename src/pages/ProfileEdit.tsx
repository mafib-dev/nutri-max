import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Buddy3D } from '../components/Buddy3D'
import { Icon, Modal } from '../components/ui'
import { loadSetup, saveSetup } from '../modules/profile/data'
import { EXPERIENCE, parseNumber, readLook, stepError, toNutritionProfile, type Experience, type ProfileSetup, type Step } from '../modules/profile/setup'
import { DEFAULT_LOOK } from '../modules/profile/look'
import { ACTIVITY, ageOn, dailyTargets, GOALS, type ActivityLevel, type Goal } from '../modules/nutrition/targets'
import { todayIso } from '../modules/nutrition/data'
import { notifyDataChanged } from '../lib/events'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'

type Field = 'name' | 'sex' | 'birth' | 'height' | 'weight' | 'goal' | 'target' | 'activity' | 'level'

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const numText = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))
const dateText = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

// Qual validação do cadastro vale para cada campo.
const STEP_OF: Partial<Record<Field, Step>> = { name: 'name', sex: 'sex', birth: 'birth', height: 'body', weight: 'body', goal: 'goal', target: 'goal', activity: 'activity' }

const TITLE: Record<Field, string> = {
  name: 'Nome',
  sex: 'Sexo',
  birth: 'Data de nascimento',
  height: 'Altura',
  weight: 'Peso atual',
  goal: 'Objetivo',
  target: 'Peso-alvo',
  activity: 'Nível de atividade',
  level: 'Experiência na musculação',
}

/** Perfil: os dados já respondidos, cada um editável com um toque. As perguntas em passos ficam só no primeiro login. */
export default function ProfileEdit() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const setup = useAsync(loadSetup)
  const [editing, setEditing] = useState<Field | null>(null)
  const [today] = useState(() => todayIso())

  if (setup.error) return <p className="page error">{setup.error}</p>
  if (!setup.data) return <p className="page muted">Carregando…</p>
  const p = setup.data
  const look = readLook(session?.user.user_metadata) ?? DEFAULT_LOOK
  const targets = dailyTargets(toNutritionProfile(p), p.weight_kg)

  const row = (field: Field, value: ReactNode, hint?: ReactNode) => (
    <button type="button" className="panel-row profile-row" onClick={() => setEditing(field)}>
      <span className="grow">
        <span className="label">{TITLE[field]}</span>
        <span className="profile-value">{value}</span>
        {hint && <span className="muted tiny">{hint}</span>}
      </span>
      <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="muted" />
    </button>
  )
  const empty = <span className="muted">Não informado</span>

  return (
    <main className="page stack form-width">
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => navigate(-1)}>
        <Icon.back /> Voltar
      </button>

      <section className="profile-head">
        <div className="profile-figure">
          <Buddy3D sex={p.sex} look={look} pose="wave" size={120} />
        </div>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">Seu perfil</span>
          <h1 className="ellipsis">{p.display_name?.trim() || 'Sem nome'}</h1>
          {p.goal && <p className="muted small" style={{ margin: '4px 0 0' }}>{GOALS[p.goal].label}</p>}
          {targets && (
            <div className="meta-chips" style={{ marginTop: 10 }}>
              <span className="meta-chip">
                <b>{targets.kcal.toLocaleString('pt-BR')}</b> kcal por dia
              </span>
              <span className="meta-chip">
                <b>{targets.protein_g}</b> g de proteína
              </span>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2>Sobre você</h2>
        <div className="panel">
          {row('name', p.display_name?.trim() || empty)}
          {row('sex', p.sex ? (p.sex === 'male' ? 'Masculino' : 'Feminino') : empty)}
          {row('birth', p.birth_date ? dateText(p.birth_date) : empty, p.birth_date ? `${ageOn(p.birth_date, new Date(today + 'T12:00:00'))} anos` : undefined)}
          {row('height', p.height_cm ? `${fmt(p.height_cm)} cm` : empty)}
          {row('weight', p.weight_kg ? `${fmt(p.weight_kg)} kg` : empty, 'Mudar aqui registra uma pesagem de hoje.')}
        </div>
      </section>

      <section>
        <h2>Objetivo e rotina</h2>
        <div className="panel">
          {row('goal', p.goal ? GOALS[p.goal].label : empty)}
          {p.goal !== 'maintain' && row('target', p.target_weight_kg ? `${fmt(p.target_weight_kg)} kg` : empty)}
          {row('activity', p.activity_level ? ACTIVITY[p.activity_level].label : empty, p.activity_level ? ACTIVITY[p.activity_level].hint : undefined)}
          {row('level', p.level ? EXPERIENCE[p.level].label : empty, p.level ? EXPERIENCE[p.level].hint : undefined)}
        </div>
      </section>

      <section>
        <h2>Metas e plano</h2>
        <div className="panel">
          <Link to="/nutricao/metas" className="panel-row profile-row">
            <span className="grow">
              <span className="label">Metas diárias</span>
              <span className="profile-value">Calorias, macros e ritmo por semana</span>
            </span>
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="muted" />
          </Link>
          <Link to="/nutricao/plano" className="panel-row profile-row">
            <span className="grow">
              <span className="label">Plano alimentar</span>
              <span className="profile-value">Consulta, cardápio e lista de compras</span>
            </span>
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="muted" />
          </Link>
        </div>
      </section>

      {editing && (
        <FieldEditor
          key={editing}
          field={editing}
          initial={p}
          today={today}
          onClose={() => setEditing(null)}
          onSave={async next => {
            await saveSetup(next, look, p.weight_kg)
            setEditing(null)
            setup.reload()
            notifyDataChanged()
          }}
        />
      )}
    </main>
  )
}

function FieldEditor(props: { field: Field; initial: ProfileSetup; today: string; onClose: () => void; onSave: (p: ProfileSetup) => Promise<void> }) {
  const { field } = props
  const [p, setP] = useState(props.initial)
  const [text, setText] = useState(() => numText(field === 'height' ? p.height_cm : field === 'weight' ? p.weight_kg : field === 'target' ? p.target_weight_kg : null))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<ProfileSetup>) => {
    setP(prev => ({ ...prev, ...patch }))
    setError(null)
  }
  const setNum = (value: string, key: 'height_cm' | 'weight_kg' | 'target_weight_kg') => {
    setText(value)
    set({ [key]: parseNumber(value) })
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    // Trocou o objetivo: um peso-alvo que não combina mais com ele deixa de valer.
    const t = p.target_weight_kg
    const stale = field === 'goal' && t != null && p.weight_kg != null && (p.goal === 'maintain' || (p.goal === 'lose' && t >= p.weight_kg) || (p.goal === 'gain' && t <= p.weight_kg))
    const next = stale ? { ...p, target_weight_kg: null } : p
    const step = STEP_OF[field]
    const problem = step ? stepError(step, next) : null
    if (problem) return setError(problem)
    setBusy(true)
    try {
      await props.onSave(next)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const choice = <T extends string>(options: [T, string, string?][], value: T | null, pick: (v: T) => void, label: string) => (
    <div className="onb-options" role="radiogroup" aria-label={label}>
      {options.map(([v, title, hint]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={`onb-option${value === v ? ' on' : ''}`} onClick={() => pick(v)}>
          <strong>{title}</strong>
          {hint && <span className="muted small">{hint}</span>}
        </button>
      ))}
    </div>
  )

  return (
    <Modal
      title={TITLE[field]}
      onClose={props.onClose}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn ghost" onClick={props.onClose}>
            Cancelar
          </button>
          <button type="submit" form="profile-field" className="btn primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      }
    >
      <form id="profile-field" className="stack" onSubmit={submit} noValidate>
        {field === 'name' && <input className="input big-input" autoFocus autoComplete="given-name" maxLength={40} value={p.display_name ?? ''} onChange={e => set({ display_name: e.target.value })} aria-label="Seu nome" />}
        {field === 'sex' &&
          choice<'male' | 'female'>(
            [
              ['male', 'Masculino'],
              ['female', 'Feminino'],
            ],
            p.sex,
            v => set({ sex: v }),
            'Sexo',
          )}
        {field === 'birth' && <input className="input big-input" type="date" autoFocus max={props.today} value={p.birth_date ?? ''} onChange={e => set({ birth_date: e.target.value || null })} aria-label="Data de nascimento" />}
        {field === 'height' && (
          <label className="field">
            <span>Altura (cm)</span>
            <input className="input big-input" inputMode="numeric" autoFocus value={text} onChange={e => setNum(e.target.value, 'height_cm')} />
          </label>
        )}
        {field === 'weight' && (
          <label className="field">
            <span>Peso de hoje (kg)</span>
            <input className="input big-input" inputMode="decimal" autoFocus value={text} onChange={e => setNum(e.target.value, 'weight_kg')} />
          </label>
        )}
        {field === 'target' && (
          <label className="field">
            <span>Peso-alvo (kg)</span>
            <input className="input big-input" inputMode="decimal" autoFocus value={text} onChange={e => setNum(e.target.value, 'target_weight_kg')} placeholder={p.weight_kg ? fmt(p.goal === 'lose' ? p.weight_kg - 5 : p.weight_kg + 5) : ''} />
          </label>
        )}
        {field === 'goal' &&
          choice<Goal>(
            (Object.keys(GOALS) as Goal[]).map(g => [g, GOALS[g].label, g === 'lose' ? 'Comer um pouco menos do que gasta' : g === 'gain' ? 'Comer um pouco mais e treinar pesado' : 'Comer o que gasta']),
            p.goal,
            v => set({ goal: v }),
            'Objetivo',
          )}
        {field === 'activity' &&
          choice<ActivityLevel>(
            (Object.keys(ACTIVITY) as ActivityLevel[]).map(a => [a, ACTIVITY[a].label, ACTIVITY[a].hint]),
            p.activity_level,
            v => set({ activity_level: v }),
            'Nível de atividade',
          )}
        {field === 'level' &&
          choice<Experience>(
            (Object.keys(EXPERIENCE) as Experience[]).map(x => [x, EXPERIENCE[x].label, EXPERIENCE[x].hint]),
            p.level,
            v => set({ level: v }),
            'Experiência na musculação',
          )}
        {error && (
          <p className="error small" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
