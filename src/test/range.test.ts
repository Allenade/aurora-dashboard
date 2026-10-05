import { describe, expect, it } from 'vitest'
import { last30Days } from '@/lib/range'

describe('last30Days', () => {
  it('covers the 30 UTC days up to the start of the next day', () => {
    const range = last30Days(new Date('2026-10-05T14:52:00.000Z'))
    expect(range).toEqual({
      from: '2026-09-06T00:00:00.000Z',
      to: '2026-10-06T00:00:00.000Z',
    })
  })

  it('stays the same for every call on that UTC day', () => {
    const morning = last30Days(new Date('2026-10-05T00:00:01.000Z'))
    const evening = last30Days(new Date('2026-10-05T23:59:59.000Z'))
    expect(evening).toEqual(morning)
  })
})

