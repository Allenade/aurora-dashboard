import { describe, expect, it } from 'vitest'
import { rangeToQuery } from '@/lib/range'

describe('rangeToQuery', () => {
  it('returns the same window for calls within the same minute', () => {
    const first = rangeToQuery('30d', new Date('2026-10-02T20:15:05.120Z'))
    const second = rangeToQuery('30d', new Date('2026-10-02T20:15:48.900Z'))
    expect(second).toEqual(first)
    expect(first.to).toBe('2026-10-02T20:16:00.000Z')
  })

  it('covers the requested number of days', () => {
    const range = rangeToQuery('7d', new Date('2026-10-02T20:15:00.000Z'))
    expect(range.from).toBe('2026-09-25T20:15:00.000Z')
    expect(range.to).toBe('2026-10-02T20:15:00.000Z')
  })

  it('starts the year to date window on 1 January UTC', () => {
    const range = rangeToQuery('ytd', new Date('2026-10-02T20:15:00.000Z'))
    expect(range.from).toBe('2026-01-01T00:00:00.000Z')
  })
})
