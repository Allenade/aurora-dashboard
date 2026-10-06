import { formatNaira, formatWat } from '@/lib/format'
import { programLabel } from '@/lib/program'
import type { ExportColumn } from '@/lib/table-export'

export type AgeFilter = 'all' | 'minor' | 'adult' | 'unknown'

export type RegistrantFilters = {
  track: string
  age: AgeFilter
  from: string
  to: string
}

export const EMPTY_REGISTRANT_FILTERS: RegistrantFilters = {
  track: '',
  age: 'all',
  from: '',
  to: '',
}

export type RegistrantRow = {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  program?: string | null
  tracks: string[]
  isMinor: boolean | null
  dateOfBirth: string | null
  amount: number
  currency: string
  paymentStatus: string
  paystackReference: string | null
  createdAt: string
}

export function ageBand(isMinor: boolean | null): Exclude<AgeFilter, 'all'> {
  if (isMinor === true) return 'minor'
  if (isMinor === false) return 'adult'
  return 'unknown'
}

export function ageLabel(isMinor: boolean | null) {
  if (isMinor === true) return 'Under 18'
  if (isMinor === false) return '18 or older'
  return 'Age unknown'
}

/** Calendar date in Lagos, YYYY-MM-DD. Empty when the timestamp is unusable. */
export function lagosDate(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function filterRegistrants<
  T extends Pick<RegistrantRow, 'tracks' | 'isMinor' | 'createdAt'>,
>(rows: T[], filters: RegistrantFilters) {
  return rows.filter((row) => {
    if (filters.track && !row.tracks.includes(filters.track)) return false
    if (filters.age !== 'all' && ageBand(row.isMinor) !== filters.age) return false
    if (filters.from || filters.to) {
      const day = lagosDate(row.createdAt)
      if (!day) return false
      if (filters.from && day < filters.from) return false
      if (filters.to && day > filters.to) return false
    }
    return true
  })
}

/** Course menu options from the courses API only. Enrollment slugs are not added. */
export function courseOptions(courses: Array<{ slug: string; name: string }>) {
  const names = new Map<string, string>()
  for (const course of courses) {
    const slug = course.slug?.trim()
    if (!slug || names.has(slug)) continue
    names.set(slug, course.name?.trim() || slug)
  }
  return [...names.entries()].sort((left, right) =>
    left[1].localeCompare(right[1], 'en'),
  )
}

export function registrantExportColumns(
  trackName: (slug: string) => string = (slug) => slug,
): ExportColumn<RegistrantRow>[] {
  return [
    {
      header: 'Student',
      value: (row) => `${row.firstName} ${row.lastName}`.trim(),
    },
    { header: 'Email', value: (row) => row.email ?? '' },
    { header: 'Phone', value: (row) => row.phone ?? '' },
    { header: 'Program', value: (row) => programLabel(row) },
    {
      header: 'Courses',
      value: (row) => row.tracks.map((slug) => trackName(slug)).join(', '),
    },
    { header: 'Age', value: (row) => ageLabel(row.isMinor) },
    { header: 'Date of birth', value: (row) => row.dateOfBirth ?? '' },
    { header: 'Amount', value: (row) => formatNaira(row.amount) },
    { header: 'Currency', value: (row) => row.currency },
    { header: 'Payment status', value: (row) => row.paymentStatus },
    { header: 'Reference', value: (row) => row.paystackReference ?? '' },
    { header: 'Created', value: (row) => formatWat(row.createdAt) },
  ]
}
