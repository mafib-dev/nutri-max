import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Login from './pages/Login'
import Today from './pages/Today'
import Exercises from './pages/Exercises'
import Routines from './pages/Routines'
import RoutineEdit from './pages/RoutineEdit'
import Workout from './pages/Workout'
import History from './pages/History'
import Progress from './pages/Progress'
import Overview from './pages/Overview'
import Nutrition from './pages/Nutrition'
import NutritionGoals from './pages/NutritionGoals'
import MealPlan from './pages/MealPlan'
import Coach from './pages/Coach'
import Onboarding from './pages/Onboarding'
import ProfileEdit from './pages/ProfileEdit'
import { CoachDock } from './components/CoachDock'
import { TabPill } from './components/ui'
import { loadSetup } from './modules/profile/data'
import { isComplete, readLook } from './modules/profile/setup'
import { DEFAULT_LOOK } from './modules/profile/look'
import { useAsync } from './lib/useAsync'
import { ChartLine, Dumbbell, History as HistoryIcon, House, Utensils, type LucideIcon } from 'lucide-react'

const icon = (Glyph: LucideIcon) => <Glyph strokeWidth={1.75} aria-hidden="true" />

const TABS = [
  { to: '/', label: 'Hoje', icon: icon(House) },
  { to: '/rotinas', label: 'Treinos', icon: icon(Dumbbell) },
  { to: '/nutricao', label: 'Nutrição', icon: icon(Utensils) },
  { to: '/historico', label: 'Histórico', icon: icon(HistoryIcon) },
  { to: '/progresso', label: 'Progresso', icon: icon(ChartLine) },
]

function TabBar() {
  return (
    <nav className="tabbar" aria-label="Navegação">
      <div className="nav-brand" aria-hidden="true">
        Nutri<span>Max</span>
      </div>
      {TABS.map(t => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}>
          {({ isActive }) => (
            <>
              {isActive && <TabPill id="nav-pill" />}
              {t.icon}
              <span>{t.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  if (loading) return <div className="center muted">Carregando…</div>
  if (!session) return <Login />
  return <Main key={session.user.id} />
}

function Main() {
  const { session } = useAuth()
  const location = useLocation()
  // No primeiro login a pessoa completa o perfil antes de ver o app.
  const setup = useAsync(loadSetup)

  if (setup.loading && !setup.data) return <div className="center muted">Carregando…</div>
  if (setup.data && !isComplete(setup.data))
    return <Onboarding initial={setup.data} initialLook={readLook(session?.user.user_metadata) ?? DEFAULT_LOOK} onDone={setup.reload} />

  // Durante o treino a barra de baixo dá lugar ao cronômetro de descanso.
  const inWorkout = location.pathname.startsWith('/treino')

  return (
    <div className={inWorkout ? 'shell' : 'shell has-nav'}>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/rotinas" element={<Routines />} />
        <Route path="/rotinas/:id" element={<RoutineEdit />} />
        <Route path="/exercicios" element={<Exercises />} />
        <Route path="/treino" element={<Workout />} />
        <Route path="/historico" element={<History />} />
        <Route path="/progresso" element={<Overview />} />
        <Route path="/nutricao" element={<Nutrition />} />
        <Route path="/nutricao/metas" element={<NutritionGoals />} />
        <Route path="/nutricao/plano" element={<MealPlan />} />
        <Route path="/nutricionista" element={<Coach />} />
        <Route path="/perfil" element={<ProfileEdit />} />
        <Route path="/progresso/:exerciseId" element={<Progress />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!inWorkout && <TabBar />}
      <CoachDock />
    </div>
  )
}
