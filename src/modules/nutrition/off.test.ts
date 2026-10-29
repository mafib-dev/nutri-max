import { describe, expect, it } from 'vitest'
import { cleanBarcode, fetchOffProduct, isValidBarcode, parseOffProduct } from './off'

const product = (p: Record<string, unknown>) => ({ status: 1, product: p })

describe('código de barras', () => {
  it('confere o dígito verificador', () => {
    expect(isValidBarcode('7891000100103')).toBe(true) // EAN-13 brasileiro
    expect(isValidBarcode('7891000100104')).toBe(false)
    expect(isValidBarcode('96385074')).toBe(true) // EAN-8
    expect(isValidBarcode('036000291452')).toBe(true) // UPC-A
    expect(isValidBarcode('12345')).toBe(false)
  })

  it('limpa espaços e traços', () => {
    expect(cleanBarcode(' 789 1000-100103 ')).toBe('7891000100103')
  })
})

describe('Open Food Facts', () => {
  it('converte nutrientes por 100 g, porção, marca e sódio', () => {
    const p = parseOffProduct(
      product({
        product_name_pt: 'Iogurte natural',
        product_name: 'Natural yogurt',
        brands: 'Nestlé, Molico',
        serving_size: '1 pote (170 g)',
        serving_quantity: '170',
        nutriments: { 'energy-kcal_100g': 63.5, proteins_100g: 3.9, carbohydrates_100g: '5,2', fat_100g: 3, fiber_100g: 0, salt_100g: 0.15 },
      }),
      '7891000100103',
    )!
    expect(p).toEqual({
      barcode: '7891000100103',
      name: 'Iogurte natural · Nestlé',
      kcal: 63.5,
      protein_g: 3.9,
      carbs_g: 5.2,
      fat_g: 3,
      fiber_g: 0,
      sodium_mg: 60,
      serving_g: 170,
      serving_name: '1 pote (170 g)',
    })
  })

  it('calcula as kcal quando só há kJ e não repete a marca no nome', () => {
    const p = parseOffProduct(product({ product_name: 'Whey Growth', brands: 'Growth', nutriments: { 'energy-kj_100g': 1674, proteins_100g: 80 } }), '1')!
    expect(p.kcal).toBe(400.1)
    expect(p.name).toBe('Whey Growth')
    expect(p.carbs_g).toBe(0)
    expect(p.serving_g).toBeNull()
  })

  it('ignora produto inexistente ou sem calorias', () => {
    expect(parseOffProduct({ status: 0 }, '1')).toBeNull()
    expect(parseOffProduct(product({ product_name: 'Água', nutriments: {} }), '1')).toBeNull()
  })

  it('busca pela API e trata 404 como não encontrado', async () => {
    const ok = (async () => new Response(JSON.stringify(product({ product_name: 'X', nutriments: { 'energy-kcal_100g': 100 } })))) as typeof fetch
    expect((await fetchOffProduct('7891000100103', ok))?.kcal).toBe(100)
    const missing = (async () => new Response('{}', { status: 404 })) as typeof fetch
    expect(await fetchOffProduct('7891000100103', missing)).toBeNull()
    const down = (async () => new Response('', { status: 503 })) as typeof fetch
    await expect(fetchOffProduct('7891000100103', down)).rejects.toThrow('503')
  })
})
