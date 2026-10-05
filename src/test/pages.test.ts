import { describe, expect, it } from 'vitest'
import { collectPages } from '@/lib/pages'

describe('collectPages', () => {
  it('stops on the last page', async () => {
    const calls: number[] = []
    const result = await collectPages(async (page) => {
      calls.push(page)
      return {
        items: page === 1 ? ['a', 'b'] : ['c'],
        pageCount: 2,
      }
    })
    expect(calls).toEqual([1, 2])
    expect(result).toEqual({ items: ['a', 'b', 'c'], truncated: false })
  })

  it('stops after the page cap and marks the list as cut off', async () => {
    const result = await collectPages(
      async (page) => ({ items: [`row-${page}`], pageCount: 10 }),
      { maxPages: 3 },
    )
    expect(result.items).toEqual(['row-1', 'row-2', 'row-3'])
    expect(result.truncated).toBe(true)
  })
})
