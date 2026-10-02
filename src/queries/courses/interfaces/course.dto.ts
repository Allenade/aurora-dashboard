export type CourseStatus = 'draft' | 'open' | 'closed' | 'archived'

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
}

export type UpdateCourseBody = Partial<Omit<UpsertCourseBody, 'slug'>>
