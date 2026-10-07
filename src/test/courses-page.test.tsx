import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  imageUrl: null,
  syllabus: { url: null, filename: null, text: null },
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
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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

  it('shows a small picture beside a course that has one', async () => {
    api.mockImplementation(async (request: { method: string; path: string }) => {
      if (request.method === 'GET' && request.path === '/admin/courses') {
        return [
          { ...openCourse, imageUrl: 'https://cdn.example/robotics.jpg' },
          closedCourse,
        ]
      }
      return { ok: true }
    })
    renderCourses('super_admin')
    const robotics = await screen.findByRole('cell', { name: 'Robotics' })
    expect(robotics.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example/robotics.jpg',
    )
    expect(screen.getByRole('cell', { name: 'Vision' }).querySelector('img')).toBeNull()
  })

  it('uploads, replaces, and removes a course picture', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const file = init?.body instanceof FormData ? init.body.get('file') : null
      const name = file instanceof File ? file.name : 'robotics.jpg'
      return jsonResponse(200, {
        ...detail(openCourse),
        imageUrl: `https://cdn.example/${name}`,
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    renderCourses('super_admin')
    await user.click(await screen.findByRole('cell', { name: 'Robotics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Robotics' })
    expect(
      within(dialog).getByRole('heading', { name: 'Course picture' }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('No picture yet.')).toBeInTheDocument()

    const first = new File([new Uint8Array([1, 2, 3])], 'robotics.jpg', {
      type: 'image/jpeg',
    })
    await user.upload(within(dialog).getByLabelText('Course picture file'), first)
    expect(
      await within(dialog).findByRole('img', { name: 'Robotics picture' }),
    ).toHaveAttribute('src', 'https://cdn.example/robotics.jpg')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bff/admin/courses/course-open/image',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    const sent = fetchMock.mock.calls[0]?.[1]?.body
    expect(sent).toBeInstanceOf(FormData)
    expect((sent as FormData).get('file')).toBeInstanceOf(File)

    const replacement = new File([new Uint8Array([4])], 'cover.png', {
      type: 'image/png',
    })
    await user.upload(within(dialog).getByLabelText('Course picture file'), replacement)
    expect(
      await within(dialog).findByRole('img', { name: 'Robotics picture' }),
    ).toHaveAttribute('src', 'https://cdn.example/cover.png')
    expect(within(dialog).getByRole('button', { name: 'Replace' })).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', { name: 'Remove course picture' }),
    )
    expect(api).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/admin/courses/course-open/image',
    })
    expect(await within(dialog).findByText('No picture yet.')).toBeInTheDocument()
  })

  it('explains when picture storage is not set up and refuses a bad file', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () =>
      jsonResponse(503, {
        statusCode: 503,
        message: 'Cloudflare R2 storage is not configured.',
        error: 'Service Unavailable',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderCourses('super_admin')
    await user.click(await screen.findByRole('cell', { name: 'Robotics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Robotics' })

    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', {
      type: 'image/jpeg',
    })
    await user.upload(within(dialog).getByLabelText('Course picture file'), big)
    expect(
      within(dialog).getByText('Pictures must be 5 MB or smaller.'),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    const jpeg = new File([new Uint8Array([1, 2, 3])], 'robotics.jpg', {
      type: 'image/jpeg',
    })
    await user.upload(within(dialog).getByLabelText('Course picture file'), jpeg)
    expect(
      await within(dialog).findByText("Image upload isn't set up yet"),
    ).toBeInTheDocument()
  })

  it('uploads a syllabus PDF, shows its file name, and saves week-by-week topics', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        ...detail(openCourse),
        syllabus: {
          url: 'https://cdn.example/week.pdf',
          filename: 'Week plan.pdf',
          text: null,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderCourses('super_admin')
    await user.click(await screen.findByRole('cell', { name: 'Robotics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Robotics' })
    expect(within(dialog).getByText('No syllabus file yet.')).toBeInTheDocument()

    const pdf = new File(['%PDF-1.4'], 'Week plan.pdf', { type: 'application/pdf' })
    await user.upload(within(dialog).getByLabelText('Syllabus PDF file'), pdf)
    const link = await within(dialog).findByRole('link', { name: 'Week plan.pdf' })
    expect(link).toHaveAttribute('href', 'https://cdn.example/week.pdf')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bff/admin/courses/course-open/syllabus',
      expect.objectContaining({ method: 'POST' }),
    )

    await user.click(
      within(dialog).getByRole('button', { name: 'Remove syllabus file' }),
    )
    expect(api).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/admin/courses/course-open/syllabus/file',
    })

    expect(within(dialog).getByRole('textbox', { name: 'Description' }).tagName).toBe(
      'TEXTAREA',
    )
    const topics = within(dialog).getByRole('textbox', { name: 'Week-by-week topics' })
    expect(topics.tagName).toBe('TEXTAREA')
    fireEvent.change(topics, { target: { value: 'Week 1:\nSensors\nBoards' } })
    expect(topics).toHaveValue('Week 1:\nSensors\nBoards')
    const preview = within(dialog).getByLabelText('Syllabus preview')
    expect(within(preview).getByRole('heading', { name: 'Week 1:' })).toBeInTheDocument()
    expect(within(preview).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Sensors',
      'Boards',
    ])
    await user.click(
      within(dialog).getByRole('button', { name: 'Save week-by-week topics' }),
    )
    expect(api).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/admin/courses/course-open/syllabus/text',
      body: {
        text: '<h2>Week 1:</h2><ul><li>Sensors</li><li>Boards</li></ul>',
      },
    })

    await user.clear(topics)
    await user.click(
      within(dialog).getByRole('button', { name: 'Save week-by-week topics' }),
    )
    expect(api).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/admin/courses/course-open/syllabus/text',
      body: { text: null },
    })
  })

  it('loads saved syllabus html as one topic per line', async () => {
    const user = userEvent.setup()
    api.mockImplementation(async (request: { method: string; path: string }) => {
      if (request.method === 'GET' && request.path === '/admin/courses')
        return [openCourse]
      if (
        request.method === 'GET' &&
        request.path === `/admin/courses/${openCourse.id}`
      ) {
        return {
          ...detail(openCourse),
          description: 'Line one\n- Boards\n- Sensors',
          syllabus: {
            url: null,
            filename: null,
            text: '<h2>Week 1:</h2><ul><li>Sensors</li><li>Boards</li></ul><ul><li>Show and tell</li></ul>',
          },
        }
      }
      return { ok: true }
    })
    renderCourses('super_admin')
    await user.click(await screen.findByRole('cell', { name: 'Robotics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Robotics' })
    expect(within(dialog).getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Line one\n- Boards\n- Sensors',
    )
    expect(
      within(dialog).getByRole('textbox', { name: 'Week-by-week topics' }),
    ).toHaveValue('Week 1:\nSensors\nBoards\n\nShow and tell')
    const preview = within(dialog).getByLabelText('Syllabus preview')
    expect(
      within(preview).getByRole('heading', { name: 'Week 1:' }),
    ).toBeInTheDocument()
    expect(within(preview).getAllByRole('list')).toHaveLength(2)
  })

  it('adds a picture and a syllabus only after the course is created', async () => {
    const user = userEvent.setup()
    const created = {
      ...emptyCourse,
      id: 'course-new',
      slug: 'new-lab',
      name: 'New lab',
    }
    api.mockImplementation(async (request: { method: string; path: string }) => {
      if (request.method === 'GET' && request.path === '/admin/courses') return []
      if (request.method === 'POST' && request.path === '/admin/courses') return created
      return { ok: true }
    })
    renderCourses('super_admin')
    await user.click(await screen.findByRole('button', { name: 'New course' }))
    const sheet = await screen.findByRole('dialog', { name: 'New course' })
    expect(
      within(sheet).getByRole('heading', { name: 'Course picture' }),
    ).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'Syllabus' })).toBeInTheDocument()
    expect(
      within(sheet).getByText('You can add a picture after the course is created.'),
    ).toBeInTheDocument()
    expect(
      within(sheet).queryByLabelText('Course picture file'),
    ).not.toBeInTheDocument()

    await user.type(within(sheet).getByLabelText('Slug'), 'new-lab')
    await user.type(within(sheet).getByLabelText('Name'), 'New lab')
    await user.click(within(sheet).getByRole('button', { name: 'Create draft' }))

    const ready = await screen.findByRole('dialog', { name: 'New lab' })
    expect(within(ready).getByLabelText('Course picture file')).toBeInTheDocument()
    expect(within(ready).getByLabelText('Syllabus PDF file')).toBeInTheDocument()
    expect(
      within(ready).queryByText(/after the course is created/i),
    ).not.toBeInTheDocument()
  })

  it('shows the picture and syllabus to a manager without upload controls', async () => {
    const user = userEvent.setup()
    renderCourses('compliance_manager')
    await user.click(await screen.findByRole('cell', { name: 'Robotics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Robotics' })
    expect(
      within(dialog).getByRole('heading', { name: 'Course picture' }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('No picture yet.')).toBeInTheDocument()
    expect(within(dialog).getByText('No syllabus file yet.')).toBeInTheDocument()
    expect(
      within(dialog).queryByLabelText('Course picture file'),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Upload PDF' }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Save week-by-week topics' }),
    ).not.toBeInTheDocument()
  })
})

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}
