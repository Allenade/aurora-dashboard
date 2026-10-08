import { createFileRoute } from '@tanstack/react-router'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Can, useSessionUser } from '@/components/ability'
import { CourseSelect } from '@/components/course-select'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { ExportButtons } from '@/components/export-buttons'
import { PageHeader, QueryBody } from '@/components/states'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { isSuperAdmin } from '@/lib/ability'
import { formatNaira, formatWat } from '@/lib/format'
import { paidEnrollment, paymentEmailView } from '@/lib/payment-email'
import { loadEnrollments } from '@/lib/load-enrollments'
import { CORE_PROGRAM, peopleInProgram, programLabel } from '@/lib/program'
import { queryKeys } from '@/lib/query-keys.factory'
import {
  EMPTY_REGISTRANT_FILTERS,
  ageLabel,
  courseOptions,
  filterRegistrants,
  registrantExportColumns,
  type RegistrantFilters,
} from '@/lib/registrant-filters'
import { ApiError, api } from '@/queries/api'
import type { AdminCourse } from '@/queries/courses/interfaces/course.dto'
import type {
  Enrollment,
  PaymentStatus,
} from '@/queries/payments/interfaces/payment.dto'

export const Route = createFileRoute('/_authenticated/compliance/payments/')({
  component: PaymentsPage,
})

const TABS: Array<{ id: string; label: string; status?: PaymentStatus }> = [
  { id: 'all', label: 'All' },
  { id: 'success', label: 'Success', status: 'success' },
  { id: 'pending', label: 'Pending', status: 'pending' },
  { id: 'failed', label: 'Failed', status: 'failed' },
  { id: 'refunded', label: 'Refunded', status: 'refunded' },
]

const PAGE_SIZE = 20

const selectClass = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm'

/** One record. Matches DELETE /admin/enter-first/enrollments/:id. */
function deleteEnrollmentPath(id: string) {
  return `/admin/enter-first/enrollments/${id}`
}

/** Every record. Matches POST /admin/enter-first/enrollments/clear-all. */
const CLEAR_ALL_ENROLLMENTS_PATH = '/admin/enter-first/enrollments/clear-all'

function PaymentsPage() {
  const signedIn = useSessionUser()
  const canDelete = isSuperAdmin(signedIn)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q)
  const [filters, setFilters] = useState<RegistrantFilters>(EMPTY_REGISTRANT_FILTERS)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Enrollment | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const status = TABS.find((item) => item.id === tab)?.status
  const list = useQuery({
    queryKey: queryKeys.enrollments.list({
      q: debouncedQ,
      paymentStatus: status,
      program: CORE_PROGRAM,
      scope: 'all',
    }),
    placeholderData: keepPreviousData,
    queryFn: () => loadEnrollments({ q: debouncedQ, paymentStatus: status }),
  })
  const courses = useQuery({
    queryKey: queryKeys.courses.all,
    queryFn: () => api<AdminCourse[]>({ method: 'GET', path: '/admin/courses' }),
  })
  const loaded = list.data?.items ?? []
  const people = useMemo(() => peopleInProgram(loaded), [loaded])
  const tracks = useMemo(() => courseOptions(courses.data ?? []), [courses.data])
  const filtered = useMemo(() => filterRegistrants(people, filters), [people, filters])
  const exportColumns = useMemo(() => {
    const names = new Map(tracks)
    return registrantExportColumns((slug) => names.get(slug) ?? slug)
  }, [tracks])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const filtersActive =
    Boolean(filters.track || filters.from || filters.to || q.trim() || status) ||
    filters.age !== 'all'

  function updateFilters(patch: Partial<RegistrantFilters>) {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
    setSelected([])
  }

  const resendEmail = useMutation({
    mutationFn: (id: string) =>
      api<Enrollment>({
        method: 'POST',
        path: `/admin/enter-first/enrollments/${id}/resend-confirmation`,
      }),
    onSuccess: async () => {
      toast.success('Email sent again')
      await queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : 'Could not send the email again',
      ),
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ ok?: boolean }>({ method: 'DELETE', path: deleteEnrollmentPath(id) }),
    onSuccess: async (_result, id) => {
      toast.success('Payment record deleted')
      setPendingDelete(null)
      setSelected((current) => current.filter((item) => item !== id))
      setOpenId((current) => (current === id ? null : current))
      await queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Could not delete the payment record',
      ),
  })

  const clearAll = useMutation({
    mutationFn: () =>
      api<{ ok?: boolean; deleted?: number } | null>({
        method: 'POST',
        path: CLEAR_ALL_ENROLLMENTS_PATH,
      }),
    onSuccess: async () => {
      toast.success('All payment records deleted')
      setConfirmClear(false)
      setSelected([])
      setOpenId(null)
      await queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Could not delete the payment records',
      ),
  })

  const columns: Column<Enrollment>[] = [
    {
      id: 'pick',
      header: '',
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selected.includes(row.original.id)}
          onClick={(event) => event.stopPropagation()}
          onChange={() =>
            setSelected((current) =>
              current.includes(row.original.id)
                ? current.filter((id) => id !== row.original.id)
                : [...current, row.original.id],
            )
          }
        />
      ),
    },
    {
      id: 'name',
      header: 'Student',
      cell: ({ row }) => (
        <div>
          <p>
            {row.original.firstName} {row.original.lastName}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {row.original.email}
          </p>
        </div>
      ),
    },
    {
      id: 'tracks',
      header: 'Course',
      cell: ({ row }) =>
        row.original.tracks.map((slug) => namesFor(tracks, slug)).join(', ') || '-',
    },
    {
      id: 'age',
      header: 'Age',
      cell: ({ row }) => ageLabel(row.original.isMinor),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="font-mono">{formatNaira(row.original.amount)}</span>
      ),
    },
    { accessorKey: 'paymentStatus', header: 'Status' },
    {
      id: 'email',
      header: 'Email',
      cell: ({ row }) => {
        const view = paymentEmailView(row.original)
        return (
          <div className="space-y-1" onClick={(event) => event.stopPropagation()}>
            {view.tone === 'failed' ? (
              <p className="text-danger/80" title={view.reason}>
                {view.text}
              </p>
            ) : (
              <p
                className={
                  view.tone === 'sent'
                    ? 'text-emerald-400'
                    : view.tone === 'none'
                      ? 'text-muted-foreground'
                      : undefined
                }
              >
                {view.text}
              </p>
            )}
            {paidEnrollment(row.original) ? (
              <Can action="update" subject="enter_first">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={resendEmail.isPending}
                  onClick={() => resendEmail.mutate(row.original.id)}
                >
                  Resend email
                </Button>
              </Can>
            ) : null}
          </div>
        )
      },
    },
    {
      id: 'ref',
      header: 'Reference',
      cell: ({ row }) => (
        <span className="font-mono text-[11px]">{row.original.paystackReference}</span>
      ),
    },
    {
      id: 'when',
      header: 'Created',
      cell: ({ row }) => (
        <span className="font-mono text-[11px]">
          {formatWat(row.original.createdAt)}
        </span>
      ),
    },
    ...(canDelete
      ? [
          {
            id: 'delete',
            header: '',
            cell: ({ row }: { row: { original: Enrollment } }) => (
              <div onClick={(event) => event.stopPropagation()}>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  aria-label={`Delete ${row.original.firstName} ${row.original.lastName}`}
                  onClick={() => setPendingDelete(row.original)}
                >
                  Delete
                </Button>
              </div>
            ),
          } satisfies Column<Enrollment>,
        ]
      : []),
  ]

  return (
    <div>
      <PageHeader
        eyebrow="CORE 3.0"
        title="Payments"
        description="People enrolled in Core 3.0. Filter by course, age, status, and date. Excel and PDF include every match, not only this page."
        actions={
          <>
            {canDelete && people.length > 0 ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmClear(true)}
              >
                Delete all
              </Button>
            ) : null}
            <ExportButtons
              filename="core-3-payments"
              title="Core 3.0 payments"
              columns={exportColumns}
              rows={filtered}
            />
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TABS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={tab === item.id ? 'default' : 'outline'}
            onClick={() => {
              setTab(item.id)
              setPage(1)
              setSelected([])
            }}
          >
            {item.label}
          </Button>
        ))}
        <Input
          className="max-w-xs"
          placeholder="Search name, email, reference"
          value={q}
          onChange={(event) => {
            setQ(event.target.value)
            setPage(1)
            setSelected([])
          }}
        />
        <span className="text-sm text-muted-foreground">
          Program <span className="text-foreground">{CORE_PROGRAM}</span>
        </span>
        <CourseSelect
          courses={courses.data}
          loading={courses.isLoading}
          error={courses.isError}
          value={filters.track}
          onChange={(track) => updateFilters({ track })}
        />
        <select
          aria-label="Age"
          className={selectClass}
          value={filters.age}
          onChange={(event) =>
            updateFilters({ age: event.target.value as RegistrantFilters['age'] })
          }
        >
          <option value="all">All ages</option>
          <option value="minor">Under 18</option>
          <option value="adult">18 or older</option>
          <option value="unknown">Age unknown</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          From
          <Input
            aria-label="From"
            type="date"
            className="w-36"
            value={filters.from}
            onChange={(event) => updateFilters({ from: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          To
          <Input
            aria-label="To"
            type="date"
            className="w-36"
            value={filters.to}
            onChange={(event) => updateFilters({ to: event.target.value })}
          />
        </label>
        {filters.track || filters.age !== 'all' || filters.from || filters.to ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilters(EMPTY_REGISTRANT_FILTERS)
              setPage(1)
              setSelected([])
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
      {list.data?.truncated ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Loaded the first {loaded.length} enrollments. Program, course, age, and date
          are applied here, so later rows are not included.
        </p>
      ) : null}
      {selected.length ? (
        <BulkBar
          ids={selected}
          onDone={() => {
            setSelected([])
            void list.refetch()
          }}
        />
      ) : null}
      <QueryBody loading={list.isLoading} error={list.error}>
        {list.data ? (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              {filtered.length} of {people.length} in {CORE_PROGRAM}
            </p>
            <DataTable
              columns={columns}
              data={pageRows}
              onRow={(row) => setOpenId(row.id)}
              empty={
                filtersActive
                  ? 'No enrollments match these filters'
                  : `No enrollments in ${CORE_PROGRAM} yet`
              }
            />
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span className="font-mono">
                {filtered.length} · page {safePage}/{pageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </QueryBody>
      <EnrollmentDrawer id={openId} onClose={() => setOpenId(null)} />
      <ConfirmDeleteDialog
        open={pendingDelete != null}
        title="Delete this payment record?"
        description="This cannot be undone. It will not refund them."
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
        title="Delete all payment records?"
        description="This removes every payment record. It will not refund anyone."
        confirmLabel="Delete all"
        pending={clearAll.isPending}
        requirePhrase="delete all"
        onOpenChange={setConfirmClear}
        onConfirm={() => clearAll.mutate()}
      />
    </div>
  )
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

function namesFor(tracks: Array<[string, string]>, slug: string) {
  return tracks.find(([id]) => id === slug)?.[1] ?? slug
}

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function BulkBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const run = useMutation({
    mutationFn: async (action: 'reverify' | 'resend-confirmation') => {
      for (const id of ids) {
        await api({
          method: 'POST',
          path: `/admin/compliance/enrollments/${id}/${action}`,
        })
      }
    },
    onSuccess: () => {
      toast.success('Updated')
      onDone()
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Bulk action failed'),
  })
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <span className="font-mono">{ids.length} selected</span>
      <Can action="update" subject="enter_first">
        <Button size="sm" variant="outline" onClick={() => run.mutate('reverify')}>
          Re-verify
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => run.mutate('resend-confirmation')}
        >
          Resend link
        </Button>
      </Can>
    </div>
  )
}

function EnrollmentDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const client = useQueryClient()
  const detail = useQuery({
    queryKey: queryKeys.enrollments.detail(id ?? 'none'),
    enabled: Boolean(id),
    queryFn: () =>
      api<Enrollment>({ method: 'GET', path: `/admin/enter-first/enrollments/${id}` }),
  })
  const act = useMutation({
    mutationFn: (action: 'reverify') =>
      api({ method: 'POST', path: `/admin/compliance/enrollments/${id}/${action}` }),
    onSuccess: async () => {
      toast.success('Done')
      await client.invalidateQueries({
        queryKey: queryKeys.enrollments.detail(id ?? ''),
      })
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Request failed'),
  })
  const resendEmail = useMutation({
    mutationFn: () =>
      api<Enrollment>({
        method: 'POST',
        path: `/admin/enter-first/enrollments/${id}/resend-confirmation`,
      }),
    onSuccess: async () => {
      toast.success('Email sent again')
      await client.invalidateQueries({ queryKey: ['enrollments'] })
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : 'Could not send the email again',
      ),
  })
  const [reason, setReason] = useState('')
  const refund = useMutation({
    mutationFn: () =>
      api({
        method: 'POST',
        path: '/admin/refunds',
        body: { enrollmentId: id, reason: reason.trim() },
      }),
    onSuccess: () => toast.success('Refund requested'),
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Refund failed'),
  })
  const row = detail.data
  const emailView = row ? paymentEmailView(row) : null
  const needsReview = Boolean(
    row &&
    row.paymentStatus === 'success' &&
    row.amount > 0 &&
    (!row.verifiedAt || !row.paystackTransactionId),
  )
  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {row ? `${row.firstName} ${row.lastName}` : 'Enrollment'}
          </SheetTitle>
        </SheetHeader>
        <QueryBody loading={detail.isLoading} error={detail.error}>
          {row ? (
            <div className="space-y-3 px-4 pb-6 text-sm">
              {needsReview ? (
                <p className="text-warn">Needs review · paid, not verified</p>
              ) : null}
              <p className="font-mono text-lg">{formatNaira(row.amount)}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {row.paystackReference}
              </p>
              <p>Status {row.paymentStatus}</p>
              <p>Program {programLabel(row)}</p>
              <p>Courses {row.tracks.join(', ') || '-'}</p>
              <p>Age {ageLabel(row.isMinor)}</p>
              {row.dateOfBirth ? <p>Date of birth {row.dateOfBirth}</p> : null}
              <p>Channel {row.paystackChannel ?? '-'}</p>
              <p>Source {row.confirmationSource ?? '-'}</p>
              <p>Verified {formatWat(row.verifiedAt)}</p>
              <p>Consent {formatWat(row.consentAt)}</p>
              <p>
                Email{' '}
                {emailView?.tone === 'failed' ? (
                  <span title={emailView.reason}>{emailView.text}</span>
                ) : (
                  emailView?.text
                )}
              </p>
              <p className="text-muted-foreground">
                Amount mismatch {row.amountMismatch ? 'yes' : 'no'}
              </p>
              <Can action="update" subject="enter_first">
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => act.mutate('reverify')}>
                    Re-verify
                  </Button>
                  {row.paymentStatus === 'success' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resendEmail.isPending}
                      onClick={() => resendEmail.mutate()}
                    >
                      Resend email
                    </Button>
                  ) : null}
                </div>
              </Can>
              <Can action="create" subject="refund">
                {row.paymentStatus === 'success' ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <Input
                      aria-label="Refund reason"
                      placeholder="Reason for the refund"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!reason.trim() || refund.isPending}
                      onClick={() => refund.mutate()}
                    >
                      Request refund
                    </Button>
                  </div>
                ) : null}
              </Can>
            </div>
          ) : null}
        </QueryBody>
      </SheetContent>
    </Sheet>
  )
}
