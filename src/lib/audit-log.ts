import type { AuditLog, AuditPage } from '@/queries/audit/interfaces/audit.dto'

const TYPE_LABELS: Record<string, string> = {
  access: 'Sign-in or view',
  mutation: 'Change',
  payment: 'Payment',
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Signed in',
  LOGIN_DENIED: 'Sign-in denied',
  LOGOUT: 'Signed out',
  REFRESH: 'Refreshed a session',
  OTP_REQUEST: 'Requested a code',
  ACCESS_DENIED: 'Access denied',
  PASSWORD_CHANGE: 'Changed a password',
  PAYMENT_CREATED: 'Payment started',
  PAYMENT_SUCCESS: 'Payment succeeded',
  PAYMENT_FAILED: 'Payment failed',
  PAYMENT_REFUNDED: 'Payment refunded',
  PAYMENT_CANCELLED: 'Payment cancelled',
  ADMIN_CHANGE: 'Changed a record',
  ADMIN_VIEW: 'Viewed a page',
}

export function auditTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? (type || '-')
}

export function auditActionLabel(action: string) {
  return ACTION_LABELS[action] ?? (action || '-')
}

export function auditDecisionLabel(decision: string | null) {
  if (decision === 'allow') return 'Allowed'
  if (decision === 'deny') return 'Denied'
  return decision?.trim() || ''
}

export function auditWho(row: Pick<AuditLog, 'userId'>) {
  const id = row.userId?.trim()
  return id || 'System'
}

export function auditResource(row: Pick<AuditLog, 'resourceType' | 'resourceId'>) {
  const type = row.resourceType?.trim()
  const id = row.resourceId?.trim()
  if (type && id) return `${type} ${id}`
  return type || id || '-'
}

export function auditDetails(row: AuditLog) {
  const parts: string[] = []
  const decision = auditDecisionLabel(row.decision)
  if (decision) parts.push(decision)
  if (row.reason?.trim()) parts.push(row.reason.trim())
  if (row.ip?.trim()) parts.push(row.ip.trim())
  if (row.userAgent?.trim()) parts.push(row.userAgent.trim())
  if (row.requestId?.trim()) parts.push(row.requestId.trim())
  if (row.metadata && Object.keys(row.metadata).length > 0) {
    try {
      parts.push(JSON.stringify(row.metadata))
    } catch {
      parts.push('Metadata could not be shown')
    }
  }
  return parts.join(' · ')
}

export function auditLoadError(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'The audit log could not be loaded.'
  if (
    /\b(ip|user_agent|request_id)\b/i.test(message) &&
    /does not exist/i.test(message)
  ) {
    return new Error(
      'The audit log could not be read. The database is missing ip, user_agent, or request_id on audit_log. Apply the audit log columns migration, then reload this page.',
    )
  }
  return error instanceof Error ? error : new Error(message)
}

export function parseAuditPage(payload: unknown): AuditPage {
  if (Array.isArray(payload)) {
    const items = payload
      .map(parseAuditLog)
      .filter((row): row is AuditLog => row !== null)
    return pageFrom(items, {
      total: items.length,
      page: 1,
      limit: items.length || 1,
      pageCount: 1,
    })
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { items?: unknown }).items)
  ) {
    throw new Error('The audit log response was not a list of entries.')
  }
  const body = payload as {
    items: unknown[]
    total?: unknown
    page?: unknown
    limit?: unknown
    pageCount?: unknown
  }
  const items = body.items
    .map(parseAuditLog)
    .filter((row): row is AuditLog => row !== null)
  return pageFrom(items, {
    total: numberOr(body.total, items.length),
    page: numberOr(body.page, 1),
    limit: numberOr(body.limit, items.length || 1),
    pageCount: Math.max(1, numberOr(body.pageCount, 1)),
  })
}

function pageFrom(
  items: AuditLog[],
  meta: { total: number; page: number; limit: number; pageCount: number },
): AuditPage {
  return { items, ...meta }
}

function parseAuditLog(raw: unknown): AuditLog | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const id = asString(row.id)
  const action = asString(row.action)
  if (!id || !action) return null
  return {
    id,
    type: asString(row.type) ?? '',
    action,
    userId: asString(row.userId),
    resourceType: asString(row.resourceType),
    resourceId: asString(row.resourceId),
    decision: asString(row.decision),
    reason: asString(row.reason),
    metadata: asMetadata(row.metadata),
    ip: asString(row.ip),
    userAgent: asString(row.userAgent),
    requestId: asString(row.requestId),
    createdAt: asString(row.createdAt) ?? '',
  }
}

function asString(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function asMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
