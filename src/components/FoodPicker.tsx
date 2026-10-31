import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Icon, Modal } from './ui'
import { Kcal, Macros } from './FoodRow'
import BarcodeScanner from './BarcodeScanner'
import { formatGrams, macrosFor, MEALS, searchFoods, type Food, type Meal } from '../modules/nutrition/foods'
import { addLog, addQuickLog, createFood, deleteSavedMeal, findFoodByBarcode, listSavedMeals, loadFoods, logSavedMeal, recentFoodIds, type NewFood, type SavedMeal } from '../modules/nutrition/data'
import { fetchOffProduct } from '../modules/nutrition/off'
import { useAsync } from '../lib/useAsync'

const QUICK_GRAMS = [50, 100, 150, 200]

/** Janela para buscar um alimento, escolher a quantidade e lançar na refeição. */
export default function FoodPicker(props: { date: string; meal: Meal; onClose: () => void; onAdded: () => void }) {
  const data = useAsync(() => Promise.all([loadFoods(), recentFoodIds(), listSavedMeals()]))
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)
  const [mode, setMode] = useState<'search' | 'scan' | 'quick' | 'create'>('search')
  const [added, setAdded] = useState<string[]>([])
  const [lookup, setLookup] = useState<{ busy: boolean; error: string | null; missing: string | null; attempt: number }>({ busy: false, error: null, missing: null, attempt: 0 })
  const creating = mode === 'create'
  const backToSearch = () => {
    setMode('search')
    setLookup(l => ({ ...l, busy: false, error: null, missing: null }))
  }

  const logged = (name: string) => {
    setAdded(a => [...a, name])
    setPicked(null)
    setQuery('')
    backToSearch()
    props.onAdded()
  }

  // Primeiro os produtos que a pessoa já leu; depois o Open Food Facts, salvando o produto
  // como alimento dela para a próxima leitura ser instantânea.
  const onCode = useCallback(
    async (code: string) => {
      setLookup(l => ({ ...l, busy: true, error: null, missing: null }))
      try {
        const known = await findFoodByBarcode(code)
        if (known) return setPicked(known)
        const product = await fetchOffProduct(code)
        if (!product) return setLookup(l => ({ ...l, busy: false, missing: code }))
        const { barcode, ...rest } = product
        const food = await createFood({ ...rest, barcode, category: 'Embalados' })
        data.reload()
        setPicked(food)
      } catch (err) {
        const msg = (err as Error).message
        setLookup(l => ({ ...l, busy: false, error: /fetch|network/i.test(msg) ? 'Sem conexão com o Open Food Facts. Confira a internet e tente de novo.' : msg }))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [foods, recentIds, savedMeals] = data.data ?? [[], [], []]
  const [mealBusy, setMealBusy] = useState<string | null>(null)
  const [mealError, setMealError] = useState<string | null>(null)

  async function logSaved(m: SavedMeal) {
    setMealBusy(m.id)
    setMealError(null)
    try {
      await logSavedMeal(props.date, props.meal, m)
      logged(m.name)
    } catch (err) {
      setMealError((err as Error).message)
    }
    setMealBusy(null)
  }

  async function removeSaved(m: SavedMeal) {
    if (!confirm(`Apagar a refeição salva "${m.name}"? O que já foi lançado no diário continua.`)) return
    try {
      await deleteSavedMeal(m.id)
      data.reload()
    } catch (err) {
      setMealError((err as Error).message)
    }
  }
  const recent = useMemo(() => {
    const byId = new Map(foods.map(f => [f.id, f]))
    return recentIds.map(id => byId.get(id)).filter((f): f is Food => !!f)
  }, [foods, recentIds])
  const results = useMemo(() => (query.trim() ? searchFoods(foods, query, 60) : []), [foods, query])

  const mealLabel = MEALS.find(m => m.key === props.meal)!.label.toLowerCase()
  const title = picked
    ? 'Quanto você comeu?'
    : mode === 'create'
      ? 'Criar alimento'
      : mode === 'scan'
        ? 'Ler código de barras'
        : mode === 'quick'
          ? 'Adição rápida'
          : `Adicionar ao ${mealLabel}`

  return (
    <Modal
      tall
      title={title}
      onClose={props.onClose}
      footer={
        added.length > 0 &&
        !picked &&
        mode === 'search' && (
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
          onBack={() => {
            setPicked(null)
            backToSearch()
          }}
          onAdded={logged}
        />
      ) : creating ? (
        <CreateFood
          initialName={lookup.missing ? '' : query}
          barcode={lookup.missing}
          onBack={backToSearch}
          onCreated={food => {
            data.reload()
            setPicked(food)
          }}
        />
      ) : mode === 'quick' ? (
        <QuickAdd date={props.date} meal={props.meal} onBack={backToSearch} onAdded={logged} />
      ) : mode === 'scan' ? (
        <div className="stack" style={{ gap: 12 }}>
          <button type="button" className="btn ghost small" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={backToSearch}>
            <Icon.back /> Voltar à busca
          </button>
          {lookup.missing ? (
            <div className="empty">
              <h3>Produto não encontrado</h3>
              <span className="muted small">O código {lookup.missing} ainda não está no Open Food Facts. Cadastre com os dados do rótulo e na próxima vez ele aparece na hora.</span>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn primary" onClick={() => setMode('create')}>
                  Cadastrar pelo rótulo
                </button>
                <button type="button" className="btn ghost" onClick={() => setLookup(l => ({ ...l, missing: null, attempt: l.attempt + 1 }))}>
                  Ler outro
                </button>
              </div>
            </div>
          ) : (
            <BarcodeScanner key={lookup.attempt} onCode={onCode} busy={lookup.busy} />
          )}
          {lookup.error && (
            <div className="stack" style={{ gap: 8 }}>
              <p className="error small" style={{ margin: 0 }}>{lookup.error}</p>
              <button type="button" className="btn small" style={{ justifySelf: 'start' }} onClick={() => setLookup(l => ({ ...l, error: null, attempt: l.attempt + 1 }))}>
                Tentar de novo
              </button>
            </div>
          )}
          <p className="muted tiny" style={{ margin: 0 }}>
            Dados dos produtos do Open Food Facts, base aberta e colaborativa. Confira com o rótulo quando puder.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <label className="search">
            <Icon.search />
            <input className="input" autoFocus placeholder="Buscar: arroz, frango, banana…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar alimento" />
          </label>
          <div className="grid-2 picker-actions">
            <button type="button" className="btn" onClick={() => setMode('scan')}>
              <Icon.barcode /> Código de barras
            </button>
            <button type="button" className="btn" onClick={() => setMode('quick')}>
              <Icon.bolt /> Adição rápida
            </button>
          </div>
          {data.loading && <p className="muted small">Carregando alimentos…</p>}
          {data.error && <p className="error small">{data.error}</p>}

          {!query.trim() && savedMeals.length > 0 && (
            <>
              <span className="eyebrow">Refeições salvas</span>
              <div className="list">
                {savedMeals.map(m => {
                  const kcal = Math.round(m.items.reduce((a, i) => a + Number(i.kcal), 0))
                  return (
                    <div key={m.id} className="list-item saved-meal">
                      <button type="button" className="grow" onClick={() => logSaved(m)} disabled={!!mealBusy}>
                        <div className="title ellipsis">{m.name}</div>
                        <div className="muted tiny ellipsis">{mealBusy === m.id ? 'Lançando…' : m.items.map(i => i.name.split(',')[0]).join(', ')}</div>
                      </button>
                      <Kcal value={kcal} />
                      <button type="button" className="btn ghost icon" aria-label={`Apagar ${m.name}`} onClick={() => removeSaved(m)}>
                        <Icon.close />
                      </button>
                    </div>
                  )
                })}
              </div>
              {mealError && <p className="error small">{mealError}</p>}
            </>
          )}
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

          <button type="button" className="btn block" style={{ borderStyle: 'dashed' }} onClick={() => setMode('create')}>
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
          <div className="grow stack" style={{ gap: 6, minWidth: 0 }}>
            <div className="title clamp-2">{f.name}</div>
            <Macros p={f.protein_g} c={f.carbs_g} f={f.fat_g} />
            {f.source === 'custom' && f.serving_g ? (
              <div className="muted tiny">
                {f.serving_name || 'porção'}: {formatGrams(f.serving_g)}
              </div>
            ) : null}
          </div>
          <span className="food-kcal per100">
            <span>
              <b>{Math.round(f.kcal)}</b> kcal
            </span>
            <small>em 100 g</small>
          </span>
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

function CreateFood(props: { initialName: string; barcode?: string | null; onBack: () => void; onCreated: (f: Food) => void }) {
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
      barcode: props.barcode ?? null,
      ...(props.barcode ? { category: 'Embalados' } : {}),
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
        {props.barcode ? `Código ${props.barcode}. ` : ''}Copie os valores da tabela nutricional do rótulo. Ex.: whey, barra de proteína, receita da casa.
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

type MacroValues = { kcal: string; protein_g: string; carbs_g: string; fat_g: string }

/** Lê os quatro campos; calorias obrigatórias, macros em branco valem 0. Null se algo estiver errado. */
export function parseMacroInputs(v: MacroValues) {
  const n = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')))
  const out = { kcal: n(v.kcal), protein_g: n(v.protein_g), carbs_g: n(v.carbs_g), fat_g: n(v.fat_g) }
  if (!v.kcal.trim() || Object.values(out).some(x => !Number.isFinite(x) || x < 0) || out.kcal > 10000) return null
  return { kcal: Math.round(out.kcal), protein_g: Math.round(out.protein_g * 10) / 10, carbs_g: Math.round(out.carbs_g * 10) / 10, fat_g: Math.round(out.fat_g * 10) / 10 }
}

export function MacroInputs({ values, onChange }: { values: MacroValues; onChange: (v: MacroValues) => void }) {
  const field = (k: keyof MacroValues, label: string) => (
    <label className="field">
      <span>{label}</span>
      <input className="input" inputMode="decimal" value={values[k]} onChange={e => onChange({ ...values, [k]: e.target.value })} />
    </label>
  )
  return (
    <div className="grid-2">
      {field('kcal', 'Calorias (kcal)')}
      {field('protein_g', 'Proteína (g)')}
      {field('carbs_g', 'Carboidrato (g)')}
      {field('fat_g', 'Gordura (g)')}
    </div>
  )
}

function QuickAdd(props: { date: string; meal: Meal; onBack: () => void; onAdded: (name: string) => void }) {
  const [name, setName] = useState('')
  const [values, setValues] = useState<MacroValues>({ kcal: '', protein_g: '', carbs_g: '', fat_g: '' })
  const [meal, setMeal] = useState<Meal>(props.meal)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const parsed = parseMacroInputs(values)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!parsed) return setError('Informe pelo menos as calorias.')
    setBusy(true)
    setError(null)
    const title = name.trim() || 'Adição rápida'
    try {
      await addQuickLog(props.date, meal, { name: title, ...parsed })
      props.onAdded(title)
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
        Quando você já sabe o valor, como um prato de restaurante ou o que o app do delivery mostra.
      </p>
      <label className="field">
        <span>O que foi (opcional)</span>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Marmita do almoço" />
      </label>
      <MacroInputs values={values} onChange={setValues} />
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
      <button className="btn primary big block" disabled={busy || !values.kcal.trim()}>
        {busy ? 'Adicionando…' : 'Adicionar'}
      </button>
    </form>
  )
}
