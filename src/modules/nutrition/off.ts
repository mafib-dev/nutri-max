// Produtos embalados pelo código de barras, na base aberta do Open Food Facts.
// Ideia e mapeamento dos nutrientes vindos do OpenNutriTracker (GPLv3), reescritos em TypeScript.

export interface OffProduct {
  barcode: string
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  sodium_mg: number | null
  serving_name: string | null
  serving_g: number | null
}

/** Só dígitos; aceita o que o leitor ou a pessoa digitou com espaços e traços. */
export const cleanBarcode = (s: string) => s.replace(/\D/g, '')

/** EAN-8, UPC-A (12), EAN-13 e GTIN-14, conferindo o dígito verificador. */
export function isValidBarcode(code: string): boolean {
  if (![8, 12, 13, 14].includes(code.length) || /\D/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  // Da direita para a esquerda, pesos 3, 1, 3, 1…
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

const FIELDS = ['code', 'product_name', 'product_name_pt', 'generic_name_pt', 'brands', 'nutriments', 'serving_size', 'serving_quantity'].join(',')

export const offProductUrl = (barcode: string) => `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${FIELDS}`

type Json = Record<string, unknown>

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}
const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Converte a resposta do Open Food Facts. Devolve null quando o produto não existe
 * ou não tem as calorias por 100 g (sem elas não dá para calcular nada).
 */
export function parseOffProduct(json: Json, barcode: string): OffProduct | null {
  if (json.status !== 1 || !json.product) return null
  const p = json.product as Json
  const n = (p.nutriments ?? {}) as Json
  // Alguns produtos só têm kJ: 1 kcal = 4,184 kJ.
  const kj = num(n['energy-kj_100g']) ?? (n.energy_unit === 'kJ' ? num(n['energy_100g']) : null)
  const kcal = num(n['energy-kcal_100g']) ?? (kj != null ? kj / 4.184 : null)
  if (kcal == null) return null

  const title = String(p.product_name_pt || p.product_name || p.generic_name_pt || '').trim()
  const brand = String(p.brands || '').split(',')[0].trim()
  const name = [title || 'Produto sem nome', brand && !title.toLowerCase().includes(brand.toLowerCase()) ? brand : ''].filter(Boolean).join(' · ')

  const sodium = num(n['sodium_100g']) ?? (num(n['salt_100g']) != null ? num(n['salt_100g'])! / 2.5 : null)
  const servingG = num(p.serving_quantity)
  return {
    barcode,
    name,
    kcal: round1(kcal),
    protein_g: round1(num(n['proteins_100g']) ?? 0),
    carbs_g: round1(num(n['carbohydrates_100g']) ?? 0),
    fat_g: round1(num(n['fat_100g']) ?? 0),
    fiber_g: num(n['fiber_100g']) == null ? null : round1(num(n['fiber_100g'])!),
    sodium_mg: sodium == null ? null : Math.round(sodium * 1000),
    serving_g: servingG && servingG > 0 && servingG <= 2000 ? round1(servingG) : null,
    serving_name: servingG && p.serving_size ? String(p.serving_size).trim().slice(0, 40) : null,
  }
}

export async function fetchOffProduct(barcode: string, fetcher: typeof fetch = fetch): Promise<OffProduct | null> {
  const res = await fetcher(offProductUrl(barcode))
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Open Food Facts respondeu ${res.status}. Tente de novo em instantes.`)
  return parseOffProduct((await res.json()) as Json, barcode)
}
