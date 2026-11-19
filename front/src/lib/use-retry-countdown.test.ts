import { describe, expect, it } from 'vitest'

import { formatWait } from './use-retry-countdown'

describe('formatWait', () => {
  it('en secondes sous une minute', () => {
    expect(formatWait(30)).toBe('30 s')
    expect(formatWait(1)).toBe('1 s')
  })

  it('en minutes et secondes au-delà', () => {
    expect(formatWait(900)).toBe('15 min 00 s')
    expect(formatWait(599)).toBe('9 min 59 s')
  })
})
