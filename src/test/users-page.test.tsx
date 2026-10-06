import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AbilityProvider } from '@/components/ability'
import { sessionUser, type AppRole } from '@/lib/roles'
import type { AdminUser } from '@/queries/users/interfaces/user.dto'
import { Route } from '@/routes/_authenticated/compliance/users/index'

const { api } = vi.hoisted(() => ({
  api: vi.fn(),
}))

vi.mock('@/queries/api', () => ({
  api,
  ApiError: class ApiError extends Error {},
}))

const signedInId = 'user-1'

const self: AdminUser = {
  id: signedInId,
  name: 'Ada Okoye',
  email: 'ada@example.com',
  company: '—',
  type: 'admin',
  status: 'ACTIVE',
  initials: 'AO',
  orders: 0,
  totalSpent: '—',
  joined: 'Jan 1, 2026',
  joinedIso: '2026-01-01T00:00:00.000Z',
  verified: true,
}

const other: AdminUser = {
  id: 'user-2',
  name: 'Tunde Bello',
  email: 'tunde@example.com',
  company: 'Aurora',
  type: 'buyer',
  status: 'Suspended',
  initials: 'TB',
  orders: 1,
  totalSpent: '₦45,000',
  joined: 'Feb 2, 2026',
  joinedIso: '2026-02-02T00:00:00.000Z',
  verified: true,
}

function renderUsers(role: AppRole) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const user = sessionUser({
    id: signedInId,
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Okoye',
    role,
  })
  const Page = Route.options.component
  if (!Page) throw new Error('Users page is missing')
  return render(
    <QueryClientProvider client={client}>
      <AbilityProvider user={user}>
        <Page />
      </AbilityProvider>
    </QueryClientProvider>,
  )
}

describe('users page', () => {
  beforeEach(() => {
    api.mockReset()
    api.mockImplementation(async (request: { method: string; path: string }) => {
      if (request.method === 'GET' && request.path === '/users') return [self, other]
      return { ok: true }
    })
  })

  it('asks before a super admin deletes someone else', async () => {
    const user = userEvent.setup()
    renderUsers('super_admin')

    expect(
      await screen.findByRole('button', { name: 'Delete Tunde Bello' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete Ada Okoye' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('This is your account')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Tunde Bello' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this user?' })
    expect(
      within(dialog).getByText('Tunde Bello will be removed. This cannot be undone.'),
    ).toBeInTheDocument()
    expect(api).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELETE', path: '/admin/users/user-2' }),
    )

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(api).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/admin/users/user-2',
    })
  })

  it('hides user management from people who are not super admins', async () => {
    renderUsers('compliance_manager')
    expect(
      await screen.findByText('Only a super admin can manage users.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
  })
})
