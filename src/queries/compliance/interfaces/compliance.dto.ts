export type StatusBucket = { count: number; amount: number }

export type ComplianceSummary = {
  from: string
  to: string
  countsByStatus: Record<string, StatusBucket>
  collected: number
  pendingOver24h: number
  exceptions: number
  consentPercent: number
  unknownAgeStudents: number
  seats: Array<{
    slug: string
    name: string
    status: string
    seatCap: number | null
    seatsTaken: number
  }>
}

export type TimelinePoint = {
  day: string
  created: number
  paid: number
  collected: number
}

export type ExceptionReason =
  | 'paid_not_verified'
  | 'amount_mismatch'
  | 'paid_no_email'
  | 'stale_pending'

export const EXCEPTION_LABEL: Record<ExceptionReason, string> = {
  paid_not_verified: 'Paid but not verified',
  amount_mismatch: 'Amount does not match',
  paid_no_email: 'Paid with no email',
  stale_pending: 'Waiting on payment too long',
}

export function exceptionLabel(reason: string) {
  if (reason in EXCEPTION_LABEL) return EXCEPTION_LABEL[reason as ExceptionReason]
  return reason
}

export type ComplianceException = {
  id: string
  reasons: string[]
  paymentStatus: string
  amount: number
  paidAmount: number | null
  currency: string
  paidCurrency: string | null
  email: string | null
  name: string
  reference: string | null
  createdAt: string
}

export type ComplianceTest = {
  id: string
  name: string
  pass: boolean
  detail: string
}

export type ComplianceTests = {
  pass: boolean
  checks: ComplianceTest[]
}

export type DataRequestType = 'access' | 'delete'
export type DataRequestStatus = 'open' | 'in_progress' | 'completed' | 'rejected'

export type DataRequest = {
  id: string
  type: DataRequestType
  subjectEmail: string
  enrollmentId: string | null
  status: DataRequestStatus
  dueDate: string
  notes: string | null
  completedAt: string | null
  createdAt: string
}

export type DataRequestExport = {
  request: DataRequest
  enrollments: Array<Record<string, unknown>>
}
