import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/ui'
import { coachContext, QUICK_PROMPTS, validateActions, type StoredAction } from '../modules/coach/coach'
import { addCoachMessage, askCoach, clearCoachMessages, listCoachMessages, loadCoachRaw, setCoachActions, type CoachMessage } from '../modules/coach/data'
import { getWater, logPlanMeal, saveMealPlan, setWater, todayIso } from '../modules/nutrition/data'
import { applyAiResult, type SavedPlanWithAi } from '../modules/nutrition/planAi'
import { saveBodyWeight } from '../modules/training/data'
import { useAsync } from '../lib/useAsync'

export default function Coach() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const history = useAsync(() => listCoachMessages())
  const [messages, setMessages] = useState<CoachMessage[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const sentQuery = useRef(false)

  const list = messages ?? history.data ?? []

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [list.length, busy])

  async function send(content: string) {
    const msg = content.trim()
    if (!msg || busy) return
    setBusy(true)
    setError(null)
    setText('')
    try {
      const mine = await addCoachMessage('user', msg)
      const withMine = [...list, mine]
      setMessages(withMine)
      // O retrato do dia é lido na hora: o que comeu, a água e o treino podem ter mudado.
      const raw = await loadCoachRaw()
      const answer = await askCoach(
        withMine.slice(-12).map(m => ({ role: m.role, content: m.content })),
        coachContext(raw),
      )
      const actions = validateActions(answer.acoes, raw.saved)
      const reply = await addCoachMessage('assistant', answer.mensagem, actions)
      setMessages([...withMine, reply])
    } catch (err) {
      setError((err as Error).message)
      setText(msg)
    } finally {
      setBusy(false)
    }
  }

  // Pergunta vinda de um atalho da tela Hoje (?q=...): envia uma vez, assim que a conversa carregar.
  useEffect(() => {
    const q = params.get('q')
    if (!q || sentQuery.current || !history.data) return
    sentQuery.current = true
    setParams({}, { replace: true })
    void send(q)
  }, [history.data])

  async function apply(message: CoachMessage, index: number) {
    const action = message.actions[index]
    const today = todayIso()
    if (action.tipo === 'lancar_refeicao') {
      const raw = await loadCoachRaw()
      const meal = raw.day?.rest.find(m => m.key === action.slot) ?? raw.plan?.meals.find(m => m.key === action.slot)
      if (!meal) throw new Error('Essa refeição não está mais no plano.')
      await logPlanMeal(today, meal)
    } else if (action.tipo === 'registrar_agua') {
      await setWater(today, (await getWater(today)) + action.ml)
    } else if (action.tipo === 'registrar_peso') {
      await saveBodyWeight(today, action.kg)
    } else if (action.tipo === 'ajustar_plano') {
      const raw = await loadCoachRaw()
      if (!raw.saved) throw new Error('Monte o plano alimentar primeiro.')
      const { saved } = applyAiResult(raw.saved as SavedPlanWithAi, { consulta: action.consulta, trocas: action.trocas, resumo: action.rotulo }, action.rotulo)
      await saveMealPlan(saved)
    }
    const actions: StoredAction[] = message.actions.map((a, i) => (i === index ? { ...a, applied: true } : a))
    await setCoachActions(message.id, actions)
    setMessages(list.map(m => (m.id === message.id ? { ...m, actions } : m)))
  }

  async function clear() {
    if (!confirm('Apagar toda a conversa com o nutricionista?')) return
    await clearCoachMessages()
    setMessages([])
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void send(text)
  }

  return (
    <main className="page stack coach">
      <div className="page-head">
        <button type="button" className="btn ghost small" style={{ marginLeft: -10 }} onClick={() => navigate(-1)}>
          <Icon.back /> Voltar
        </button>
        {list.length > 0 && (
          <button type="button" className="btn ghost small" onClick={clear}>
            Limpar
          </button>
        )}
      </div>
      <div>
        <span className="eyebrow">Alimentação, treino e recuperação</span>
        <h1>Seu nutricionista</h1>
      </div>

      {history.loading && !history.data && <p className="muted">Carregando…</p>}
      {history.error && <p className="error">{history.error}</p>}

      {history.data && list.length === 0 && (
        <div className="card stack" style={{ gap: 8 }}>
          <p className="small" style={{ margin: 0, lineHeight: 1.5 }}>
            Eu vejo seu diário, seu plano, a água, o peso e os treinos. Pergunte o que quiser: o que comer agora, como compensar uma refeição pulada, o que pedir num restaurante, como foi sua semana.
          </p>
          <p className="muted tiny" style={{ margin: 0 }}>
            As respostas são de uma IA (Claude, da Anthropic) e não substituem um nutricionista ou médico, principalmente se você tiver alguma condição de saúde.
          </p>
        </div>
      )}

      <div className="chat">
        {list.map(m => (
          <div key={m.id} className={`bubble ${m.role}`}>
            <p>{m.content}</p>
            {m.actions.length > 0 && (
              <div className="bubble-actions">
                {m.actions.map((a, i) => (
                  <ActionButton key={i} action={a} onApply={() => apply(m, i)} />
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="bubble assistant typing">Pensando…</div>}
        <div ref={end} />
      </div>

      {error && <p className="error small">{error}</p>}

      {!busy && (
        <div className="chips wrap">
          {QUICK_PROMPTS.map(q => (
            <button key={q} type="button" className="chip small-chip" onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <form className="row chat-input" style={{ gap: 8 }} onSubmit={submit}>
        <textarea
          className="input"
          rows={2}
          maxLength={2000}
          placeholder="Escreva para o seu nutricionista…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(text)
            }
          }}
          aria-label="Mensagem para o nutricionista"
        />
        <button className="btn primary" disabled={busy || !text.trim()}>
          Enviar
        </button>
      </form>
    </main>
  )
}

function ActionButton({ action, onApply }: { action: StoredAction; onApply: () => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'busy' | string>('idle')
  if (action.applied)
    return (
      <span className="chip on small-chip" aria-label={`${action.rotulo}: feito`}>
        <Icon.check /> {action.rotulo}
      </span>
    )
  return (
    <>
      <button
        type="button"
        className="btn small"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy')
          try {
            await onApply()
            setState('idle')
          } catch (err) {
            setState((err as Error).message)
          }
        }}
      >
        {state === 'busy' ? 'Aplicando…' : action.rotulo}
      </button>
      {state !== 'idle' && state !== 'busy' && <span className="error tiny">{state}</span>}
    </>
  )
}
