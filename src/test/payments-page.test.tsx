import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AbilityProvider } from '@/components/ability'
import { sessionUser, type AppRole } from '@/lib/roles'
import type { Enrollment } from '@/queries/payments/interfaces/payment.dto'
import { Route } from '@/routes/_authenticated/compliance/payments/index'

const { api } = vi.hoisted(() => ({
  api: vi.fn(),
}))

vi.mock('@/queries/api', () => ({
  api,
  ApiError: class ApiError extends Error {},
}))

function enrollment(overrides: Partial<Enrollment> & Pick<Enrollment, 'id'>): Enrollment {
  return {
    source: 'enter_first',
    firstName: 'Ada',
    lastName: 'Okoye',
    email: 'ada@example.com',
    phone: null,
    program: 'Core 3.0',
    tracks: ['robotics'],
    amount: 45000,
    currency: 'NGN',
    priceSnapshot: [],
    paymentStatus: 'success',
    paystackReference: 'PSK_ref_999',
    authorizationUrl: null,
    paystackTransactionId: 'txn_888',
    paidAmount: 45000,
    paidCurrency: 'NGN',
    paystackChannel: 'card',
    verifiedAt: '2026-03-01T10:00:00.000Z',
    confirmationSource: 'webhook',
    amountMismatch: false,
    currencyMismatch: false,
    paidAt: '2026-03-01T10:00:00.000Z',
    form: { firstName: 'Ada', lastName: 'Okoye', email: 'ada@example.com' },
    emailSentAt: null,
    termsVersion: null,
    privacyVersion: null,
    consentAt: null,
    marketingOptIn: false,
    consentIp: null,
    consentUserAgent: null,
    ageConfirmed: true,
    dateOfBirth: '2000-01-01',
    isMinor: false,
    guardianName: null,
    guardianEmail: null,
    guardianConsent: null,
    guardianConsentAt: null,
    anonymisedAt: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  }
}

const ada = enrollment({
  id: 'enr-ada',
  firstName: 'Ada',
  lastName: 'Okoye',
  email: 'ada@example.com',
  isMinor: false,
  paystackReference: 'PSK_ref_ada',
  paystackTransactionId: 'txn_ada',
})

const tunde = enrollment({
  id: 'enr-tunde',
  firstName: 'Tunde',
  lastName: 'Bello',
  email: 'tunde@example.com',
  isMinor: true,
  dateOfBirth: '2014-04-04',
  amount: 0,
  paidAmount: 0,
  paystackReference: 'PSK_ref_tunde',
  paystackTransactionId: 'txn_tunde',
  form: { firstName: 'Tunde', lastName: 'Bello', email: 'tunde@example.com' },
})

let rows: Enrollment[]

function pageOf(items: Enrollment[]) {
  return { items, total: items.length, page: 1, limit: 100, pageCount: 1 }
}

function renderPayments(role: AppRole) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const user = sessionUser({
    id: 'user-1',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Okoye',
    role,
  })
  const Page = Route.options.component
  if (!Page) throw new Error('Payments page is missing')
  return render(
    <QueryClientProvider client={client}>
      <AbilityProvider user={user}>
        <Page />
      </AbilityProvider>
    </QueryClientProvider>,
  )
}

describe('payments page', () => {
  beforeEach(() => {
    rows = [ada, tunde]
    api.mockReset()
    api.mockImplementation(async (request: { method: string; path: string }) => {
      if (request.method === 'GET' && request.path === '/admin/courses') return []
      if (request.method === 'GET' && request.path === '/admin/enter-first/enrollments') {
        return pageOf(rows)
      }
      if (request.method === 'DELETE' && request.path.startsWith('/admin/enter-first/enrollments/')) {
        const id = request.path.slice('/admin/enter-first/enrollments/'.length)
        rows = rows.filter((row) => row.id !== id)
        return { ok: true }
      }
      if (
        request.method === 'POST' &&
        request.path === '/admin/enter-first/enrollments/clear-all'
      ) {
        rows = []
        return { ok: true, deleted: 2 }
      }
      return { ok: true }
    })
  })

  it('asks before a super admin deletes one payment record, using the enrollment id', async () => {
    const user = userEvent.setup()
    renderPayments('super_admin')

    expect(await screen.findByRole('button', { name: 'Delete Ada Okoye' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Tunde Bello' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete all' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Ada Okoye' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this payment record?' })
    expect(
      within(dialog).getByText('This cannot be undone. It will not refund them.'),
    ).toBeInTheDocument()
    expect(api).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(api).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/admin/enter-first/enrollments/enr-ada',
      }),
    )

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(api).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/admin/enter-first/enrollments/enr-ada',
    })
    expect(api).not.toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining('PSK_ref_ada'),
      }),
    )
    expect(api).not.toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining('txn_ada'),
      }),
    )

    await waitFor(() => {
      expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument()
    })
    expect(screen.getByText('tunde@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excel' })).toBeEnabled()
  })

  it('asks for a typed confirmation before deleting every payment record', async () => {
    const user = userEvent.setup()
    renderPayments('super_admin')
    await screen.findByRole('button', { name: 'Delete all' })

    await user.click(screen.getByRole('button', { name: 'Delete all' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete all payment records?' })
    expect(
      within(dialog).getByText(
        'This removes every payment record. It will not refund anyone.',
      ),
    ).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Delete all' })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByRole('textbox'), 'delete all')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    expect(api).toHaveBeenCalledWith({
      method: 'POST',
      path: '/admin/enter-first/enrollments/clear-all',
    })
    await waitFor(() => {
      expect(screen.getByText('No enrollments in Core 3.0 yet')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Delete all' })).not.toBeInTheDocument()
  })

  it('hides delete controls from other roles and still filters the list', async () => {
    const user = userEvent.setup()
    renderPayments('compliance_manager')

    expect(await screen.findByText('ada@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Age' }), 'minor')
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument()
    expect(screen.getByText('tunde@example.com')).toBeInTheDocument()
    expect(screen.queryByText('No enrollments match these filters')).not.toBeInTheDocument()
  })

  it('hides delete controls from a compliance viewer', async () => {
    renderPayments('compliance_viewer')
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})
