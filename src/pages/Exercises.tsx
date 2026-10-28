import ExerciseBrowser from '../components/ExerciseBrowser'

export default function Exercises() {
  return (
    <main className="page">
      <h1>Exercícios</h1>
      <p className="muted small">Toque num exercício para ver como fazer.</p>
      <ExerciseBrowser />
    </main>
  )
}
