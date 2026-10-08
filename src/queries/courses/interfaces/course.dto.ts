export type CourseStatus = 'draft' | 'open' | 'closed' | 'archived'

/** Optional picture and syllabus. Both stay empty until an admin adds them. */
export type CourseSyllabus = {
  url: string | null
  filename: string | null
  text: string | null
}

export type CoursePriceHistoryEntry = {
  id: string
  changedBy: string | null
  oldPrice: number | null
  newPrice: number | null
  oldCurrency: string | null
  newCurrency: string
  effectiveFrom: string
  createdAt: string
}

/** Admin course from listAdminCourses / toAdminDto. price is null when unset. */
export type AdminCourse = {
  id: string
  slug: string
  name: string
  description: string
  price: number | null
  currency: string
  isFree: boolean
  seatCap: number | null
  seatsTaken: number
  seatsRemaining: number | null
  startDate: string | null
  endDate: string | null
  enrollmentCutoff: string | null
  status: CourseStatus
  sortOrder: number
  cohort: string | null
  enrollmentCount: number
  createdAt: string
  updatedAt: string
  /** Public picture URL, or null when the course has no picture. */
  imageUrl: string | null
  syllabus: CourseSyllabus
  /** Message students get after they pay. Empty when there isn't one. */
  afterPaymentEmail?: string | null
}

export type AdminCourseDetail = AdminCourse & {
  priceHistory: CoursePriceHistoryEntry[]
}

export type UpsertCourseBody = {
  slug: string
  name: string
  description?: string
  price?: number | null
  currency?: string
  isFree?: boolean
  seatCap?: number | null
  startDate?: string | null
  endDate?: string | null
  enrollmentCutoff?: string | null
  status?: CourseStatus
  sortOrder?: number
  cohort?: string | null
  afterPaymentEmail?: string | null
}

export type UpdateCourseBody = Partial<Omit<UpsertCourseBody, 'slug'>>
