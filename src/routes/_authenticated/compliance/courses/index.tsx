import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Can, useAbility, useSessionUser } from '@/components/ability'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { EmptyState, PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { allows, isSuperAdmin } from '@/lib/ability'
import { courseStatusLabel, editableCourseStatus } from '@/lib/course-status'
import {
  coursePriceSet,
  formatCoursePrice,
  PRICE_REQUIRED_MESSAGE,
} from '@/lib/course-price'
import { formatCount, formatWatDate } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import type {
  AdminCourse,
  AdminCourseDetail,
  CourseStatus,
  UpdateCourseBody,
  UpsertCourseBody,
} from '@/queries/courses/interfaces/course.dto'

export const Route = createFileRoute('/_authenticated/compliance/courses/')({
  component: CoursesPage,
})

/** Bulk delete. Matches POST /admin/courses/clear-all on the API. */
const CLEAR_ALL_COURSES_PATH = '/admin/courses/clear-all'

function CoursesPage() {
  const ability = useAbility()
  const user = useSessionUser()
  const canUpdate = allows(ability, 'update', 'course')
  const canDelete = allows(ability, 'delete', 'course')
  const canClearAll = canDelete && isSuperAdmin(user)
  const queryClient = useQueryClient()
  const courses = useQuery({
    queryKey: queryKeys.courses.all,
    queryFn: () => api<AdminCourse[]>({ method: 'GET', path: '/admin/courses' }),
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>({ method: 'DELETE', path: `/admin/courses/${id}` }),
    onSuccess: async (_result, id) => {
      toast.success('Course deleted')
      setPendingDelete(null)
      if (selected === id) setSelected(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.courses.all })
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the course'),
  })

  const clearAll = useMutation({
    mutationFn: () => api<{ ok?: boolean; deleted?: number } | null>({
      method: 'POST',
      path: CLEAR_ALL_COURSES_PATH,
    }),
    onSuccess: async () => {
      toast.success('All courses deleted')
      setConfirmClear(false)
      setSelected(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.courses.all })
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the courses'),
  })

  const columns: Column<AdminCourse>[] = [
    { accessorKey: 'name', header: 'Course' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => courseStatusLabel(row.original.status),
    },
    {
      id: 'price',
      header: 'Price',
      cell: ({ row }) => {
        const label = formatCoursePrice(row.original)
        const unset = !coursePriceSet(row.original)
        return (
          <span className={unset ? 'font-medium text-warn' : 'font-mono'}>
            {label}
          </span>
        )
      },
    },
    {
      id: 'seats',
      header: 'Seats',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {formatCount(row.original.seatsTaken)}
          {row.original.seatCap == null ? ' · open' : ` / ${formatCount(row.original.seatCap)}`}
        </span>
      ),
    },
    {
      id: 'cutoff',
      header: 'Cutoff',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{formatWatDate(row.original.enrollmentCutoff)}</span>
      ),
    },
    {
      id: 'enrollments',
      header: 'Enrollments',
      cell: ({ row }) => <span className="font-mono">{row.original.enrollmentCount}</span>,
    },
    ...(canDelete
      ? [
          {
            id: 'delete',
            header: '',
            cell: ({ row }: { row: { original: AdminCourse } }) => (
              <div onClick={(event) => event.stopPropagation()}>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  aria-label={`Delete ${row.original.name}`}
                  onClick={() =>
                    setPendingDelete({ id: row.original.id, name: row.original.name })
                  }
                >
                  Delete
                </Button>
              </div>
            ),
          } satisfies Column<AdminCourse>,
        ]
      : []),
  ]

  return (
    <div>
      <PageHeader
        eyebrow="CATALOGUE"
        title="Courses"
        description="Prices are set here. A draft or closed course can have no price. Opening a paid course needs a price or Free."
        actions={
          <>
            {canClearAll && courses.data && courses.data.length > 0 ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmClear(true)}
              >
                Delete all courses
              </Button>
            ) : null}
            <Can action="create" subject="course">
              <Button onClick={() => setCreating(true)}>New course</Button>
            </Can>
          </>
        }
      />
      <QueryBody loading={courses.isLoading} error={courses.error}>
        {courses.data ? (
          courses.data.length ? (
            <DataTable
              columns={columns}
              data={courses.data}
              onRow={canUpdate || allows(ability, 'read', 'course') ? (row) => setSelected(row.id) : undefined}
            />
          ) : (
            <EmptyState title="No courses yet" body="Create a draft. Set a price or mark it free before you open it." />
          )
        ) : null}
      </QueryBody>
      <CourseDrawer
        id={selected}
        onClose={() => setSelected(null)}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all })}
        onRequestDelete={(course) => setPendingDelete({ id: course.id, name: course.name })}
      />
      <ConfirmDeleteDialog
        open={pendingDelete != null}
        title="Delete this course?"
        description={
          pendingDelete
            ? `${pendingDelete.name} will be removed. This cannot be undone.`
            : 'This course will be removed. This cannot be undone.'
        }
        confirmLabel="Delete"
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id)
        }}
      />
      <ConfirmDeleteDialog
        open={confirmClear}
        title="Delete all courses?"
        description="This deletes every course. This cannot be undone."
        confirmLabel="Delete all courses"
        pending={clearAll.isPending}
        requirePhrase="delete all"
        onOpenChange={setConfirmClear}
        onConfirm={() => clearAll.mutate()}
      />
      <CreateCourseSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false)
          void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all })
        }}
      />
    </div>
  )
}

function CourseDrawer({
  id,
  onClose,
  onChanged,
  onRequestDelete,
}: {
  id: string | null
  onClose: () => void
  onChanged: () => void
  onRequestDelete: (course: AdminCourseDetail) => void
}) {
  const detail = useQuery({
    queryKey: queryKeys.courses.detail(id ?? 'none'),
    enabled: Boolean(id),
    queryFn: () => api<AdminCourseDetail>({ method: 'GET', path: `/admin/courses/${id}` }),
  })
  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{detail.data?.name ?? 'Course'}</SheetTitle>
        </SheetHeader>
        <QueryBody loading={detail.isLoading} error={detail.error}>
          {detail.data ? (
            <CourseForm
              key={detail.data.id}
              course={detail.data}
              onChanged={() => {
                onChanged()
                void detail.refetch()
              }}
              onRequestDelete={() => {
                const course = detail.data
                if (course) onRequestDelete(course)
              }}
            />
          ) : null}
        </QueryBody>
      </SheetContent>
    </Sheet>
  )
}

function CourseForm({
  course,
  onChanged,
  onRequestDelete,
}: {
  course: AdminCourseDetail
  onChanged: () => void
  onRequestDelete: () => void
}) {
  const [name, setName] = useState(course.name)
  const [description, setDescription] = useState(course.description)
  const [isFree, setIsFree] = useState(course.isFree)
  const [price, setPrice] = useState(
    course.isFree || !coursePriceSet(course) ? '' : String(course.price),
  )
  const [seatCap, setSeatCap] = useState(course.seatCap == null ? '' : String(course.seatCap))
  const [cutoff, setCutoff] = useState(course.enrollmentCutoff?.slice(0, 10) ?? '')
  const [status, setStatus] = useState<CourseStatus>(editableCourseStatus(course.status))
  const [error, setError] = useState<string | null>(null)
  const client = useQueryClient()

  const save = useMutation({
    mutationFn: (body: UpdateCourseBody) =>
      api<AdminCourse>({ method: 'PATCH', path: `/admin/courses/${course.id}`, body }),
    onSuccess: async () => {
      setError(null)
      toast.success('Course saved')
      await client.invalidateQueries({ queryKey: queryKeys.courses.detail(course.id) })
      onChanged()
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'Could not save the course'
      setError(message)
      toast.error(message)
    },
  })

  const archive = useMutation({
    mutationFn: () =>
      api<AdminCourse>({ method: 'POST', path: `/admin/courses/${course.id}/archive` }),
    onSuccess: () => {
      toast.success('Course archived')
      onChanged()
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not archive'),
  })

  function bodyFor(nextStatus: CourseStatus): UpdateCourseBody {
    return {
      name,
      description,
      status: nextStatus,
      isFree,
      price: isFree ? 0 : price.trim() ? Number(price) : null,
      seatCap: seatCap.trim() ? Number(seatCap) : null,
      enrollmentCutoff: cutoff ? new Date(cutoff).toISOString() : null,
    }
  }

  const priced = isFree || (price.trim() !== '' && Number(price) > 0) || coursePriceSet({
    price: price.trim() ? Number(price) : course.price,
    isFree,
  })
  const showUnset = !isFree && !(price.trim() ? Number(price) > 0 : coursePriceSet(course))

  return (
    <div className="space-y-4 px-4 pb-6">
      {!coursePriceSet(course) ? (
        <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          No price set
        </p>
      ) : null}
      <Field label="Name">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Description">
        <Input value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <div>
          <p className="text-sm">Free</p>
          <p className="text-xs text-muted-foreground">A free course is stored with a price of 0.</p>
        </div>
        <Switch checked={isFree} onCheckedChange={setIsFree} />
      </div>
      <Field label="Price (whole naira)">
        <Input
          inputMode="numeric"
          placeholder="No price set"
          disabled={isFree}
          value={isFree ? '' : price}
          onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, ''))}
        />
      </Field>
      {showUnset && status === 'open' ? (
        <p className="text-sm text-warn">No price set. {PRICE_REQUIRED_MESSAGE}</p>
      ) : null}
      {showUnset && status !== 'open' ? (
        <p className="text-sm text-muted-foreground">
          No price set. Closed and draft courses can stay like this.
        </p>
      ) : null}
      <Field label="Seat cap">
        <Input
          inputMode="numeric"
          placeholder="Uncapped"
          value={seatCap}
          onChange={(event) => setSeatCap(event.target.value.replace(/[^\d]/g, ''))}
        />
      </Field>
      <Field label="Enrollment cutoff">
        <Input type="date" value={cutoff} onChange={(event) => setCutoff(event.target.value)} />
      </Field>
      <Field label="Status">
        <select
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as CourseStatus)}
        >
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Can action="update" subject="course">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate(bodyFor(status))}
          >
            Save
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate(bodyFor('open'))}
          >
            Publish
          </Button>
        </div>
        {!priced ? (
          <p className="text-xs text-muted-foreground">
            Opening a paid course without a price asks the server, which returns 400.
          </p>
        ) : null}
      </Can>
      <Can action="update" subject="course">
        {course.enrollmentCount > 0 ? (
          <Button variant="outline" disabled={archive.isPending} onClick={() => archive.mutate()}>
            Archive
          </Button>
        ) : null}
      </Can>
      <Can action="delete" subject="course">
        <Button
          type="button"
          variant="destructive"
          aria-label={`Delete ${course.name}`}
          onClick={onRequestDelete}
        >
          Delete
        </Button>
      </Can>
      <div>
        <p className="text-sm font-medium">Price history</p>
        {course.priceHistory.length ? (
          <ul className="mt-2 space-y-1 text-xs">
            {course.priceHistory.map((entry) => (
              <li key={entry.id} className="font-mono text-muted-foreground">
                {historyAmount(entry.oldPrice)} → {historyAmount(entry.newPrice)} {entry.newCurrency}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No price has been recorded.</p>
        )}
      </div>
    </div>
  )
}

function CreateCourseSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: (body: UpsertCourseBody) =>
      api<AdminCourse>({ method: 'POST', path: '/admin/courses', body }),
    onSuccess: () => {
      toast.success('Draft created')
      onCreated()
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not create the course'),
  })

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New course</SheetTitle>
        </SheetHeader>
        <form
          className="space-y-3 px-4"
          onSubmit={(event) => {
            event.preventDefault()
            const body: UpsertCourseBody = {
              slug,
              name,
              status: 'draft',
              isFree,
              price: isFree ? 0 : price.trim() ? Number(price) : null,
            }
            create.mutate(body)
          }}
        >
          <Field label="Slug">
            <Input value={slug} onChange={(event) => setSlug(event.target.value)} required />
          </Field>
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <div className="flex items-center justify-between">
            <Label>Free</Label>
            <Switch checked={isFree} onCheckedChange={setIsFree} />
          </div>
          <Field label="Price">
            <Input
              placeholder="No price set"
              disabled={isFree}
              value={price}
              onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, ''))}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Leave the price empty for an unpriced draft. Opening a paid course still needs a price or Free.
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={create.isPending}>
            Create draft
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function historyAmount(value: number | null) {
  return value == null ? 'No price set' : String(value)
}

function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  requirePhrase,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  requirePhrase?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  useEffect(() => {
    if (!open) setTyped('')
  }, [open])
  const phrase = requirePhrase?.trim().toLowerCase() ?? ''
  const ready = !phrase || typed.trim().toLowerCase() === phrase

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {phrase ? (
          <label className="block space-y-1.5 text-sm">
            <span>Type {requirePhrase} to confirm</span>
            <Input
              value={typed}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!ready || pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span>{label}</span>
      {children}
    </label>
  )
}
