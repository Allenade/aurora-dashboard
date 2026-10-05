import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { ExportButtons } from '@/components/export-buttons'
import { PageHeader, QueryBody } from '@/components/states'
import { formatNaira, formatWat } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import type { ExportColumn } from '@/lib/table-export'
import { api } from '@/queries/api'
import {
  exceptionLabel,
  type ComplianceException,
} from '@/queries/compliance/interfaces/compliance.dto'

export const Route = createFileRoute('/_authenticated/compliance/claims/')({
  component: ClaimsPage,
})

const exportColumns: ExportColumn<ComplianceException>[] = [
  { header: 'Student', value: (row) => row.name },
  { header: 'Email', value: (row) => row.email ?? '' },
  {
    header: 'Claim',
    value: (row) => row.reasons.map((reason) => exceptionLabel(reason)).join(', '),
  },
  { header: 'Status', value: (row) => row.paymentStatus },
  { header: 'Amount', value: (row) => formatNaira(row.amount) },
  { header: 'Reference', value: (row) => row.reference ?? '' },
  { header: 'Created', value: (row) => formatWat(row.createdAt) },
]

function ClaimsPage() {
  const exceptions = useQuery({
    queryKey: queryKeys.compliance.exceptions,
    queryFn: () =>
      api<{ items: ComplianceException[] }>({
        method: 'GET',
        path: '/admin/compliance/exceptions',
      }),
  })
  const columns: Column<ComplianceException>[] = [
    {
      id: 'name',
      header: 'Student',
      cell: ({ row }) => row.original.name,
    },
    {
      id: 'reasons',
      header: 'Claim',
      cell: ({ row }) =>
        row.original.reasons.map((reason) => exceptionLabel(reason)).join(', '),
    },
    { accessorKey: 'paymentStatus', header: 'Status' },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="font-mono">{formatNaira(row.original.amount)}</span>
      ),
    },
    {
      id: 'ref',
      header: 'Reference',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.reference}</span>
      ),
    },
  ]
  return (
    <div>
      <PageHeader
        eyebrow="CLAIMS"
        title="Claims"
        description="Open reconciliation claims from the exceptions feed: unpaid verification, amount mismatch, missing email, and stale pending. Excel and PDF include these rows."
        actions={
          <ExportButtons
            filename="claims"
            title="Claims"
            columns={exportColumns}
            rows={exceptions.data?.items ?? []}
          />
        }
      />
      <QueryBody loading={exceptions.isLoading} error={exceptions.error}>
        {exceptions.data ? (
          <DataTable
            columns={columns}
            data={exceptions.data.items}
            empty="No claims yet"
          />
        ) : null}
      </QueryBody>
    </div>
  )
}
