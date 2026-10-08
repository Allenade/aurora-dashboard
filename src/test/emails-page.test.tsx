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
const visionId = '44444444-4444-4444-8444-444444444444'
const adaId = '33333333-3333-4333-8333-333333333333'
const toluId = '55555555-5555-4555-8555-555555555555'
const bolaId = '66666666-6666-4666-8666-666666666666'

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

function course(id: string, slug: string, name: string) {
  return {
    id,
    slug,
    name,
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
  }
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
          return [course(courseId, 'robotics', 'Robotics'), course(visionId, 'vision', 'Computer vision')]
        }
        if (
          request.method === 'GET' &&
          request.path === `/admin/emails/courses/${courseId}/students`
        ) {
          return {
            count: 2,
            items: [
              { enrollmentId: adaId, name: 'Ada Okoye', email: 'ada@example.com' },
              { enrollmentId: toluId, name: 'Tolu Ade', email: 'tolu@example.com' },
            ],
          }
        }
        if (
          request.method === 'GET' &&
          request.path === `/admin/emails/courses/${visionId}/students`
        ) {
          return {
            count: 3,
            items: [
              { enrollmentId: bolaId, name: 'Bola Nwosu', email: 'bola@example.com' },
              {
                enrollmentId: '77777777-7777-4777-8777-777777777777',
                name: 'Chi Okonkwo',
                email: 'chi@example.com',
              },
              {
                enrollmentId: '88888888-8888-4888-8888-888888888888',
                name: 'Dayo Balogun',
                email: 'dayo@example.com',
              },
            ],
          }
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
                enrollmentId: adaId,
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

  it('adds a whole course or a few people from it', async () => {
    const user = userEvent.setup()
    renderEmails()
    await user.click(await screen.findByRole('button', { name: /Compose/ }))
    await user.click(await screen.findByRole('button', { name: '+ Add ▾' }))
    await user.click(screen.getByRole('button', { name: /Students in a course/ }))
    await user.click(await screen.findByRole('button', { name: /Robotics/ }))

    const search = await screen.findByRole('textbox', { name: 'Search in Robotics' })
    const everyone = screen.getByRole('checkbox', { name: /Everyone in Robotics \(2\)/ })
    expect(everyone).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Ada Okoye/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Tolu Ade/ })).not.toBeChecked()

    await user.type(search, 'tolu')
    expect(screen.queryByText('Ada Okoye')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Everyone in Robotics \(2\)/ })).toBeChecked()
    await user.clear(search)

    await user.click(screen.getByRole('button', { name: 'Add 2 people' }))
    expect(await screen.findByText('Robotics (all 2)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Add ▾' }))
    await user.click(screen.getByRole('button', { name: /Students in a course/ }))
    await user.click(await screen.findByRole('button', { name: /Computer vision/ }))
    await user.click(
      await screen.findByRole('checkbox', { name: /Everyone in Computer vision \(3\)/ }),
    )
    await user.click(screen.getByRole('checkbox', { name: /Bola Nwosu/ }))
    await user.click(screen.getByRole('checkbox', { name: /Chi Okonkwo/ }))
    await user.click(screen.getByRole('button', { name: 'Add 2 people' }))

    expect(screen.getByText('Robotics (all 2)')).toBeInTheDocument()
    expect(screen.getByText('Bola Nwosu')).toBeInTheDocument()
    expect(screen.getByText('Chi Okonkwo')).toBeInTheDocument()
    expect(screen.queryByText('Dayo Balogun')).not.toBeInTheDocument()
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
