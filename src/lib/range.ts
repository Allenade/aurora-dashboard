const DAY = 24 * 60 * 60 * 1000

/**
 * Last 30 UTC days, ending at the start of the next UTC day.
 * The same UTC day always returns the same from/to, so the overview query
 * key does not change on each render.
 */
export function last30Days(now = new Date()) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )
  const start = new Date(end.getTime() - 30 * DAY)
  return { from: start.toISOString(), to: end.toISOString() }
}
