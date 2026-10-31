import { describe, expect, it } from 'vitest'
import { pdfFileName, pdfText, splitPortion } from './planPdf'

describe('planPdf', () => {
  it('separa gramas e medida caseira', () => {
    expect(splitPortion('150 g · 1 metade')).toEqual(['150 g', '1 metade'])
    expect(splitPortion('2 ovos')).toEqual(['2 ovos', ''])
  })
  it('troca símbolos que a fonte do PDF não tem e mantém acentos', () => {
    expect(pdfText('64,5 kg → 59 kg ≈ ação ½ × café')).toBe('64,5 kg -> 59 kg ~ ação ½ × café')
  })
  it('nomeia o arquivo com a data', () => {
    expect(pdfFileName(new Date(2026, 9, 31))).toBe('plano-alimentar-2026-10-31.pdf')
  })
})
