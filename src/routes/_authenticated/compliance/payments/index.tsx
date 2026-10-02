import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Can } from '@/components/ability'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatNaira, formatWat } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import type { Enrollment, EnrollmentPage, PaymentStatus } from '@/queries/payments/interfaces/payment.dto'

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

function PaymentsPage() {
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const status = TABS.find((item) => item.id === tab)?.status
  const list = useQuery({
    queryKey: queryKeys.enrollments.list({ q, paymentStatus: status, page }),
    queryFn: () =>
      api<EnrollmentPage>({
        method: 'GET',
        path: '/admin/enter-first/enrollments',
        query: { q, paymentStatus: status, page, limit: 20 },
      }),
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
          <p className="font-mono text-[11px] text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }) => <span className="font-mono">{formatNaira(row.original.amount)}</span>,
    },
    { accessorKey: 'paymentStatus', header: 'Status' },
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
      cell: ({ row }) => <span className="font-mono text-[11px]">{formatWat(row.original.createdAt)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="PAYMENTS"
        title="Payments"
        description="Enter First enrollments. Needs review is a paid row that is not verified, not a separate status."
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
          }}
        />
        <a
          className="text-sm text-primary"
          href={`/api/bff/admin/compliance/export`}
        >
          Export CSV
        </a>
      </div>
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
            <DataTable
              columns={columns}
              data={list.data.items}
              onRow={(row) => setOpenId(row.id)}
              empty={q.trim() ? 'No enrollments match that search' : 'No enrollments yet'}
            />
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span className="font-mono">
                {list.data.total} · page {list.data.page}/{list.data.pageCount}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= list.data.pageCount}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </QueryBody>
      <EnrollmentDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}

function BulkBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const run = useMutation({
    mutationFn: async (action: 'reverify' | 'resend-confirmation') => {
      for (const id of ids) {
        await api({ method: 'POST', path: `/admin/compliance/enrollments/${id}/${action}` })
      }
    },
    onSuccess: () => {
      toast.success('Updated')
      onDone()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Bulk action failed'),
  })
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <span className="font-mono">{ids.length} selected</span>
      <Can action="update" subject="enter_first">
        <Button size="sm" variant="outline" onClick={() => run.mutate('reverify')}>
          Re-verify
        </Button>
        <Button size="sm" variant="outline" onClick={() => run.mutate('resend-confirmation')}>
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
    queryFn: () => api<Enrollment>({ method: 'GET', path: `/admin/enter-first/enrollments/${id}` }),
  })
  const act = useMutation({
    mutationFn: (action: 'reverify' | 'resend-confirmation') =>
      api({ method: 'POST', path: `/admin/compliance/enrollments/${id}/${action}` }),
    onSuccess: async () => {
      toast.success('Done')
      await client.invalidateQueries({ queryKey: queryKeys.enrollments.detail(id ?? '') })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Request failed'),
  })
  const [reason, setReason] = useState('Seat change')
  const refund = useMutation({
    mutationFn: () =>
      api({
        method: 'POST',
        path: '/admin/refunds',
        body: { enrollmentId: id, reason },
      }),
    onSuccess: () => toast.success('Refund requested'),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Refund failed'),
  })
  const row = detail.data
  const needsReview = Boolean(
    row && row.paymentStatus === 'success' && row.amount > 0 && (!row.verifiedAt || !row.paystackTransactionId),
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
              {needsReview ? <p className="text-warn">Needs review · paid, not verified</p> : null}
              <p className="font-mono text-lg">{formatNaira(row.amount)}</p>
              <p className="font-mono text-xs text-muted-foreground">{row.paystackReference}</p>
              <p>Status {row.paymentStatus}</p>
              <p>Tracks {row.tracks.join(', ')}</p>
              <p>Channel {row.paystackChannel ?? '-'}</p>
              <p>Source {row.confirmationSource ?? '-'}</p>
              <p>Verified {formatWat(row.verifiedAt)}</p>
              <p>Consent {formatWat(row.consentAt)}</p>
              <p>Email sent {formatWat(row.emailSentAt)}</p>
              <p className="text-muted-foreground">
                Amount mismatch {row.amountMismatch ? 'yes' : 'no'} · minor {row.isMinor ? 'yes' : 'no'}
              </p>
              <Can action="update" subject="enter_first">
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => act.mutate('reverify')}>
                    Re-verify
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act.mutate('resend-confirmation')}>
                    Resend confirmation
                  </Button>
                </div>
              </Can>
              <Can action="create" subject="refund">
                {row.paymentStatus === 'success' ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <Input value={reason} onChange={(event) => setReason(event.target.value)} />
                    <Button size="sm" variant="outline" onClick={() => refund.mutate()}>
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
