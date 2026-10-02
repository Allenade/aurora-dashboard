import { formatNaira } from '@/lib/format'

export const PRICE_REQUIRED_MESSAGE =
  'Set a price or mark the course free before opening it'

export type PriceFields = {
  price: number | null
  isFree: boolean
}

export type PublishFields = PriceFields & {
  status: string
}

/** A course is priced when it is free, or when a positive amount is stored. */
export function coursePriceSet(course: PriceFields) {
  if (course.isFree) return true
  return course.price != null && course.price > 0
}

/** A paid course needs a price only when it is opened. Closed courses may stay unpriced. */
export function publishBlockReason(course: PublishFields) {
  if (course.status !== 'open') return null
  if (coursePriceSet(course)) return null
  return PRICE_REQUIRED_MESSAGE
}

export function formatCoursePrice(course: PriceFields) {
  if (course.isFree) return 'Free'
  if (!coursePriceSet(course)) return 'No price set'
  return formatNaira(course.price ?? 0)
}
