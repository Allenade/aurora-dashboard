import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AbilityProvider } from '@/components/ability'
import { sessionUser, type AppRole } from '@/lib/roles'
import type {
  AdminCourse,
  AdminCourseDetail,
} from '@/queries/courses/interfaces/course.dto'
import { Route } from '@/routes/_authenticated/compliance/courses/index'

const { api } = vi.hoisted(() => ({
  api: vi.fn(),
}))

vi.mock('@/queries/api', () => ({
  api,
  ApiError: class ApiError extends Error {},
}))

const openCourse: AdminCourse = {
  id: 'course-open',
  slug: 'robotics',
  name: 'Robotics',
  description: 'Build a robot',
  price: 45000,
  currency: 'NGN',
  isFree: false,
  seatCap: 20,
  seatsTaken: 4,
  seatsRemaining: 16,
  startDate: null,
  endDate: null,
  enrollmentCutoff: null,
  status: 'open',
  sortOrder: 0,
  cohort: null,
  enrollmentCount: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const closedCourse: AdminCourse = {
  ...openCourse,
  id: 'course-closed',
  slug: 'vision',
  name: 'Vision',
  status: 'pastCutoff' as AdminCourse['status'],
  enrollmentCount: 2,
}

const emptyCourse: AdminCourse = {
  ...openCourse,
  id: 'course-empty',
  slug: 'draft-lab',
  name: 'Draft lab',
  status: 'draft',
  enrollmentCount: 0,
  seatsTaken: 0,
}

function detail(course: AdminCourse): AdminCourseDetail {
  return { ...course, priceHistory: [] }
}

function renderCourses(role: AppRole) {
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
  if (!Page) throw new Error('Courses page is missing')
  return render(
    <QueryClientProvider client={client}>
      <AbilityProvider user={user}>
        <Page />
      </AbilityProvider>
    </QueryClientProvider>,
  )
}

describe('courses page', () => {
  beforeEach(() => {
    api.mockReset()
    api.mockImplementation(async (request: { method: string; path: string }) => {
      if (request.method === 'GET' && request.path === '/admin/courses') {
        return [openCourse, closedCourse, emptyCourse]
      }
      if (
        request.method === 'GET' &&
        request.path === `/admin/courses/${openCourse.id}`
      ) {
        return detail(openCourse)
      }
      if (
        request.method === 'GET' &&
        request.path === `/admin/courses/${closedCourse.id}`
      ) {
        return detail(closedCourse)
      }
      if (
        request.method === 'GET' &&
        request.path === `/admin/courses/${emptyCourse.id}`
      ) {
        return detail(emptyCourse)
      }
      return { ok: true }
    })
  })

  it('shows Delete for every course a super admin can delete, and Closed instead of past cutoff', async () => {
    const user = userEvent.setup()
    renderCourses('super_admin')

    expect(
      await screen.findByRole('button', { name: 'Delete Robotics' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Vision' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete all courses' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.queryByText(/past cutoff/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Robotics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this course?' })
    expect(
      within(dialog).getByText(
        'Robotics will be removed. People who paid will lose access, and their records for this course will be cleared. This cannot be undone.',
      ),
    ).toBeInTheDocument()
    expect(api).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        path: `/admin/courses/${openCourse.id}`,
      }),
    )

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(api).toHaveBeenCalledWith({
      method: 'DELETE',
      path: `/admin/courses/${openCourse.id}`,
    })
  })

  it('asks for a typed confirmation before deleting every course', async () => {
    const user = userEvent.setup()
    renderCourses('super_admin')
    await screen.findByRole('button', { name: 'Delete all courses' })

    await user.click(screen.getByRole('button', { name: 'Delete all courses' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete all courses?' })
    expect(
      within(dialog).getByText(
        'This deletes every course. People who paid will lose access, and those records will be cleared. This cannot be undone.',
      ),
    ).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Delete all courses' })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByRole('textbox'), 'delete all')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    expect(api).toHaveBeenCalledWith({
      method: 'POST',
      path: '/admin/courses/clear-all',
    })
  })

  it('hides delete controls from people who cannot delete courses', async () => {
    renderCourses('compliance_manager')
    expect(await screen.findByRole('cell', { name: 'Robotics' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
  })

  it('keeps Delete on the course details for an open course with enrollments', async () => {
    const user = userEvent.setup()
    renderCourses('super_admin')
    await user.click(await screen.findByRole('cell', { name: 'Robotics' }))
    const robotics = await screen.findByRole('dialog', { name: 'Robotics' })
    expect(within(robotics).getByRole('combobox')).toHaveValue('open')
    await user.click(within(robotics).getByRole('button', { name: 'Delete Robotics' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this course?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(api).toHaveBeenCalledWith({
      method: 'DELETE',
      path: `/admin/courses/${openCourse.id}`,
    })

    await user.click(within(robotics).getByRole('button', { name: 'Close' }))
    await user.click(await screen.findByRole('cell', { name: 'Vision' }))
    const vision = await screen.findByRole('dialog', { name: 'Vision' })
    expect(
      within(vision).getByRole('button', { name: 'Delete Vision' }),
    ).toBeInTheDocument()
    expect(within(vision).getByRole('combobox')).toHaveValue('closed')
  })

  it('keeps the shorter confirm when nobody has signed up', async () => {
    const user = userEvent.setup()
    renderCourses('super_admin')
    await user.click(await screen.findByRole('button', { name: 'Delete Draft lab' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this course?' })
    expect(
      within(dialog).getByText('Draft lab will be removed. This cannot be undone.'),
    ).toBeInTheDocument()
    expect(within(dialog).queryByText(/lose access/i)).not.toBeInTheDocument()
  })
})
