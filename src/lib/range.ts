export type RangeKey = '7d' | '30d' | '90d' | 'ytd'

const DAY = 24 * 60 * 60 * 1000

export function rangeToQuery(key: RangeKey, now = new Date()) {
  const to = now.toISOString()
  if (key === 'ytd') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    return { from: start.toISOString(), to }
  }
  const days = key === '7d' ? 7 : key === '90d' ? 90 : 30
  return { from: new Date(now.getTime() - days * DAY).toISOString(), to }
}
