import { describe, expect, it } from 'vitest'
import { emptyForm, formFrom, kcalMismatch, parseForm, servingLabel } from './catalogue'

const filled = { ...emptyForm(), name: '  Pão de forma   integral ', kcal: '250', protein_g: '10', carbs_g: '45', fat_g: '3', fiber_g: '6', sodium_mg: '400' }

describe('catálogo: formulário', () => {
  it('guarda por 100 g, limpando espaços do nome', () => {
    const { food, error } = parseForm(filled)
    expect(error).toBeNull()
    expect(food).toMatchObject({ name: 'Pão de forma integral', kcal: 250, protein_g: 10, fiber_g: 6, sodium_mg: 400, serving_g: null, barcode: null, category: null })
  })

  it('converte valores da porção do rótulo para 100 g e guarda a porção', () => {
    const { food } = parseForm({ ...filled, per: '50', kcal: '125', protein_g: '5', carbs_g: '22,5', fat_g: '1,5', fiber_g: '', sodium_mg: '', serving_name: '2 fatias' })
    expect(food).toMatchObject({ kcal: 250, protein_g: 10, carbs_g: 45, fat_g: 3, fiber_g: null, sodium_mg: null, serving_g: 50, serving_name: '2 fatias' })
  })

  it('aceita código de barras válido e recusa o errado', () => {
    expect(parseForm({ ...filled, barcode: '7891000100103' }).food?.barcode).toBe('7891000100103')
    expect(parseForm({ ...filled, barcode: '7891000100104' }).error).toMatch(/código/)
  })

  it('recusa o que não fecha', () => {
    expect(parseForm({ ...filled, name: ' ' }).error).toMatch(/nome/)
    expect(parseForm({ ...filled, kcal: '' }).error).toMatch(/calorias/)
    expect(parseForm({ ...filled, protein_g: '-1' }).error).toMatch(/positivos/)
    expect(parseForm({ ...filled, per: '10', kcal: '250' }).error).toMatch(/possível/)
  })

  it('volta para o formulário e salva igual', () => {
    const { food } = parseForm({ ...filled, barcode: '7891000100103', category: 'Embalados', serving_g: '30', serving_name: '1 fatia' })
    expect(parseForm(formFrom(food!)).food).toEqual(food)
  })

  it('avisa quando as calorias não batem com os macros', () => {
    expect(kcalMismatch(250, 10, 45, 3)).toBeNull()
    expect(kcalMismatch(120, 10, 45, 3)).toBe(247)
  })

  it('tira os gramas do nome da porção do Open Food Facts', () => {
    expect(servingLabel('1 pote (170 g)')).toBe('1 pote')
    expect(servingLabel('2 fatias 50g')).toBe('2 fatias')
    expect(servingLabel('30 g')).toBeNull()
    expect(servingLabel('1 scoop')).toBe('1 scoop')
  })
})
