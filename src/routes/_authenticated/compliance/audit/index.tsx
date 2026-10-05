import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ExportButtons } from '@/components/export-buttons'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  auditActionLabel,
  auditDetails,
  auditLoadError,
  auditResource,
  auditTypeLabel,
  auditWho,
  parseAuditPage,
} from '@/lib/audit-log'
import { formatWat } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import type { ExportColumn } from '@/lib/table-export'
import { api } from '@/queries/api'
import type { AuditLog } from '@/queries/audit/interfaces/audit.dto'

export const Route = createFileRoute('/_authenticated/compliance/audit/')({
  component: AuditPageView,
})

const TYPES = [
  { id: '', label: 'All types' },
  { id: 'access', label: 'Sign-in or view' },
  { id: 'mutation', label: 'Change' },
  { id: 'payment', label: 'Payment' },
]

const exportColumns: ExportColumn<AuditLog>[] = [
  { header: 'When', value: (row) => formatWat(row.createdAt) },
  { header: 'Who', value: (row) => auditWho(row) },
  { header: 'What', value: (row) => auditActionLabel(row.action) },
  { header: 'Type', value: (row) => auditTypeLabel(row.type) },
  { header: 'Resource', value: (row) => auditResource(row) },
  { header: 'Details', value: (row) => auditDetails(row) },
]

function AuditPageView() {
  const [action, setAction] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const logs = useQuery({
    queryKey: queryKeys.audit({ action, type, page }),
    queryFn: async () => {
      const payload = await api<unknown>({
        method: 'GET',
        path: '/admin/audit-logs',
        query: {
          action: action.trim() || undefined,
          type: type || undefined,
          page,
          limit: 50,
        },
      })
      return parseAuditPage(payload)
    },
  })
  const columns: Column<AuditLog>[] = [
    {
      id: 'when',
      header: 'When',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{formatWat(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'who',
      header: 'Who',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{auditWho(row.original)}</span>
      ),
    },
    {
      id: 'what',
      header: 'What',
      cell: ({ row }) => auditActionLabel(row.original.action),
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => auditTypeLabel(row.original.type),
    },
    {
      id: 'resource',
      header: 'Resource',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{auditResource(row.original)}</span>
      ),
    },
    {
      id: 'details',
      header: 'Details',
      cell: ({ row }) => (
        <span className="block max-w-md font-mono text-[11px] break-all text-muted-foreground">
          {auditDetails(row.original) || '-'}
        </span>
      ),
    },
  ]
  const items = logs.data?.items ?? []
  const loadError = logs.error ? auditLoadError(logs.error) : null
  return (
    <div>
      <PageHeader
        eyebrow="AUDIT"
        title="Audit log"
        description="Who did what, and when. Excel and PDF download the rows on this page."
        actions={
          <ExportButtons
            filename="audit-log"
            title="Audit log"
            columns={exportColumns}
            rows={items}
          />
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Type"
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          value={type}
          onChange={(event) => {
            setType(event.target.value)
            setPage(1)
          }}
        >
          {TYPES.map((item) => (
            <option key={item.id || 'all'} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <Input
          className="max-w-xs"
          placeholder="Exact action, such as ADMIN_CHANGE"
          value={action}
          onChange={(event) => {
            setAction(event.target.value)
            setPage(1)
          }}
        />
      </div>
      <QueryBody loading={logs.isLoading} error={loadError}>
        {logs.data ? (
          <>
            <DataTable
              columns={columns}
              data={items}
              empty={
                action.trim() || type
                  ? 'No audit entries match these filters'
                  : 'No audit entries yet'
              }
            />
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span className="font-mono">
                {logs.data.total} · page {logs.data.page}/{logs.data.pageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= logs.data.pageCount}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </QueryBody>
    </div>
  )
}
