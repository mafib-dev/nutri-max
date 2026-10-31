import { describe, expect, it } from 'vitest'
import { aiContext, applyAiResult } from './planAi'
import { buildPlan, buildSlots, DEFAULT_SETTINGS } from './plan'

const targets = { kcal: 2400, protein_g: 160, carbs_g: 290, fat_g: 67 }
const saved = { settings: DEFAULT_SETTINGS, picks: {} }
const lunch = buildSlots(DEFAULT_SETTINGS).find(s => s.kind === 'lunch')!.key

describe('aiContext', () => {
  it('leva o cardápio com as opções válidas de cada refeição', () => {
    const ctx = aiContext(saved, buildPlan(targets, saved), targets, 'lose')
    const l = ctx.cardapio.find(m => m.slot === lunch)!
    expect(l.opcoes.protein).toContain('frango')
    expect(ctx.alimentos).not.toHaveProperty('whey')
  })
})

describe('applyAiResult', () => {
  it('aplica consulta, trocas e dicas válidas', () => {
    const { saved: next, discarded } = applyAiResult(
      saved,
      {
        resumo: 'Tirei o peixe e coloquei carne moída no almoço.',
        consulta: { noFish: true, lunchAt: 'restaurant', likes: ['carneMoida', 'banana'], whey: { scoops: 1, when: 'post' } },
        trocas: [{ slot: lunch, papel: 'protein', alimento: 'carneMoida' }],
        dicas: [{ titulo: 'Feira', texto: 'Compre frutas da estação.' }],
      },
      'Não acho peixe aqui',
      new Date('2026-10-29T12:00:00Z'),
    )
    expect(discarded).toBe(0)
    expect(next.settings.noFish).toBe(true)
    expect(next.settings.lunchAt).toBe('restaurant')
    expect(next.settings.whey.scoops).toBe(1)
    expect(next.picks[lunch].protein).toBe('carneMoida')
    expect(next.ai!.tips).toEqual([{ title: 'Feira', text: 'Compre frutas da estação.' }])
    expect(next.ai!.history[0]).toEqual({ at: '2026-10-29T12:00:00.000Z', request: 'Não acho peixe aqui', summary: 'Tirei o peixe e coloquei carne moída no almoço.' })
  })

  it('descarta alimento inventado, troca impossível e horário malformado', () => {
    const { saved: next, discarded } = applyAiResult(
      saved,
      {
        consulta: { likes: ['picanha', 'ovo'], wake: '7h', meals: 9 },
        trocas: [
          { slot: lunch, papel: 'protein', alimento: 'banana' },
          { slot: 'nao-existe', papel: 'carb', alimento: 'arroz' },
          { slot: lunch, papel: 'protein', alimento: 'whey' },
        ],
      },
      'x',
    )
    expect(discarded).toBe(6)
    expect(next.settings.likes).toEqual(['ovo'])
    expect(next.settings.wake).toBe('07:00')
    expect(next.settings.meals).toBe(5)
    expect(next.picks).toEqual({})
  })

  it('troca que a restrição nova proíbe não entra', () => {
    const { saved: next, discarded } = applyAiResult(saved, { consulta: { noFish: true }, trocas: [{ slot: lunch, papel: 'protein', alimento: 'merluza' }] }, 'x')
    expect(discarded).toBe(1)
    expect(next.picks[lunch]).toBeUndefined()
  })

  it('mudar o número de refeições zera as trocas antigas', () => {
    const before = { ...saved, picks: { [lunch]: { protein: 'patinho' as const } } }
    expect(applyAiResult(before, { consulta: { meals: 4 } }, 'x').saved.picks).toEqual({})
    expect(applyAiResult(before, { consulta: { cooking: 'little' } }, 'x').saved.picks[lunch].protein).toBe('patinho')
  })

  it('aguenta resposta vazia ou estranha', () => {
    for (const r of [null, 'texto', 42, {}, { consulta: 'x', trocas: 'y', dicas: [{}] }]) {
      const { saved: next } = applyAiResult(saved, r, 'x')
      expect(next.settings.meals).toBe(5)
      expect(next.ai!.summary).toBe('Plano ajustado.')
    }
  })

  it('"não como" vence "costumo ter" e o histórico guarda 10', () => {
    let s: ReturnType<typeof applyAiResult>['saved'] = saved
    for (let i = 0; i < 12; i++) s = applyAiResult(s, { consulta: { likes: ['ovo'], dislikes: ['ovo'] } }, `pedido ${i}`).saved
    expect(s.settings.likes).toEqual([])
    expect(s.ai!.history).toHaveLength(10)
    expect(s.ai!.history[0].request).toBe('pedido 11')
  })
})
