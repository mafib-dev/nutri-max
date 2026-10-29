import { describe, expect, it } from 'vitest'
import { macrosFor, mealForHour, normalize, searchFoods, sumMacros } from './foods'

const food = (name: string, source: 'taco' | 'custom' = 'taco') => ({ name, source })

describe('alimentos', () => {
  it('escala os macros por 100 g para a porção', () => {
    const arroz = { kcal: 128, protein_g: 2.5, carbs_g: 28.1, fat_g: 0.2 }
    expect(macrosFor(arroz, 150)).toEqual({ kcal: 192, protein_g: 3.8, carbs_g: 42.2, fat_g: 0.3 })
    expect(macrosFor(arroz, 0)).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
  })

  it('soma o dia, aceitando números que vêm do banco como texto', () => {
    const total = sumMacros([
      { kcal: 192, protein_g: 3.8, carbs_g: 42.2, fat_g: 0.3 },
      { kcal: '163' as unknown as number, protein_g: 31.5, carbs_g: 0, fat_g: 3.2 },
    ])
    expect(total).toEqual({ kcal: 355, protein_g: 35.3, carbs_g: 42.2, fat_g: 3.5 })
  })

  it('sugere a refeição pelo horário', () => {
    expect(mealForHour(7)).toBe('breakfast')
    expect(mealForHour(12)).toBe('lunch')
    expect(mealForHour(16)).toBe('snack')
    expect(mealForHour(21)).toBe('dinner')
  })

  it('normaliza acentos e pontuação', () => {
    expect(normalize('Pão, de queijo, assado')).toBe('pao de queijo assado')
  })

  it('busca por palavras em qualquer ordem e sem acento', () => {
    const foods = [food('Frango, peito, sem pele, grelhado'), food('Frango, coxa, com pele, assada'), food('Pão, trigo, francês'), food('Feijão, carioca, cozido')]
    expect(searchFoods(foods, 'frango grelhado').map(f => f.name)).toEqual(['Frango, peito, sem pele, grelhado', 'Frango, coxa, com pele, assada'])
    expect(searchFoods(foods, 'pao frances')).toHaveLength(1)
    expect(searchFoods(foods, 'feij')[0].name).toBe('Feijão, carioca, cozido')
    expect(searchFoods(foods, 'xyz')).toEqual([])
  })

  it('quando nenhum tem todas as palavras, mostra os mais parecidos', () => {
    const foods = [food('Arroz, tipo 1, cozido'), food('Arroz, integral, cozido'), food('Feijão, carioca, cozido'), food('Doce, de leite, cremoso')]
    expect(searchFoods(foods, 'arroz branco cozido').map(f => f.name)).toEqual(['Arroz, tipo 1, cozido', 'Arroz, integral, cozido'])
    expect(searchFoods(foods, 'frango cozido')).toEqual([])
    expect(searchFoods(foods, 'arroz integral').map(f => f.name)).toEqual(['Arroz, integral, cozido', 'Arroz, tipo 1, cozido'])
  })

  it('coloca os alimentos do usuário e os que começam com a busca primeiro', () => {
    const foods = [food('Leite, de vaca, integral'), food('Doce, de leite, cremoso'), food('Whey com leite', 'custom')]
    expect(searchFoods(foods, 'leite').map(f => f.name)).toEqual(['Whey com leite', 'Leite, de vaca, integral', 'Doce, de leite, cremoso'])
  })
})
