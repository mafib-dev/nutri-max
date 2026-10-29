import { useMemo, useState, type FormEvent } from 'react'
import { Icon, Modal } from './ui'
import { formatGrams, macrosFor, MEALS, searchFoods, type Food, type Meal } from '../modules/nutrition/foods'
import { addLog, createFood, loadFoods, recentFoodIds, type NewFood } from '../modules/nutrition/data'
import { useAsync } from '../lib/useAsync'

const QUICK_GRAMS = [50, 100, 150, 200]

/** Janela para buscar um alimento, escolher a quantidade e lançar na refeição. */
export default function FoodPicker(props: { date: string; meal: Meal; onClose: () => void; onAdded: () => void }) {
  const data = useAsync(() => Promise.all([loadFoods(), recentFoodIds()]))
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)
  const [added, setAdded] = useState<string[]>([])

  const [foods, recentIds] = data.data ?? [[], []]
  const recent = useMemo(() => {
    const byId = new Map(foods.map(f => [f.id, f]))
    return recentIds.map(id => byId.get(id)).filter((f): f is Food => !!f)
  }, [foods, recentIds])
  const results = useMemo(() => (query.trim() ? searchFoods(foods, query, 60) : []), [foods, query])

  const title = picked ? 'Quanto você comeu?' : creating ? 'Criar alimento' : `Adicionar ao ${MEALS.find(m => m.key === props.meal)!.label.toLowerCase()}`

  return (
    <Modal
      tall
      title={title}
      onClose={props.onClose}
      footer={
        added.length > 0 &&
        !picked &&
        !creating && (
          <div className="spread">
            <span className="small ellipsis">
              <span style={{ color: 'var(--accent)' }}>✓</span> {added.length === 1 ? added[0] : `${added.length} alimentos`} adicionado{added.length > 1 ? 's' : ''}
            </span>
            <button type="button" className="btn primary small" onClick={props.onClose}>
              Concluir
            </button>
          </div>
        )
      }
    >
      {picked ? (
        <PortionStep
          food={picked}
          date={props.date}
          meal={props.meal}
          onBack={() => setPicked(null)}
          onAdded={name => {
            setAdded(a => [...a, name])
            setPicked(null)
            setQuery('')
            props.onAdded()
          }}
        />
      ) : creating ? (
        <CreateFood
          initialName={query}
          onBack={() => setCreating(false)}
          onCreated={food => {
            setCreating(false)
            data.reload()
            setPicked(food)
          }}
        />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <label className="search">
            <Icon.search />
            <input className="input" autoFocus placeholder="Buscar: arroz, frango, banana…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar alimento" />
          </label>
          {data.loading && <p className="muted small">Carregando alimentos…</p>}
          {data.error && <p className="error small">{data.error}</p>}

          {!query.trim() && recent.length > 0 && (
            <>
              <span className="eyebrow">Usados recentemente</span>
              <FoodList foods={recent} onPick={setPicked} />
            </>
          )}
          {!query.trim() && data.data && recent.length === 0 && (
            <p className="muted small" style={{ margin: 0 }}>
              São 597 alimentos da tabela TACO, a tabela brasileira de composição de alimentos. Digite o nome do que você comeu.
            </p>
          )}
          {query.trim() && <FoodList foods={results} onPick={setPicked} />}
          {query.trim() && data.data && results.length === 0 && <p className="muted small">Nada encontrado para “{query}”.</p>}

          <button type="button" className="btn block" style={{ borderStyle: 'dashed' }} onClick={() => setCreating(true)}>
            <Icon.plus /> Criar alimento {query.trim() ? `“${query.trim()}”` : 'próprio'}
          </button>
        </div>
      )}
    </Modal>
  )
}

function FoodList({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <div className="list">
      {foods.map(f => (
        <button key={f.id} type="button" className="list-item" onClick={() => onPick(f)}>
          <div className="grow">
            <div className="title clamp-2">{f.name}</div>
            <div className="muted tiny">
              {f.source === 'custom' && f.serving_g ? `${f.serving_name || 'porção'} (${formatGrams(f.serving_g)}) · ` : ''}
              {Math.round(f.kcal)} kcal · {f.protein_g.toLocaleString('pt-BR')} g prot. em 100 g
            </div>
          </div>
          <span className="chev">›</span>
        </button>
      ))}
    </div>
  )
}

function PortionStep(props: { food: Food; date: string; meal: Meal; onBack: () => void; onAdded: (name: string) => void }) {
  const { food } = props
  const [grams, setGrams] = useState(String(food.serving_g ?? 100))
  const [meal, setMeal] = useState<Meal>(props.meal)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const g = Number(grams.replace(',', '.'))
  const valid = Number.isFinite(g) && g > 0 && g <= 5000
  const m = macrosFor(food, valid ? g : 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await addLog(props.date, meal, food, Math.round(g * 10) / 10)
      props.onAdded(food.name)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const quick = [...(food.serving_g ? [food.serving_g] : []), ...QUICK_GRAMS.filter(q => q !== food.serving_g)]

  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={props.onBack}>
        <Icon.back /> Voltar à busca
      </button>
      <div>
        <h3 style={{ fontSize: '1.5rem' }}>{food.name}</h3>
        {food.category && <span className="muted small">{food.category}</span>}
      </div>
      <label className="field">
        <span>Quantidade (g)</span>
        <input className="input" inputMode="decimal" autoFocus value={grams} onChange={e => setGrams(e.target.value)} />
      </label>
      <div className="chips wrap">
        {quick.map(q => (
          <button key={q} type="button" className={`chip ${g === q ? 'on' : ''}`} onClick={() => setGrams(String(q))}>
            {q === food.serving_g && food.serving_name ? `${food.serving_name} · ${q} g` : `${q} g`}
          </button>
        ))}
      </div>
      <div className="card macro-grid">
        <div className="stat">
          <span>Calorias</span>
          <strong>{m.kcal}</strong>
        </div>
        <div className="stat">
          <span>Proteína</span>
          <strong>{m.protein_g.toLocaleString('pt-BR')}</strong>
        </div>
        <div className="stat">
          <span>Carbo</span>
          <strong>{m.carbs_g.toLocaleString('pt-BR')}</strong>
        </div>
        <div className="stat">
          <span>Gordura</span>
          <strong>{m.fat_g.toLocaleString('pt-BR')}</strong>
        </div>
      </div>
      <div className="field">
        <span>Refeição</span>
        <div className="chips wrap">
          {MEALS.map(x => (
            <button key={x.key} type="button" className={`chip ${meal === x.key ? 'on' : ''}`} onClick={() => setMeal(x.key)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error small">{error}</p>}
      <button className="btn primary big block" disabled={!valid || busy}>
        {busy ? 'Adicionando…' : 'Adicionar'}
      </button>
    </form>
  )
}

function CreateFood(props: { initialName: string; onBack: () => void; onCreated: (f: Food) => void }) {
  const [form, setForm] = useState({ name: props.initialName.trim(), per: '100', kcal: '', protein: '', carbs: '', fat: '', serving: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }))
  const num = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const per = num(form.per)
    const values = [num(form.kcal), num(form.protein), num(form.carbs), num(form.fat)]
    if (!form.name.trim()) return setError('Dê um nome ao alimento.')
    if (!(per > 0) || values.some(v => !Number.isFinite(v) || v < 0)) return setError('Confira os números.')
    if (!form.kcal.trim()) return setError('Informe as calorias.')
    // Grava sempre por 100 g; a porção do rótulo vira o atalho de quantidade.
    const k = 100 / per
    const r1 = (n: number) => Math.round(n * k * 10) / 10
    const food: NewFood = {
      name: form.name.trim(),
      kcal: r1(values[0]),
      protein_g: r1(values[1]),
      carbs_g: r1(values[2]),
      fat_g: r1(values[3]),
      serving_g: per === 100 ? null : per,
      serving_name: per === 100 ? null : form.serving.trim() || null,
    }
    setBusy(true)
    setError(null)
    try {
      props.onCreated(await createFood(food))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={props.onBack}>
        <Icon.back /> Voltar à busca
      </button>
      <p className="muted small" style={{ margin: 0 }}>
        Copie os valores da tabela nutricional do rótulo. Ex.: whey, barra de proteína, receita da casa.
      </p>
      <label className="field">
        <span>Nome</span>
        <input className="input" value={form.name} onChange={set('name')} placeholder="Whey protein baunilha" />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>Porção (g)</span>
          <input className="input" inputMode="decimal" value={form.per} onChange={set('per')} />
        </label>
        <label className="field">
          <span>Nome da porção</span>
          <input className="input" value={form.serving} onChange={set('serving')} placeholder="1 scoop" disabled={num(form.per) === 100} />
        </label>
      </div>
      <div className="grid-2">
        <label className="field">
          <span>Calorias (kcal)</span>
          <input className="input" inputMode="decimal" value={form.kcal} onChange={set('kcal')} />
        </label>
        <label className="field">
          <span>Proteína (g)</span>
          <input className="input" inputMode="decimal" value={form.protein} onChange={set('protein')} />
        </label>
        <label className="field">
          <span>Carboidrato (g)</span>
          <input className="input" inputMode="decimal" value={form.carbs} onChange={set('carbs')} />
        </label>
        <label className="field">
          <span>Gordura (g)</span>
          <input className="input" inputMode="decimal" value={form.fat} onChange={set('fat')} />
        </label>
      </div>
      {error && <p className="error small">{error}</p>}
      <button className="btn primary big block" disabled={busy}>
        {busy ? 'Salvando…' : 'Salvar e escolher quantidade'}
      </button>
    </form>
  )
}
