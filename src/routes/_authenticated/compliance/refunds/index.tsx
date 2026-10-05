import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Can } from '@/components/ability'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { ExportButtons } from '@/components/export-buttons'
import { PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import { formatNaira, formatWat } from '@/lib/format'
import type { ExportColumn } from '@/lib/table-export'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import type { RefundRequest } from '@/queries/refunds/interfaces/refund.dto'

export const Route = createFileRoute('/_authenticated/compliance/refunds/')({
  component: RefundsPage,
})

const exportColumns: ExportColumn<RefundRequest>[] = [
  { header: 'Status', value: (row) => row.status },
  { header: 'Amount', value: (row) => formatNaira(row.amount) },
  { header: 'Currency', value: (row) => row.currency },
  { header: 'Reason', value: (row) => row.reason },
  { header: 'Requested', value: (row) => formatWat(row.createdAt) },
]

function RefundsPage() {
  const client = useQueryClient()
  const refunds = useQuery({
    queryKey: queryKeys.refunds.all,
    queryFn: () => api<RefundRequest[]>({ method: 'GET', path: '/admin/refunds' }),
  })
  const act = useMutation({
    mutationFn: (input: { id: string; action: 'approve' | 'reject' | 'process' }) =>
      api({
        method: 'POST',
        path: `/admin/refunds/${input.id}/${input.action}`,
        body: {},
      }),
    onSuccess: async () => {
      toast.success('Refund updated')
      await client.invalidateQueries({ queryKey: queryKeys.refunds.all })
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Refund action failed'),
  })
  const columns: Column<RefundRequest>[] = [
    { accessorKey: 'status', header: 'Status' },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="font-mono">{formatNaira(row.original.amount)}</span>
      ),
    },
    { accessorKey: 'reason', header: 'Reason' },
    {
      id: 'when',
      header: 'Requested',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{formatWat(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Can action="update" subject="refund">
          <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
            {row.original.status === 'requested' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => act.mutate({ id: row.original.id, action: 'approve' })}
              >
                Approve
              </Button>
            ) : null}
            {row.original.status === 'approved' ? (
              <Button
                size="sm"
                onClick={() => act.mutate({ id: row.original.id, action: 'process' })}
              >
                Process
              </Button>
            ) : null}
            {row.original.status === 'requested' ||
            row.original.status === 'approved' ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => act.mutate({ id: row.original.id, action: 'reject' })}
              >
                Reject
              </Button>
            ) : null}
          </div>
        </Can>
      ),
    },
  ]
  return (
    <div>
      <PageHeader
        eyebrow="REFUNDS"
        title="Refunds"
        description="Request, approve, then process through Paystack. Only paid enrollments can be refunded. Excel and PDF include the rows below."
        actions={
          <ExportButtons
            filename="refunds"
            title="Refunds"
            columns={exportColumns}
            rows={refunds.data ?? []}
          />
        }
      />
      <QueryBody loading={refunds.isLoading} error={refunds.error}>
        {refunds.data ? (
          <DataTable
            columns={columns}
            data={refunds.data}
            empty="No refund requests yet"
          />
        ) : null}
      </QueryBody>
    </div>
  )
}
