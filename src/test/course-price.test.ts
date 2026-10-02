import { describe, expect, it } from 'vitest'
import {
  coursePriceSet,
  formatCoursePrice,
  PRICE_REQUIRED_MESSAGE,
  publishBlockReason,
} from '@/lib/course-price'
import { maskEmail, maskName, maskPhone } from '@/lib/pii'
import { permissionsForRole, sessionUser } from '@/lib/roles'
import { allows, defineAbilityFor, isViewer, shouldMaskPii } from '@/lib/ability'
import { exceptionLabel } from '@/queries/compliance/interfaces/compliance.dto'

describe('course price', () => {
  it('treats a missing or zero price as unset unless the course is free', () => {
    expect(coursePriceSet({ price: null, isFree: false })).toBe(false)
    expect(coursePriceSet({ price: 0, isFree: false })).toBe(false)
    expect(coursePriceSet({ price: 0, isFree: true })).toBe(true)
    expect(coursePriceSet({ price: 60_000, isFree: false })).toBe(true)
    expect(formatCoursePrice({ price: null, isFree: false })).toBe('No price set')
    expect(formatCoursePrice({ price: 0, isFree: false })).toBe('No price set')
    expect(formatCoursePrice({ price: 45_000, isFree: false })).toBe('₦45,000')
    expect(formatCoursePrice({ price: 60_000, isFree: true })).toBe('Free')
  })

  it('requires a price only when a paid course is opened', () => {
    expect(publishBlockReason({ price: null, isFree: false, status: 'draft' })).toBeNull()
    expect(publishBlockReason({ price: null, isFree: false, status: 'closed' })).toBeNull()
    expect(publishBlockReason({ price: null, isFree: false, status: 'open' })).toBe(
      PRICE_REQUIRED_MESSAGE,
    )
    expect(publishBlockReason({ price: 0, isFree: true, status: 'open' })).toBeNull()
  })
})

describe('exception labels', () => {
  it('uses plain language for reconciliation reasons', () => {
    expect(exceptionLabel('paid_not_verified')).toBe('Paid but not verified')
    expect(exceptionLabel('amount_mismatch')).toBe('Amount does not match')
    expect(exceptionLabel('paid_no_email')).toBe('Paid with no email')
    expect(exceptionLabel('stale_pending')).toBe('Waiting on payment too long')
  })
})

describe('pii masks', () => {
  it('matches the backend masks', () => {
    expect(maskEmail('ada@example.com')).toBe('a***@example.com')
    expect(maskPhone('+2348012345678')).toBe('**********5678')
    expect(maskName('Ibrahim')).toBe('I***')
  })
})

describe('roles', () => {
  it('keeps course edits and settings on super admin, and masks viewers', () => {
    const viewer = sessionUser({
      id: '1',
      email: 'viewer@example.com',
      firstName: 'Tunde',
      lastName: 'Bello',
      role: 'compliance_viewer',
    })
    const manager = sessionUser({
      id: '2',
      email: 'manager@example.com',
      firstName: 'Ada',
      lastName: 'Okoye',
      role: 'compliance_manager',
    })
    const admin = sessionUser({
      id: '3',
      email: 'u.allen@example.com',
      firstName: 'Umunade',
      lastName: 'Allen',
      role: 'super_admin',
    })
    expect(allows(defineAbilityFor(viewer), 'update', 'enter_first')).toBe(false)
    expect(shouldMaskPii(viewer)).toBe(true)
    expect(allows(defineAbilityFor(manager), 'update', 'enter_first')).toBe(true)
    expect(allows(defineAbilityFor(manager), 'update', 'course')).toBe(false)
    expect(allows(defineAbilityFor(manager), 'manage', 'settings')).toBe(false)
    expect(allows(defineAbilityFor(manager), 'create', 'email')).toBe(true)
    expect(allows(defineAbilityFor(manager), 'update', 'email')).toBe(true)
    expect(allows(defineAbilityFor(manager), 'delete', 'email')).toBe(false)
    expect(shouldMaskPii(manager)).toBe(false)
    expect(isViewer(viewer)).toBe(true)
    expect(viewer.roles[0]?.slug).toBe('compliance_viewer')
    expect(viewer.roles[0]?.name).toBe('Compliance Viewer')
    expect(allows(defineAbilityFor(admin), 'update', 'course')).toBe(true)
    expect(allows(defineAbilityFor(admin), 'delete', 'email')).toBe(true)
    expect(allows(defineAbilityFor(admin), 'manage', 'settings')).toBe(true)
    expect(permissionsForRole('compliance_viewer').some((item) => item.action === 'update')).toBe(
      false,
    )
  })
})
