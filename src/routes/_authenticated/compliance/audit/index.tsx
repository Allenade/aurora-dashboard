import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { PageHeader, QueryBody } from '@/components/states'
import { Input } from '@/components/ui/input'
import { formatWat } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { api } from '@/queries/api'
import type { AuditLog, AuditPage } from '@/queries/audit/interfaces/audit.dto'

export const Route = createFileRoute('/_authenticated/compliance/audit/')({
  component: AuditPageView,
})

function AuditPageView() {
  const [action, setAction] = useState('')
  const logs = useQuery({
    queryKey: queryKeys.audit({ action }),
    queryFn: () =>
      api<AuditPage>({
        method: 'GET',
        path: '/admin/audit-logs',
        query: { action: action || undefined, limit: 50 },
      }),
  })
  const columns: Column<AuditLog>[] = [
    {
      id: 'when',
      header: 'When',
      cell: ({ row }) => <span className="font-mono text-xs">{formatWat(row.original.createdAt)}</span>,
    },
    { accessorKey: 'action', header: 'Action' },
    { accessorKey: 'type', header: 'Type' },
    { accessorKey: 'resourceType', header: 'Resource' },
    {
      id: 'meta',
      header: 'Metadata',
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {row.original.metadata ? JSON.stringify(row.original.metadata) : ''}
        </span>
      ),
    },
  ]
  return (
    <div>
      <PageHeader eyebrow="AUDIT" title="Audit log" description="Mutations recorded by the admin API." />
      <Input
        className="mb-3 max-w-xs"
        placeholder="Filter by action"
        value={action}
        onChange={(event) => setAction(event.target.value)}
      />
      <QueryBody loading={logs.isLoading} error={logs.error}>
        {logs.data ? <DataTable columns={columns} data={logs.data.items} empty="No audit entries yet" /> : null}
      </QueryBody>
    </div>
  )
}
