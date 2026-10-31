import { motion } from 'motion/react'
import type { Macros } from '../modules/nutrition/foods'
import type { Targets } from '../modules/nutrition/targets'
import { CountUp } from './ui'

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

function Ring({ value, max }: { value: number; max: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const over = max > 0 && value > max * 1.05
  return (
    <svg className="ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r={r} className="ring-track" />
      {/* Enche uma vez ao aparecer; depois a transição do CSS acompanha as mudanças. */}
      <motion.circle
        cx="60"
        cy="60"
        r={r}
        className={`ring-fill ${over ? 'over' : ''}`}
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  )
}

export default function NutritionSummary({ total, targets, trainingKcal }: { total: Macros; targets: Targets | null; trainingKcal: number }) {
  const left = targets ? targets.kcal - total.kcal : null
  const macros: { label: string; key: keyof Omit<Macros, 'kcal'>; cls: string }[] = [
    { label: 'Proteína', key: 'protein_g', cls: 'p' },
    { label: 'Carboidrato', key: 'carbs_g', cls: 'c' },
    { label: 'Gordura', key: 'fat_g', cls: 'f' },
  ]
  return (
    <div className="card hero summary">
      <div className="ring-wrap">
        <Ring value={total.kcal} max={targets?.kcal ?? 0} />
        <div className="ring-label">
          {left == null ? (
            <>
              <strong>
                <CountUp value={total.kcal} format={fmt} />
              </strong>
              <span>kcal</span>
            </>
          ) : left >= 0 ? (
            <>
              <strong>
                <CountUp value={left} format={fmt} />
              </strong>
              <span>kcal restantes</span>
            </>
          ) : (
            <>
              <strong className="over">
                <CountUp value={-left} format={fmt} />
              </strong>
              <span>kcal acima</span>
            </>
          )}
        </div>
      </div>
      <div className="stack" style={{ gap: 12, minWidth: 0 }}>
        {targets && (
          <div className="muted small">
            {fmt(total.kcal)} de {fmt(targets.kcal)} kcal
            {trainingKcal > 0 && <span style={{ color: 'var(--accent)' }}> · +{fmt(trainingKcal)} do treino</span>}
          </div>
        )}
        {macros.map(m => {
          const goal = targets?.[m.key] ?? 0
          return (
            <div key={m.key}>
              <div className="spread small">
                <span style={{ fontWeight: 600 }}>{m.label}</span>
                <span className="muted">
                  {fmt(total[m.key])}
                  {goal > 0 && ` / ${fmt(goal)}`} g
                </span>
              </div>
              <div className="meter">
                <span className={`macro ${m.cls}`} style={{ width: `${goal > 0 ? Math.min((total[m.key] / goal) * 100, 100) : 0}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
