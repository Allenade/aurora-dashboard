import { describe, expect, it } from 'vitest'
import {
  auditActionLabel,
  auditDetails,
  auditLoadError,
  auditWho,
  parseAuditPage,
} from '@/lib/audit-log'
import { formatWat } from '@/lib/format'

const entry = {
  id: 'log-1',
  type: 'mutation',
  action: 'ADMIN_CHANGE',
  userId: 'user-1',
  resourceType: 'enrollment',
  resourceId: 'enr-1',
  decision: 'allow',
  reason: null,
  metadata: { method: 'POST', path: '/admin/refunds' },
  ip: '102.89.1.2',
  userAgent: 'Mozilla',
  requestId: 'req-9',
  createdAt: '2026-10-05T10:00:00.000Z',
}

describe('parseAuditPage', () => {
  it('reads a healthy audit page', () => {
    const page = parseAuditPage({
      items: [entry, { id: '', action: 'LOGIN' }, null, 'nope'],
      total: 1,
      page: 1,
      limit: 50,
      pageCount: 1,
    })
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({
      id: 'log-1',
      userId: 'user-1',
      ip: '102.89.1.2',
      requestId: 'req-9',
    })
    expect(auditWho(page.items[0])).toBe('user-1')
    expect(auditActionLabel(page.items[0].action)).toBe('Changed a record')
    expect(auditDetails(page.items[0])).toContain('102.89.1.2')
    expect(auditDetails(page.items[0])).toContain('/admin/refunds')
  })

  it('accepts a bare list and missing optional fields', () => {
    const page = parseAuditPage([
      {
        id: 'log-2',
        action: 'LOGIN',
        userId: null,
        metadata: null,
        createdAt: 'not-a-date',
      },
    ])
    expect(page.items[0]?.userId).toBeNull()
    expect(page.items[0]?.ip).toBeNull()
    expect(auditWho(page.items[0])).toBe('System')
    expect(auditDetails(page.items[0])).toBe('')
    expect(formatWat(page.items[0]?.createdAt)).toBe('-')
  })

  it('fails clearly when the payload is not a list', () => {
    expect(() => parseAuditPage({ ok: true })).toThrow(/not a list of entries/)
    expect(() => parseAuditPage(null)).toThrow(/not a list of entries/)
  })
})

describe('auditLoadError', () => {
  it('explains the missing audit_log columns', () => {
    const error = auditLoadError(new Error('column a.ip does not exist'))
    expect(error.message).toContain('audit_log')
    expect(error.message).toContain('user_agent')
  })

  it('keeps other errors as they are', () => {
    const error = new Error('Forbidden')
    expect(auditLoadError(error)).toBe(error)
  })
})
