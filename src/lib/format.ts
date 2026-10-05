export function formatNaira(amount: number, digits = 0) {
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
  return `₦${formatted}`
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('en-NG').format(value)
}

export function formatWat(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  },
) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    ...options,
  }).format(date)
}

export function formatWatTime(iso: string | null | undefined) {
  return formatWat(iso, { hour: '2-digit', minute: '2-digit' })
}

export function formatWatDate(iso: string | null | undefined) {
  return formatWat(iso, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`
}

export function signedPoints(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value} pts`
}

export function signedPercent(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase()
}

export function shortName(firstName: string, lastName: string) {
  const initial = lastName.slice(0, 1)
  return initial ? `${firstName} ${initial}.` : firstName
}
