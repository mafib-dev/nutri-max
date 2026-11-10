import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MessageCircleMore } from 'lucide-react'
import { Icon } from './ui'
import { CoachChat } from './CoachChat'
import { useCoachOpen } from '../lib/events'

/** Botão do nutricionista no canto inferior direito, presente em todas as telas. */
export function CoachDock() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useCoachOpen(q => {
    setOpen(true)
    if (q) setQuestion(q)
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // A tela própria já é a conversa.
  if (location.pathname === '/nutricionista') return null

  return (
    <>
      {open && (
        <div className="coach-panel" role="dialog" aria-label="Seu nutricionista">
          <div className="coach-panel-head">
            <div>
              <span className="eyebrow">IA · 24 horas</span>
              <h3>Seu nutricionista</h3>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button
                type="button"
                className="btn ghost small"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => {
                  setOpen(false)
                  navigate('/nutricionista')
                }}
              >
                Tela cheia
              </button>
              <button type="button" className="btn ghost small" style={{ padding: 8 }} aria-label="Fechar o nutricionista" onClick={() => setOpen(false)}>
                <Icon.close />
              </button>
            </div>
          </div>
          <CoachChat compact question={question} onQuestionSent={() => setQuestion(null)} />
        </div>
      )}
      <button
        type="button"
        className={`coach-fab${open ? ' open' : ''}`}
        aria-label={open ? 'Fechar o nutricionista' : 'Abrir o nutricionista'}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {open ? (
          <Icon.close />
        ) : (
          <MessageCircleMore strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </>
  )
}
