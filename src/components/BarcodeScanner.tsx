import { useEffect, useRef, useState, type FormEvent } from 'react'
import { cleanBarcode, isValidBarcode } from '../modules/nutrition/off'

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/**
 * Leitor nativo do navegador quando existe (Chrome no Android); senão o ZXing em
 * WebAssembly, carregado só agora e servido pelo próprio app (funciona offline).
 */
async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector
  if (Native) {
    const supported = await Native.getSupportedFormats()
    if (supported.includes('ean_13')) return new Native({ formats: FORMATS.filter(f => supported.includes(f)) })
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } })
  return new BarcodeDetector({ formats: FORMATS as never })
}

/** Câmera traseira lendo códigos de barras, com campo para digitar o número se a leitura falhar. */
export default function BarcodeScanner({ onCode, busy }: { onCode: (code: string) => void; busy?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState<string | null>(null)
  const found = useRef(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (stopped) return
        const el = video.current!
        el.srcObject = stream
        await el.play()
        setCamera('on')
        const detector = await createDetector()
        const tick = async () => {
          if (stopped || found.current) return
          try {
            if (el.readyState >= 2) {
              const codes = await detector.detect(el)
              const code = codes.map(c => cleanBarcode(c.rawValue)).find(isValidBarcode)
              if (code && !stopped) {
                found.current = true
                navigator.vibrate?.(60)
                onCode(code)
                return
              }
            }
          } catch {
            // Quadro ilegível: tenta o próximo.
          }
          timer = setTimeout(tick, 220)
        }
        tick()
      } catch (err) {
        if (stopped) return
        setCamera('off')
        const name = (err as Error).name
        setCameraError(
          name === 'NotAllowedError'
            ? 'Sem permissão para usar a câmera. Libere nas configurações do navegador ou digite o número abaixo.'
            : 'Não deu para abrir a câmera aqui. Digite o número que fica embaixo das barras.',
        )
      }
    })()

    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [onCode])

  function submit(e: FormEvent) {
    e.preventDefault()
    const code = cleanBarcode(typed)
    if (!isValidBarcode(code)) return setTypedError('Confira o número: são 8 ou 13 dígitos, em geral começando com 789 nos produtos brasileiros.')
    setTypedError(null)
    onCode(code)
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {camera !== 'off' && (
        <div className="scanner">
          <video ref={video} muted playsInline aria-label="Imagem da câmera" />
          <div className="scanner-frame" aria-hidden="true" />
          <span className="scanner-hint">{camera === 'starting' ? 'Abrindo a câmera…' : busy ? 'Procurando o produto…' : 'Aponte para o código de barras'}</span>
        </div>
      )}
      {cameraError && <p className="muted small" style={{ margin: 0 }}>{cameraError}</p>}
      <form className="row" style={{ gap: 8 }} onSubmit={submit}>
        <input className="input" inputMode="numeric" placeholder="Ou digite o número" value={typed} onChange={e => setTyped(e.target.value)} aria-label="Número do código de barras" />
        <button className="btn" disabled={!typed.trim() || busy}>
          Buscar
        </button>
      </form>
      {typedError && <p className="error small" style={{ margin: 0 }}>{typedError}</p>}
    </div>
  )
}
