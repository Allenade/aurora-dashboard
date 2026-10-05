export type PageResult<T> = {
  items: T[]
  pageCount: number
}

/**
 * Walks a paged list API. Stops at the last page, or after maxPages so a bad
 * pageCount cannot keep requesting forever.
 */
export async function collectPages<T>(
  load: (page: number, limit: number) => Promise<PageResult<T>>,
  options: { limit?: number; maxPages?: number } = {},
) {
  const limit = options.limit ?? 100
  const maxPages = options.maxPages ?? 50
  const items: T[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await load(page, limit)
    items.push(...(Array.isArray(result.items) ? result.items : []))
    const pageCount =
      typeof result.pageCount === 'number' && result.pageCount > 0
        ? result.pageCount
        : page
    if (!result.items?.length || page >= pageCount) {
      return { items, truncated: false }
    }
    if (page === maxPages) return { items, truncated: true }
  }
  return { items, truncated: false }
}
