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
import { CoachDock } from './components/CoachDock'

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const TABS = [
  { to: '/', label: 'Hoje', icon: icon('M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z') },
  { to: '/rotinas', label: 'Treinos', icon: icon('M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01') },
  { to: '/nutricao', label: 'Nutrição', icon: icon('M7 3v7a2 2 0 0 0 4 0V3M9 3v18M17 21V3c-2.2 1-3.5 3.6-3.5 7 0 2 1.2 3 3.5 3') },
  { to: '/historico', label: 'Histórico', icon: icon('M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5') },
  { to: '/progresso', label: 'Progresso', icon: icon('M3 3v18h18M7 15l4-4 3 3 5-6') },
]

function TabBar() {
  return (
    <nav className="tabbar" aria-label="Navegação">
      <div className="nav-brand" aria-hidden="true">
        Nutri<span>Max</span>
      </div>
      {TABS.map(t => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}>
          {t.icon}
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function App() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="center muted">Carregando…</div>
  if (!session) return <Login />

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
        <Route path="/progresso/:exerciseId" element={<Progress />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!inWorkout && <TabBar />}
      <CoachDock />
    </div>
  )
}
