import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const svg = (children: ReactNode, size = 24) => (
  <svg viewBox={`0 0 ${size} ${size}`} width="1.15em" height="1.15em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const Icon = {
  close: () => svg(<path d="M6 6l12 12M18 6L6 18" />),
  check: () => svg(<path d="M5 12.5l4.5 4.5L19 7.5" />),
  search: () => svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>),
  plus: () => svg(<path d="M12 5v14M5 12h14" />),
  info: () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  up: () => svg(<path d="M6 15l6-6 6 6" />),
  down: () => svg(<path d="M6 9l6 6 6-6" />),
  back: () => svg(<path d="M15 6l-6 6 6 6" />),
}

let openModals = 0

/** Janela centralizada. Fecha no Esc, no X e tocando fora. */
export function Modal(props: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; tall?: boolean; top?: boolean; label?: string }) {
  const { onClose } = props

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Trava a rolagem da página por trás enquanto houver alguma janela aberta.
    openModals++
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      if (--openModals === 0) document.body.style.overflow = ''
    }
  }, [onClose])

  // Fora da árvore da página: um ancestral animado (transform) prenderia o position: fixed.
  return createPortal(
    <div className={`modal-backdrop ${props.top ? 'top' : ''}`} onClick={onClose}>
      <div
        className={`modal ${props.tall ? 'tall' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={props.label ?? (typeof props.title === 'string' ? props.title : undefined)}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 style={{ minWidth: 0 }}>{props.title}</h3>
          <button type="button" className="close" onClick={onClose} aria-label="Fechar">
            <Icon.close />
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
        {props.footer && <div className="modal-foot">{props.footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
