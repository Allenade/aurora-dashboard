export type RefundStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'processed'
  | 'failed'

export type RefundRequest = {
  id: string
  enrollmentId: string
  amount: number
  currency: string
  reason: string
  status: RefundStatus
  requestedBy: string | null
  reviewedBy: string | null
  reviewNote: string | null
  paystackRefundId: string | null
  processedAt: string | null
  failureReason: string | null
  createdAt: string
}
