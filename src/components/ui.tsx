import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { animate, useReducedMotion } from 'motion/react'
import { Barcode, Check, ChevronDown, ChevronLeft, ChevronUp, Info, Plus, Search, X, Zap, type LucideIcon } from 'lucide-react'

// Um conjunto só de ícones (Lucide), com o mesmo traço em todo o app.
const lucide = (Glyph: LucideIcon) => () => <Glyph size="1.15em" strokeWidth={1.75} aria-hidden="true" />

export const Icon = {
  close: lucide(X),
  check: lucide(Check),
  search: lucide(Search),
  plus: lucide(Plus),
  info: lucide(Info),
  up: lucide(ChevronUp),
  down: lucide(ChevronDown),
  back: lucide(ChevronLeft),
  barcode: lucide(Barcode),
  bolt: lucide(Zap),
}

/**
 * Número que conta até o valor quando ele muda. O texto final já está no DOM (leitores de tela
 * e quem prefere menos movimento veem o valor certo direto).
 */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const start = from.current
    from.current = value
    if (reduce || start === value) {
      el.textContent = format(value)
      return
    }
    const controls = animate(start, value, { duration: 0.5, ease: [0.16, 1, 0.3, 1], onUpdate: v => (el.textContent = format(v)) })
    return () => controls.stop()
  }, [value, format, reduce])

  return <span ref={ref}>{format(value)}</span>
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
