export type AuditLog = {
  id: string
  type: string
  action: string
  userId: string | null
  resourceType: string | null
  resourceId: string | null
  decision: string | null
  reason: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
  requestId: string | null
  createdAt: string
}

export type AuditPage = {
  items: AuditLog[]
  total: number
  page: number
  limit: number
  pageCount: number
}
