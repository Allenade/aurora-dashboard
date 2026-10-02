export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded'

export type ConfirmationSource = 'admin' | 'webhook' | 'poll'

export type PriceLine = {
  slug: string
  name: string
  price: number
  currency: string
  isFree: boolean
  enrollmentCutoff?: string | null
}

export type EnrollmentForm = {
  firstName: string
  lastName: string
  email: string
  phone?: string
  whatsapp?: string
  [key: string]: string | undefined
}

/** GET /admin/enter-first/enrollments item. */
export type Enrollment = {
  id: string
  source: 'enter_first'
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  tracks: string[]
  amount: number
  currency: string
  priceSnapshot: PriceLine[]
  paymentStatus: PaymentStatus
  paystackReference: string | null
  authorizationUrl: string | null
  paystackTransactionId: string | null
  paidAmount: number | null
  paidCurrency: string | null
  paystackChannel: string | null
  verifiedAt: string | null
  confirmationSource: ConfirmationSource | null
  amountMismatch: boolean
  currencyMismatch: boolean
  paidAt: string | null
  form: EnrollmentForm
  emailSentAt: string | null
  termsVersion: string | null
  privacyVersion: string | null
  consentAt: string | null
  marketingOptIn: boolean
  consentIp: string | null
  consentUserAgent: string | null
  ageConfirmed: boolean | null
  dateOfBirth: string | null
  isMinor: boolean | null
  guardianName: string | null
  guardianEmail: string | null
  guardianConsent: boolean | null
  guardianConsentAt: string | null
  anonymisedAt: string | null
  createdAt: string
  updatedAt: string
}

export type EnrollmentPage = {
  items: Enrollment[]
  total: number
  page: number
  limit: number
  pageCount: number
}
