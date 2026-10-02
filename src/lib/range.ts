export type RangeKey = '7d' | '30d' | '90d' | 'ytd'

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

/**
 * The end of the window is rounded up to the next minute, so the same range
 * gives the same query key for a minute and cached data can be reused.
 */
export function rangeToQuery(key: RangeKey, now = new Date()) {
  const end = new Date(Math.ceil(now.getTime() / MINUTE) * MINUTE)
  const to = end.toISOString()
  if (key === 'ytd') {
    const start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1))
    return { from: start.toISOString(), to }
  }
  const days = key === '7d' ? 7 : key === '90d' ? 90 : 30
  return { from: new Date(end.getTime() - days * DAY).toISOString(), to }
}
