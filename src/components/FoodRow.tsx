import type { CSSProperties, ReactNode } from 'react'
import type { Role } from '../modules/nutrition/plan'

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')
const dot = (color: string) => ({ '--dot': color }) as CSSProperties

// Uma cor por grupo, as mesmas dos macros: proteína azul, carboidrato laranja, gordura amarelo, vegetais verde.
const GROUP: Record<Role, { color: string; label: string }> = {
  protein: { color: 'var(--protein)', label: 'Proteína' },
  carb: { color: 'var(--carbs)', label: 'Carboidrato' },
  legume: { color: 'var(--carbs)', label: 'Leguminosa' },
  fruit: { color: 'var(--carbs)', label: 'Fruta' },
  fat: { color: 'var(--fat)', label: 'Gordura boa' },
  veg: { color: 'var(--accent)', label: 'Legume' },
  salad: { color: 'var(--accent)', label: 'Salada' },
}

/** Marcador colorido do grupo do alimento. */
export function GroupDot({ role }: { role: Role }) {
  return <span className="food-dot" style={dot(GROUP[role].color)} title={GROUP[role].label} aria-label={GROUP[role].label} role="img" />
}

/** Legenda das cores dos grupos. */
export function GroupLegend() {
  const items = [
    ['var(--protein)', 'Proteína'],
    ['var(--carbs)', 'Carboidrato'],
    ['var(--fat)', 'Gordura'],
    ['var(--accent)', 'Vegetais'],
  ]
  return (
    <div className="group-legend" aria-hidden="true">
      {items.map(([c, l]) => (
        <span key={l} style={dot(c)}>
          <i />
          {l}
        </span>
      ))}
    </div>
  )
}

/** Linha de alimento: nome em cima, porção embaixo, kcal alinhada à direita. */
export function FoodRow({ name, detail, kcal, role }: { name: ReactNode; detail?: ReactNode; kcal?: number; role?: Role }) {
  return (
    <div className="food-row">
      {role && <GroupDot role={role} />}
      <span className="food-main">
        <span className="food-name">{name}</span>
        {detail && <span className="food-detail">{detail}</span>}
      </span>
      {kcal != null && <Kcal value={kcal} />}
    </div>
  )
}

export function Kcal({ value }: { value: number }) {
  return (
    <span className="food-kcal">
      <b>{fmt(value)}</b> kcal
    </span>
  )
}

/** Macros em etiquetas pequenas, cada uma com a cor do macro. */
export function Macros({ p, c, f }: { p: number; c: number; f: number }) {
  return (
    <span className="macros">
      <span className="macro" style={dot('var(--protein)')} title="Proteína">
        <i />P <b>{fmt(p)}</b> g
      </span>
      <span className="macro" style={dot('var(--carbs)')} title="Carboidrato">
        <i />C <b>{fmt(c)}</b> g
      </span>
      <span className="macro" style={dot('var(--fat)')} title="Gordura">
        <i />G <b>{fmt(f)}</b> g
      </span>
    </span>
  )
}

/** Blocos de macros para resumos do dia: nome, valor e, se houver, a meta. */
export function MacroTiles({ items }: { items: { label: string; value: number; target?: number; color: string }[] }) {
  return (
    <div className={`macro-tiles n${items.length}`}>
      {items.map(i => (
        <div key={i.label} className="macro-tile" style={dot(i.color)}>
          <span className="macro-tile-label">
            <i />
            {i.label}
          </span>
          <strong>
            {fmt(i.value)} <small>g</small>
          </strong>
          {i.target != null && <span className="muted tiny">meta {fmt(i.target)} g</span>}
        </div>
      ))}
    </div>
  )
}
