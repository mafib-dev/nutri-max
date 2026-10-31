import { describe, expect, it } from 'vitest'
import { stableKeys } from './motion'

describe('stableKeys', () => {
  it('mantém a chave dos outros itens quando um sai do meio', () => {
    const before = stableKeys(['a', 'b', 'c'], x => x)
    const after = stableKeys(['a', 'c'], x => x)
    expect(after).toEqual([before[0], before[2]])
  })
  it('diferencia o mesmo id repetido', () => {
    expect(stableKeys(['a', 'a'], x => x)).toEqual(['a#0', 'a#1'])
  })
})
