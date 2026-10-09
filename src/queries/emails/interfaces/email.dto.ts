export type EmailKind = 'transactional' | 'marketing'

export type EmailAudience = {
  kind: 'all' | 'filter' | 'explicit'
  tracks?: string[]
  paymentStatuses?: Array<'pending' | 'success' | 'failed' | 'refunded'>
  pendingHours?: number
  cohort?: string
  createdFrom?: string
  createdTo?: string
  marketingOptIn?: boolean
  enrollmentIds?: string[]
  emails?: string[]
  references?: string[]
}

export type EmailTemplate = {
  id: string
  slug: string
  name: string
  subject: string
  html: string
  text: string
  kind: EmailKind
  createdAt: string
  updatedAt: string
}

export type CampaignStatus =
  'queued' | 'sending' | 'paused' | 'completed' | 'cancelled' | 'failed'

export type EmailCampaign = {
  id: string
  name: string
  templateId: string | null
  subject: string
  kind: EmailKind
  status: CampaignStatus
  audience: EmailAudience
  totalRecipients: number
  sentCount: number
  failedCount: number
  createdAt: string
}

export type MessageStatus =
  'queued' | 'sending' | 'delivered' | 'opened' | 'bounced' | 'failed' | 'complained'

export type EmailMessage = {
  id: string
  campaignId: string | null
  enrollmentId: string | null
  toEmail: string
  toName: string
  subject: string
  status: MessageStatus
  attempts: number
  resendId: string | null
  idempotencyKey: string
  lastError: string | null
  kind: EmailKind
  createdAt: string
}

export type AudiencePreview = {
  matched: number
  count: number
  excluded: { marketingOptOut: number; suppressed: number; duplicate: number }
}

export type EmailAttachment = {
  filename: string
  url: string
  contentType: string
}

export type Suppression = {
  id: string
  email: string
  reason: 'hard_bounce' | 'complaint' | 'unsubscribe'
  createdAt: string
}

export type RecipientPreview = {
  count: number
  notInSystem?: number
  sample: Array<{
    email: string
    name: string
    enrollmentId: string | null
    courses: string[]
  }>
}

export type CourseStudent = {
  enrollmentId: string
  name: string
  email: string
}

export type CourseStudents = {
  count: number
  items: CourseStudent[]
}

export type StudentSearchItem = {
  enrollmentId: string
  name: string
  email: string
  courses: string[]
}

export type EmailDraft = {
  id: string
  name: string
  subject: string
  html: string
  text: string
  kind: EmailKind
  selectors: string[]
  status: string
  scheduledAt: string | null
  createdAt: string
  updatedAt: string
}

export type SentEmail = {
  id: string
  name: string
  subject: string
  status: string
  totalRecipients: number
  sentCount: number
  failedCount: number
  createdAt: string
  hiddenAt?: string | null
}

export type SentRecipient = {
  id: string
  enrollmentId: string | null
  email: string
  name: string
  status: string
  attempts: number
  lastError: string | null
  resendId: string | null
  inSystem: boolean
}

export type SentEmailDetail = SentEmail & {
  html: string
  text: string
  selectors?: string[]
  recipients: SentRecipient[]
}

export type SaveEmailDraftBody = {
  name?: string
  subject: string
  html: string
  text?: string
  selectors: string[]
  kind?: EmailKind
}

export const PLACEHOLDERS = [
  '{{firstName}}',
  '{{lastName}}',
  '{{track}}',
  '{{amount}}',
  '{{reference}}',
  '{{cutoffDate}}',
  '{{payLink}}',
  '{{unsubscribeUrl}}',
] as const
