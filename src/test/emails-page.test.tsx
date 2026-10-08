import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AbilityProvider } from '@/components/ability'
import { sessionUser } from '@/lib/roles'
import type {
  EmailDraft,
  SentEmail,
  SentEmailDetail,
} from '@/queries/emails/interfaces/email.dto'
import { Route } from '@/routes/_authenticated/compliance/emails/index'

const { api } = vi.hoisted(() => ({
  api: vi.fn(),
}))

vi.mock('@/queries/api', () => ({
  api,
  ApiError: class ApiError extends Error {},
}))

const courseId = '11111111-1111-4111-8111-111111111111'

const sent: SentEmail = {
  id: 'sent-1',
  name: 'All paid students',
  subject: 'You are in',
  status: 'completed',
  totalRecipients: 50,
  sentCount: 48,
  failedCount: 2,
  createdAt: '2026-10-08T09:00:00.000Z',
}

const draft: EmailDraft = {
  id: 'draft-1',
  name: 'Robotics',
  subject: 'See you Monday',
  html: '<p>Bring a notebook.</p>',
  text: 'Bring a notebook.',
  kind: 'transactional',
  selectors: [`course:${courseId}`],
  status: 'draft',
  scheduledAt: null,
  createdAt: '2026-10-07T09:00:00.000Z',
  updatedAt: '2026-10-07T09:00:00.000Z',
}

const scheduled: EmailDraft = {
  ...draft,
  id: 'sched-1',
  name: 'Ages 18+',
  subject: 'Tomorrow',
  status: 'scheduled',
  selectors: ['ageGroup:18+'],
  scheduledAt: '2026-10-09T09:00:00.000Z',
  html: '<p>We start tomorrow.</p>',
  text: 'We start tomorrow.',
}

const detail: SentEmailDetail = {
  ...sent,
  html: '<p>Welcome to class.</p>',
  text: 'Welcome to class.',
  selectors: ['allPaid'],
  recipients: [
    {
      id: 'msg-1',
      enrollmentId: 'enr-1',
      email: 'ada@example.com',
      name: 'Ada Okoye',
      status: 'delivered',
      attempts: 1,
      lastError: null,
      resendId: null,
    },
    {
      id: 'msg-2',
      enrollmentId: 'enr-2',
      email: 'tunde@example.com',
      name: 'Tunde Bello',
      status: 'failed',
      attempts: 2,
      lastError: 'Mailbox full',
      resendId: null,
    },
  ],
}

function renderEmails() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const user = sessionUser({
    id: 'user-1',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Okoye',
    role: 'super_admin',
  })
  const Page = Route.options.component
  if (!Page) throw new Error('Emails page is missing')
  return render(
    <QueryClientProvider client={client}>
      <AbilityProvider user={user}>
        <Page />
      </AbilityProvider>
    </QueryClientProvider>,
  )
}

describe('emails page', () => {
  beforeEach(() => {
    api.mockReset()
    api.mockImplementation(
      async (request: {
        method: string
        path: string
        body?: { selectors?: string[] }
      }) => {
        if (request.method === 'GET' && request.path === '/admin/emails/sent')
          return [sent]
        if (request.method === 'GET' && request.path === '/admin/emails/drafts')
          return [draft, scheduled]
        if (request.method === 'GET' && request.path === '/admin/courses') {
          return [
            {
              id: courseId,
              slug: 'robotics',
              name: 'Robotics',
              description: '',
              price: 1000,
              currency: 'NGN',
              isFree: false,
              seatCap: null,
              seatsTaken: 4,
              seatsRemaining: null,
              startDate: null,
              endDate: null,
              enrollmentCutoff: null,
              status: 'open',
              sortOrder: 0,
              cohort: null,
              enrollmentCount: 4,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              imageUrl: null,
              syllabus: { url: null, filename: null, text: null },
            },
          ]
        }
        if (request.method === 'GET' && request.path === '/admin/emails/sent/sent-1')
          return detail
        if (
          request.method === 'POST' &&
          request.path === '/admin/emails/recipients/preview'
        ) {
          const selectors = request.body?.selectors ?? []
          return { count: selectors.includes('allPaid') ? 48 : 4, sample: [] }
        }
        if (
          request.method === 'GET' &&
          request.path === '/admin/emails/students/search'
        ) {
          return {
            items: [
              {
                enrollmentId: '33333333-3333-4333-8333-333333333333',
                name: 'Ada Okoye',
                email: 'ada@example.com',
                courses: ['Robotics'],
              },
            ],
          }
        }
        return { ok: true }
      },
    )
  })

  it('lists sent mail, then opens compose with who to add', async () => {
    const user = userEvent.setup()
    renderEmails()

    expect(await screen.findByRole('button', { name: /Compose/ })).toBeInTheDocument()
    expect(await screen.findByText('All paid students')).toBeInTheDocument()
    expect(screen.getByText('48 sent')).toBeInTheDocument()
    expect(screen.getByText(/2 failed/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Drafts/ }))
    expect(await screen.findByText('See you Monday')).toBeInTheDocument()
    expect(screen.getByText(/Bring a notebook/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Scheduled/ }))
    expect(await screen.findByText('Tomorrow')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Compose/ }))
    expect(await screen.findByRole('dialog', { name: 'New email' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Add ▾' }))
    expect(
      await screen.findByRole('button', { name: /All paid students/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Students in a course/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /An age group/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /One student/ })).toBeInTheDocument()
  })

  it('opens a sent email and shows who received it', async () => {
    const user = userEvent.setup()
    renderEmails()
    await user.click(await screen.findByRole('button', { name: /You are in/ }))
    expect(await screen.findByText('Who got it')).toBeInTheDocument()
    expect(screen.getByText('✓ Sent')).toBeInTheDocument()
    expect(screen.getByText('✗ Failed')).toHaveAttribute('title', 'Mailbox full')
    expect(
      screen.getByRole('button', { name: 'Resend to failed (1)' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/To: All paid students \(50\)/)).toBeInTheDocument()
  })
})
