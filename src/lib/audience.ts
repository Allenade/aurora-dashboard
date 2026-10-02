import type { EmailAudience, EmailKind } from '@/queries/emails/interfaces/email.dto'
import type { Enrollment } from '@/queries/payments/interfaces/payment.dto'

export type SuppressionIndex = Map<string, string>

export function previewAudience(
  audience: EmailAudience,
  kind: EmailKind,
  enrollments: Enrollment[],
  suppressed: SuppressionIndex,
) {
  const excluded = { marketingOptOut: 0, suppressed: 0 }
  const seen = new Set<string>()
  let matched = 0
  const recipients: string[] = []

  const rows = enrollments.filter((row) => matchesFilter(audience, row))
  if (audience.kind !== 'explicit') matched = rows.length

  for (const row of rows) {
    if (audience.kind === 'explicit') {
      const ids = new Set(audience.enrollmentIds ?? [])
      const emails = new Set((audience.emails ?? []).map((email) => email.toLowerCase()))
      const refs = new Set(audience.references ?? [])
      const picked =
        ids.has(row.id) ||
        emails.has((row.email ?? '').toLowerCase()) ||
        (row.paystackReference != null && refs.has(row.paystackReference))
      if (!picked) continue
      matched += 1
    }
    const email = (row.email ?? '').toLowerCase()
    if (!email || seen.has(email)) continue
    const decision = includeRecipient(kind, row.marketingOptIn, suppressed.get(email))
    if (!decision.include) {
      if (decision.reason === 'marketing_opt_out') excluded.marketingOptOut += 1
      else excluded.suppressed += 1
      continue
    }
    seen.add(email)
    recipients.push(email)
  }

  if (audience.kind === 'explicit') {
    for (const email of audience.emails ?? []) {
      const normalised = email.trim().toLowerCase()
      if (!normalised || seen.has(normalised)) continue
      const decision = includeRecipient(kind, false, suppressed.get(normalised))
      if (!decision.include) {
        if (decision.reason === 'marketing_opt_out') excluded.marketingOptOut += 1
        else excluded.suppressed += 1
        continue
      }
      seen.add(normalised)
      recipients.push(normalised)
    }
  }

  return { matched, count: recipients.length, excluded, recipients }
}

function matchesFilter(audience: EmailAudience, row: Enrollment) {
  if (audience.kind === 'all' || audience.kind === 'explicit') {
    if (audience.kind === 'all') return extraFilters(audience, row)
    return true
  }
  return extraFilters(audience, row)
}

function extraFilters(audience: EmailAudience, row: Enrollment) {
  if (audience.tracks?.length && !audience.tracks.some((track) => row.tracks.includes(track))) {
    return false
  }
  if (
    audience.paymentStatuses?.length &&
    !audience.paymentStatuses.includes(row.paymentStatus)
  ) {
    return false
  }
  if (audience.marketingOptIn != null && row.marketingOptIn !== audience.marketingOptIn) {
    return false
  }
  if (audience.pendingHours != null) {
    const age = Date.now() - Date.parse(row.createdAt)
    if (row.paymentStatus !== 'pending' || age < audience.pendingHours * 60 * 60 * 1000) {
      return false
    }
  }
  if (audience.createdFrom && Date.parse(row.createdAt) < Date.parse(audience.createdFrom)) {
    return false
  }
  if (audience.createdTo && Date.parse(row.createdAt) > Date.parse(audience.createdTo)) {
    return false
  }
  return true
}

function includeRecipient(
  kind: EmailKind,
  marketingOptIn: boolean,
  suppression?: string,
) {
  if (suppression) return { include: false as const, reason: 'suppressed' as const }
  if (kind === 'marketing' && !marketingOptIn) {
    return { include: false as const, reason: 'marketing_opt_out' as const }
  }
  return { include: true as const }
}
