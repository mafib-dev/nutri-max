import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, PenLine, ScanBarcode, ShieldAlert } from 'lucide-react'
import { Icon, Modal } from '../components/ui'
import { Kcal, Macros } from '../components/FoodRow'
import BarcodeScanner from '../components/BarcodeScanner'
import { deleteCatalogueFood, isAdmin, listCatalogueFoods, loadFoods, saveCatalogueFood } from '../modules/nutrition/data'
import { formatGrams, searchFoods, type Food } from '../modules/nutrition/foods'
import { fetchOffProduct } from '../modules/nutrition/off'
import { CATEGORIES, decimal, emptyForm, formFrom, fromOff, kcalMismatch, parseForm, type CatalogueForm } from '../modules/nutrition/catalogue'
import { listItem } from '../lib/motion'
import { notifyDataChanged } from '../lib/events'
import { useAsync } from '../lib/useAsync'

type Editing = { form: CatalogueForm; id?: string; note?: string }

/**
 * Página do administrador: acrescenta ao catálogo de todo mundo os alimentos que faltam na TACO.
 * Pelo código de barras, os dados vêm do Open Food Facts para revisar antes de salvar.
 */
export default function CatalogueAdmin() {
  const navigate = useNavigate()
  const access = useAsync(isAdmin)
  const list = useAsync(listCatalogueFoods)
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lookup, setLookup] = useState({ busy: false })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const items = useMemo(() => list.data ?? [], [list.data])
  const shown = useMemo(() => (query.trim() ? searchFoods(items, query, 200) : items), [items, query])

  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Estável: o leitor reinicia a câmera quando a função muda.
  const onCode = useCallback(async (code: string) => {
    setLookup({ busy: true })
    try {
      const known = itemsRef.current.find(f => f.barcode === code)
      if (known) {
        setScanning(false)
        return setEditing({ form: formFrom(known), id: known.id, note: 'Esse código já está no catálogo. Você pode corrigir os dados.' })
      }
      let note: string
      let form: CatalogueForm
      try {
        const product = await fetchOffProduct(code)
        form = product ? fromOff(product) : emptyForm(code)
        note = product ? 'Dados do Open Food Facts. Confira com a tabela do rótulo antes de salvar.' : 'Produto não encontrado no Open Food Facts. Copie a tabela nutricional do rótulo.'
      } catch {
        form = emptyForm(code)
        note = 'Não consegui consultar o Open Food Facts. Copie a tabela nutricional do rótulo.'
      }
      setScanning(false)
      setEditing({ form, note })
    } finally {
      setLookup({ busy: false })
    }
  }, [])

  const done = (message: string) => {
    setEditing(null)
    setSaved(message)
    list.reload()
    notifyDataChanged()
  }

  if (access.data === false)
    return (
      <main className="page stack form-width">
        <div className="empty">
          <ShieldAlert size={22} strokeWidth={1.75} aria-hidden="true" />
          <strong>Página só para administradores</strong>
          <p className="muted small" style={{ margin: 0 }}>
            Para cadastrar um alimento só seu, use "Criar alimento" na busca do diário.
          </p>
          <button type="button" className="btn" onClick={() => navigate('/')}>
            Voltar ao início
          </button>
        </div>
      </main>
    )

  return (
    <main className="page stack form-width">
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => navigate(-1)}>
        <Icon.back /> Voltar
      </button>

      <header>
        <span className="eyebrow">Administração</span>
        <h1>Catálogo de alimentos</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Alimentos que faltam na tabela TACO. O que você salvar aqui aparece na busca de todos os usuários.
        </p>
      </header>

      <div className="grid-2 catalogue-actions">
        <button type="button" className="btn primary big" onClick={() => setScanning(true)} disabled={!access.data}>
          <ScanBarcode size={20} strokeWidth={1.75} aria-hidden="true" /> Ler código de barras
        </button>
        <button type="button" className="btn big" onClick={() => setEditing({ form: emptyForm() })} disabled={!access.data}>
          <PenLine size={18} strokeWidth={1.75} aria-hidden="true" /> Cadastrar sem código
        </button>
      </div>

      {saved && (
        <p className="note" role="status">
          <Icon.check /> {saved}
        </p>
      )}

      <section className="stack" style={{ gap: 10 }}>
        <div className="spread">
          <h2 style={{ margin: 0 }}>Cadastrados</h2>
          <span className="muted small">{items.length === 1 ? '1 alimento' : `${items.length} alimentos`}</span>
        </div>
        {items.length > 6 && (
          <label className="search">
            <Icon.search />
            <input className="input" placeholder="Buscar no que você cadastrou" value={query} onChange={e => setQuery(e.target.value)} />
          </label>
        )}
        {list.error && <p className="error small">{list.error}</p>}
        {!list.data && !list.error && <p className="muted small">Carregando…</p>}
        {list.data && items.length === 0 && (
          <div className="empty">
            <strong>Nada cadastrado ainda</strong>
            <p className="muted small" style={{ margin: 0 }}>
              Leia o código de barras de um produto que não aparece na busca, como um pão de forma, um iogurte ou um whey.
            </p>
          </div>
        )}
        {shown.length > 0 && (
          <div className="panel">
            <AnimatePresence initial={false}>
              {shown.map(f => (
                <motion.button key={f.id} type="button" className="panel-row profile-row catalogue-row" {...listItem} onClick={() => setEditing({ form: formFrom(f), id: f.id })}>
                  <span className="grow">
                    <span className="food-name">{f.name}</span>
                    <span className="food-detail">{[f.category, f.serving_g ? `${f.serving_name || 'porção'}: ${formatGrams(f.serving_g)}` : null, f.barcode].filter(Boolean).join(' · ')}</span>
                    <Macros p={f.protein_g} c={f.carbs_g} f={f.fat_g} />
                  </span>
                  <span className="food-kcal per100">
                    <Kcal value={f.kcal} />
                    <small>em 100 g</small>
                  </span>
                  <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="muted" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
        {query.trim() && items.length > 0 && shown.length === 0 && <p className="muted small">Nada com "{query}".</p>}
      </section>

      {scanning && (
        <Modal tall title="Ler código de barras" onClose={() => setScanning(false)}>
          <BarcodeScanner onCode={onCode} busy={lookup.busy} />
          {lookup.busy && <p className="muted small">Procurando o produto…</p>}
        </Modal>
      )}

      {editing && (
        <FoodEditor
          key={editing.id ?? 'new'}
          {...editing}
          others={items}
          onClose={() => setEditing(null)}
          onSaved={f => done(`${f.name} ${editing.id ? 'atualizado' : 'adicionado ao catálogo'}.`)}
          onDeleted={name => done(`${name} saiu do catálogo.`)}
        />
      )}
    </main>
  )
}

function FoodEditor(props: Editing & { others: Food[]; onClose: () => void; onSaved: (f: Food) => void; onDeleted: (name: string) => void }) {
  const [form, setForm] = useState(props.form)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const all = useAsync(loadFoods)
  const set = (k: keyof CatalogueForm) => (e: { target: { value: string } }) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    setError(null)
  }

  // Antes de criar, mostra o que já existe com nome parecido (TACO ou catálogo) para não duplicar.
  const similar = useMemo(() => {
    const name = form.name.trim()
    if (props.id || name.length < 3) return []
    return searchFoods(all.data ?? props.others, name, 4)
  }, [all.data, form.name, props.id, props.others])

  const n = (s: string) => decimal(s) ?? 0
  const mismatch = form.kcal.trim() ? kcalMismatch(n(form.kcal), n(form.protein_g), n(form.carbs_g), n(form.fat_g)) : null
  const per = decimal(form.per)
  const perServing = per != null && per !== 100

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const parsed = parseForm(form)
    if (parsed.error != null) return setError(parsed.error)
    setBusy(true)
    try {
      props.onSaved(await saveCatalogueFood(parsed.food, props.id))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function remove() {
    if (!props.id || !confirm(`Tirar "${props.form.name}" do catálogo? O que já foi lançado no diário de alguém continua.`)) return
    setBusy(true)
    try {
      await deleteCatalogueFood(props.id)
      props.onDeleted(props.form.name)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const field = (k: keyof CatalogueForm, label: string, extra: { placeholder?: string; decimal?: boolean; wide?: boolean } = {}) => (
    <label className="field" style={extra.wide ? { gridColumn: '1 / -1' } : undefined}>
      <span>{label}</span>
      <input className="input" inputMode={extra.decimal ? 'decimal' : undefined} value={form[k]} onChange={set(k)} placeholder={extra.placeholder} />
    </label>
  )

  return (
    <Modal
      tall
      title={props.id ? 'Editar alimento' : 'Novo alimento'}
      onClose={props.onClose}
      footer={
        <div className="spread" style={{ gap: 8 }}>
          {props.id ? (
            <button type="button" className="btn ghost danger" onClick={remove} disabled={busy}>
              Apagar
            </button>
          ) : (
            <span />
          )}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn ghost" onClick={props.onClose}>
              Cancelar
            </button>
            <button type="submit" form="catalogue-food" className="btn primary" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar no catálogo'}
            </button>
          </div>
        </div>
      }
    >
      <form id="catalogue-food" className="stack" style={{ gap: 14 }} onSubmit={submit} noValidate>
        {props.note && (
          <p className="note" style={{ margin: 0 }}>
            <Icon.info /> {props.note}
          </p>
        )}
        {field('name', 'Nome', { placeholder: 'Pão de forma integral · Marca' })}
        <AnimatePresence initial={false}>
          {similar.length > 0 && (
            <motion.div className="similar" {...listItem}>
              <span className="muted tiny">Já existe na tabela com nome parecido:</span>
              {similar.map(f => (
                <span key={f.id} className="similar-item">
                  <span className="ellipsis">{f.name}</span>
                  <span className="muted tiny">{f.source === 'taco' ? 'TACO' : f.source === 'nutrimax' ? 'catálogo' : 'pessoal'}</span>
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="field">
          <span>Categoria</span>
          <div className="chips wrap">
            {CATEGORIES.map(c => (
              <button key={c} type="button" className={`chip ${form.category === c ? 'on' : ''}`} onClick={() => setForm(f => ({ ...f, category: f.category === c ? '' : c }))}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {field('barcode', 'Código de barras (opcional)', { placeholder: '7891234567890', decimal: true })}

        <fieldset className="catalogue-values">
          <legend>Tabela nutricional</legend>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="small">Valores por</span>
            <input className="input per-input" inputMode="decimal" value={form.per} onChange={set('per')} aria-label="Gramas a que os valores se referem" />
            <span className="small">g</span>
            <span className="muted tiny">{perServing ? 'Converto para 100 g ao salvar.' : 'Use a porção do rótulo se ele não tiver a coluna de 100 g.'}</span>
          </div>
          <div className="grid-2">
            {field('kcal', 'Calorias (kcal)', { decimal: true })}
            {field('protein_g', 'Proteína (g)', { decimal: true })}
            {field('carbs_g', 'Carboidrato (g)', { decimal: true })}
            {field('fat_g', 'Gordura (g)', { decimal: true })}
            {field('fiber_g', 'Fibra (g)', { decimal: true, placeholder: 'opcional' })}
            {field('sodium_mg', 'Sódio (mg)', { decimal: true, placeholder: 'opcional' })}
          </div>
          {mismatch != null && (
            <p className="warn small" style={{ margin: 0 }}>
              As calorias não batem com os macros, que dariam cerca de {mismatch} kcal. Confira o rótulo.
            </p>
          )}
        </fieldset>

        <div className="grid-2">
          {field('serving_name', 'Nome da porção', { placeholder: '2 fatias, 1 pote, 1 scoop' })}
          {field('serving_g', 'Porção (g)', { decimal: true, placeholder: perServing ? form.per : 'opcional' })}
        </div>
        <p className="muted tiny" style={{ margin: '-6px 0 0' }}>
          A porção vira o atalho de quantidade quando alguém lança o alimento no diário.
        </p>

        {error && (
          <p className="error small" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
