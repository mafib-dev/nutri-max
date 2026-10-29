import ExerciseBrowser from '../components/ExerciseBrowser'

export default function Exercises() {
  return (
    <main className="page">
      <span className="eyebrow">Biblioteca</span>
      <h1>Exercícios</h1>
      <p className="muted small" style={{ marginTop: 0 }}>
        Toque num exercício para ver como ele é feito.
      </p>
      <ExerciseBrowser />
    </main>
  )
}
