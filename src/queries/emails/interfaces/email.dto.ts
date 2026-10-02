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
  | 'queued'
  | 'sending'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed'

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
  | 'queued'
  | 'sending'
  | 'delivered'
  | 'opened'
  | 'bounced'
  | 'failed'
  | 'complained'

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
