import { useNavigate } from 'react-router-dom'
import Onboarding from './Onboarding'
import { loadSetup } from '../modules/profile/data'
import { readLook } from '../modules/profile/setup'
import { DEFAULT_LOOK } from '../modules/profile/look'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'

/** Editar o perfil depois do cadastro: os mesmos passos do primeiro login. */
export default function ProfileEdit() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const setup = useAsync(loadSetup)
  if (setup.error) return <p className="page error">{setup.error}</p>
  if (!setup.data) return <p className="page muted">Carregando…</p>
  return <Onboarding mode="edit" initial={setup.data} initialLook={readLook(session?.user.user_metadata) ?? DEFAULT_LOOK} onDone={() => navigate('/')} onCancel={() => navigate(-1)} />
}
