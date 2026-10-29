import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/ui'
import { CoachChat } from '../components/CoachChat'

export default function Coach() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  return (
    <main className="page stack coach">
      <div className="page-head">
        <button type="button" className="btn ghost small" style={{ marginLeft: -10 }} onClick={() => navigate(-1)}>
          <Icon.back /> Voltar
        </button>
      </div>
      <div>
        <span className="eyebrow">Alimentação, treino e recuperação</span>
        <h1>Seu nutricionista</h1>
      </div>
      <CoachChat question={params.get('q')} onQuestionSent={() => setParams({}, { replace: true })} />
    </main>
  )
}
