import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type FoodKey } from './plan'
import { parseReview, PREFERENCE_FOODS, reviewContext, swapPreference, togglePreference } from './preferences'

const s = { ...DEFAULT_SETTINGS, likes: ['frango'] as FoodKey[], dislikes: ['ovo'] as FoodKey[] }
const targets = { kcal: 2200, protein_g: 150, carbs_g: 250, fat_g: 65 }

describe('preferências', () => {
  it('lista os alimentos da tabela do plano, sem o whey', () => {
    expect(PREFERENCE_FOODS.length).toBeGreaterThan(140)
    expect(PREFERENCE_FOODS).not.toContain('whey')
    expect(PREFERENCE_FOODS).toContain('crepioca')
  })

  it('marcar "quero" tira de "não quero" e vice-versa', () => {
    const a = togglePreference(s, 'ovo', 'likes')
    expect(a.likes).toEqual(['frango', 'ovo'])
    expect(a.dislikes).toEqual([])
    const b = togglePreference(a, 'frango', 'dislikes')
    expect(b.likes).toEqual(['ovo'])
    expect(b.dislikes).toEqual(['frango'])
    expect(togglePreference(b, 'frango', 'dislikes').dislikes).toEqual([])
  })

  it('manda para a IA o alimento, a pessoa e só alternativas permitidas', () => {
    const ctx = reviewContext('presunto', { settings: { ...s, noPork: false }, picks: {} }, targets, 'lose')
    expect(ctx.alimento.nome).toMatch(/Presunto/i)
    expect(ctx.alimento.caracteristicas.join()).toMatch(/sódio/)
    expect(ctx.ja_quer[0]).toMatch(/Frango/i)
    expect(Object.keys(ctx.alternativas)).not.toContain('ovo')
    expect(Object.keys(ctx.alternativas)).not.toContain('presunto')
  })

  it('confere a resposta da IA', () => {
    const r = parseReview({ veredito: 'atencao', motivo: ' Muito sódio. ', sugestoes: ['frango', 'picanha', 'ovo', 'frango', 'peru'] }, 'presunto', s, new Date('2026-11-03T12:00:00Z'))
    expect(r).toEqual({ verdict: 'attention', reason: 'Muito sódio.', suggestions: ['frango', 'peru'], at: '2026-11-03T12:00:00.000Z' })
    expect(parseReview({ veredito: 'ok', motivo: 'Ótimo.', sugestoes: ['peru'] }, 'frango', s)!.suggestions).toEqual([])
    expect(parseReview({ veredito: 'talvez', motivo: 'x' }, 'frango', s)).toBeNull()
    expect(parseReview(null, 'frango', s)).toBeNull()
  })

  it('trocar pela sugestão é escolha da pessoa e apaga a avaliação antiga', () => {
    const saved = { settings: { ...s, likes: ['presunto', 'frango'] as FoodKey[] }, picks: {}, reviews: { presunto: { verdict: 'attention' as const, reason: 'x', suggestions: ['peru' as FoodKey], at: '' } } }
    const next = swapPreference(saved, 'presunto', 'peru')
    expect(next.settings.likes).toEqual(['peru', 'frango'])
    expect(next.reviews).toEqual({})
    expect(swapPreference(saved, 'presunto', 'frango').settings.likes).toEqual(['frango'])
  })
})
