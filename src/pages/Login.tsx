import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'signup' && password !== confirm) {
      setMessage({ text: 'As senhas não são iguais.', error: true })
      return
    }
    setBusy(true)
    setMessage(null)
    const { data, error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) {
      setMessage({ text: translateError(error.message), error: true })
    } else if (mode === 'signup' && !data.session) {
      setMessage({ text: 'Conta criada. Confirme pelo link que enviamos para o seu e-mail e depois entre.', error: false })
      setMode('login')
    }
  }

  return (
    <div className="center">
      <form className="card stack" style={{ width: '100%', maxWidth: 400, padding: 24, gap: 14 }} onSubmit={submit}>
        <div>
          <div className="brand">
            Nutri<em>Max</em>
          </div>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            {mode === 'login' ? 'Entre para ver seus treinos.' : 'Crie sua conta.'}
          </p>
        </div>
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <PasswordInput
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={setPassword}
          />
        </label>
        {mode === 'signup' && (
          <label className="field">
            <span>Confirmar senha</span>
            <PasswordInput autoComplete="new-password" value={confirm} onChange={setConfirm} />
          </label>
        )}
        {message && <p className={message.error ? 'error small' : 'small'}>{message.text}</p>}
        <button className="btn primary big block" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
        <button
          type="button"
          className="btn ghost block"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setConfirm('')
            setMessage(null)
          }}
        >
          {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  )
}

function PasswordInput(props: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password">
      <input
        className="input"
        type={visible ? 'text' : 'password'}
        autoComplete={props.autoComplete}
        minLength={6}
        required
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
      />
      <button
        type="button"
        className="eye"
        aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
        aria-pressed={visible}
        onClick={() => setVisible(v => !v)}
      >
        {visible ? <EyeOff strokeWidth={1.75} aria-hidden="true" /> : <Eye strokeWidth={1.75} aria-hidden="true" />}
      </button>
    </div>
  )
}

function translateError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  if (/already registered/i.test(message)) return 'Esse e-mail já tem conta. Entre com ele.'
  if (/password should be at least/i.test(message)) return 'A senha precisa ter pelo menos 6 caracteres.'
  return message
}
