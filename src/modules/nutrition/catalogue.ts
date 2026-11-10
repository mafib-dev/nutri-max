// Formulário do catálogo NutriMax (página /admin/alimentos): do rótulo para valores por 100 g.
import type { CatalogueFood } from './data'
import type { Food } from './foods'
import { cleanBarcode, isValidBarcode, type OffProduct } from './off'

export const CATEGORIES = ['Embalados', 'Laticínios', 'Pães e massas', 'Bebidas', 'Suplementos', 'Preparações', 'Outros'] as const

export interface CatalogueForm {
  name: string
  category: string
  barcode: string
  /** Gramas a que se referem os números digitados (100 ou a porção do rótulo). */
  per: string
  serving_name: string
  serving_g: string
  kcal: string
  protein_g: string
  carbs_g: string
  fat_g: string
  fiber_g: string
  sodium_mg: string
}

const text = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

export const emptyForm = (barcode = ''): CatalogueForm => ({
  name: '',
  category: barcode ? 'Embalados' : '',
  barcode,
  per: '100',
  serving_name: '',
  serving_g: '',
  kcal: '',
  protein_g: '',
  carbs_g: '',
  fat_g: '',
  fiber_g: '',
  sodium_mg: '',
})

/** Preenche o formulário com um alimento já salvo ou com o que veio do Open Food Facts (ambos por 100 g). */
export function formFrom(f: Pick<Food, 'name' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sodium_mg' | 'serving_name' | 'serving_g'> & { barcode: string | null; category?: string | null }): CatalogueForm {
  return {
    name: f.name,
    category: f.category ?? (f.barcode ? 'Embalados' : ''),
    barcode: f.barcode ?? '',
    per: '100',
    serving_name: f.serving_name ?? '',
    serving_g: text(f.serving_g),
    kcal: text(f.kcal),
    protein_g: text(f.protein_g),
    carbs_g: text(f.carbs_g),
    fat_g: text(f.fat_g),
    fiber_g: text(f.fiber_g),
    sodium_mg: text(f.sodium_mg),
  }
}

/** "1 pote (170 g)" vira "1 pote": os gramas já ficam no campo da porção. */
export const servingLabel = (s: string | null) => (s ? s.replace(/\s*\(?\s*\d+([.,]\d+)?\s*(g|ml)\s*\)?\s*$/i, '').trim() || null : null)

export const fromOff = (p: OffProduct) => formFrom({ ...p, serving_name: servingLabel(p.serving_name), category: 'Embalados' })

/** "12,5" e "12.5" valem 12,5; vazio é null; texto inválido é NaN. */
export const decimal = (s: string) => (s.trim() === '' ? null : Number(s.trim().replace(',', '.')))

/** Calorias que os macros dão (4 kcal/g de proteína e carboidrato, 9 de gordura). */
export const kcalFromMacros = (p: number, c: number, f: number) => Math.round(p * 4 + c * 4 + f * 9)

/**
 * Calorias que não batem com os macros (rótulo copiado errado, porção trocada).
 * Fibra e álcool explicam diferenças pequenas, então só avisa acima de 20% e 25 kcal.
 */
export function kcalMismatch(kcal: number, p: number, c: number, f: number): number | null {
  const expected = kcalFromMacros(p, c, f)
  const diff = Math.abs(kcal - expected)
  return diff > 25 && diff > 0.2 * Math.max(kcal, expected) ? expected : null
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Confere o formulário e converte para 100 g. Devolve o erro em português quando algo não fecha. */
export function parseForm(form: CatalogueForm): { food: CatalogueFood; error: null } | { food: null; error: string } {
  const bad = (error: string) => ({ food: null, error })
  const name = form.name.trim().replace(/\s+/g, ' ')
  if (!name) return bad('Dê um nome ao alimento.')
  if (name.length > 120) return bad('Nome muito longo (até 120 letras).')

  const barcode = cleanBarcode(form.barcode)
  if (barcode && !isValidBarcode(barcode)) return bad('Esse código de barras não parece certo. Confira os números.')

  const per = decimal(form.per)
  if (per == null || !(per > 0) || per > 2000) return bad('Informe a quantos gramas os valores se referem.')

  const kcal = decimal(form.kcal)
  if (kcal == null) return bad('Informe as calorias.')
  const values = { kcal, protein_g: decimal(form.protein_g) ?? 0, carbs_g: decimal(form.carbs_g) ?? 0, fat_g: decimal(form.fat_g) ?? 0, fiber_g: decimal(form.fiber_g), sodium_mg: decimal(form.sodium_mg) }
  if (Object.values(values).some(v => v != null && (!Number.isFinite(v) || v < 0))) return bad('Confira os números: só valores positivos.')

  const k = 100 / per
  const out = {
    kcal: r1(kcal * k),
    protein_g: r1(values.protein_g * k),
    carbs_g: r1(values.carbs_g * k),
    fat_g: r1(values.fat_g * k),
    fiber_g: values.fiber_g == null ? null : r1(values.fiber_g * k),
    sodium_mg: values.sodium_mg == null ? null : Math.round(values.sodium_mg * k),
  }
  if (out.kcal > 900 || out.protein_g + out.carbs_g + out.fat_g > 100.5) return bad('Em 100 g isso passa do possível. Confira a porção e os números.')

  // Porção do rótulo: se os valores foram digitados por porção, ela já é a porção.
  let servingG = decimal(form.serving_g)
  if (servingG == null && per !== 100) servingG = per
  if (servingG != null && (!Number.isFinite(servingG) || servingG <= 0 || servingG > 2000)) return bad('Confira os gramas da porção.')
  const servingName = form.serving_name.trim()

  return {
    error: null,
    food: {
      name,
      category: form.category.trim() || null,
      barcode: barcode || null,
      ...out,
      serving_g: servingG == null ? null : r1(servingG),
      serving_name: servingG == null ? null : servingName || null,
    },
  }
}
