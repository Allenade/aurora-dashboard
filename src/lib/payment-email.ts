import { formatWat } from '@/lib/format'

export type PaymentEmailView =
  | { tone: 'sent'; text: string }
  | { tone: 'sending'; text: 'Sending' }
  | { tone: 'failed'; text: 'Failed'; reason: string }
  | { tone: 'none'; text: 'Not sent' }

export function paymentEmailView(row: {
  emailStatus?: string | null
  emailSentAt?: string | null
  emailError?: string | null
}): PaymentEmailView {
  const status = row.emailStatus ?? null
  if (status === 'failed') {
    return {
      tone: 'failed',
      text: 'Failed',
      reason: row.emailError?.trim() || 'The email did not send',
    }
  }
  if (status === 'sending' || status === 'pending') {
    return { tone: 'sending', text: 'Sending' }
  }
  if (status === 'sent' || (!status && row.emailSentAt)) {
    const date = row.emailSentAt ? formatWat(row.emailSentAt) : ''
    return { tone: 'sent', text: date && date !== '-' ? `Sent · ${date}` : 'Sent' }
  }
  return { tone: 'none', text: 'Not sent' }
}

export function paidEnrollment(row: { paymentStatus: string }) {
  return row.paymentStatus === 'success'
}
