import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
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
      <form className="card stack" style={{ width: '100%', maxWidth: 380 }} onSubmit={submit}>
        <div>
          <h1>NutriMax</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {mode === 'login' ? 'Entre para ver seus treinos.' : 'Crie sua conta.'}
          </p>
        </div>
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        {message && <p className={message.error ? 'error small' : 'small'}>{message.text}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
        <button
          type="button"
          className="btn ghost block"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setMessage(null)
          }}
        >
          {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho conta'}
        </button>
      </form>
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
