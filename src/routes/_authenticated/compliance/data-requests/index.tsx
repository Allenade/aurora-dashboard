import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Can } from '@/components/ability'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatWatDate } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import type { DataRequest, DataRequestExport, DataRequestType } from '@/queries/compliance/interfaces/compliance.dto'

export const Route = createFileRoute('/_authenticated/compliance/data-requests/')({
  component: DataRequestsPage,
})

function DataRequestsPage() {
  const client = useQueryClient()
  const requests = useQuery({
    queryKey: queryKeys.compliance.dataRequests,
    queryFn: () => api<DataRequest[]>({ method: 'GET', path: '/admin/compliance/data-requests' }),
  })
  const [type, setType] = useState<DataRequestType>('access')
  const [email, setEmail] = useState('')
  const create = useMutation({
    mutationFn: () =>
      api({
        method: 'POST',
        path: '/admin/compliance/data-requests',
        body: { type, subjectEmail: email },
      }),
    onSuccess: async () => {
      toast.success('Request opened')
      setEmail('')
      await client.invalidateQueries({ queryKey: queryKeys.compliance.dataRequests })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not create the request'),
  })
  const act = useMutation({
    mutationFn: (id: string) =>
      api({ method: 'POST', path: `/admin/compliance/data-requests/${id}/anonymise` }),
    onSuccess: async () => {
      toast.success('Request updated')
      await client.invalidateQueries({ queryKey: queryKeys.compliance.dataRequests })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Request failed'),
  })
  const download = useMutation({
    mutationFn: (id: string) =>
      api<DataRequestExport>({
        method: 'POST',
        path: `/admin/compliance/data-requests/${id}/export`,
      }),
    onSuccess: (data, id) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `data-request-${id}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('JSON download started')
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Export failed'),
  })
  const columns: Column<DataRequest>[] = [
    { accessorKey: 'type', header: 'Type' },
    {
      id: 'email',
      header: 'Subject',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.subjectEmail}</span>,
    },
    { accessorKey: 'status', header: 'Status' },
    {
      id: 'due',
      header: 'Due',
      cell: ({ row }) => <span className="font-mono text-xs">{formatWatDate(row.original.dueDate)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Can action="update" subject="compliance">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={download.isPending}
              onClick={() => download.mutate(row.original.id)}
            >
              Download JSON
            </Button>
            {row.original.type === 'delete' ? (
              <Button size="sm" variant="destructive" onClick={() => act.mutate(row.original.id)}>
                Anonymise
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
        eyebrow="DATA"
        title="Data requests"
        description="Access and delete only. Delete requests can be anonymised. Correction is not an API type."
      />
      <Can action="create" subject="compliance">
        <form
          className="mb-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            value={type}
            onChange={(event) => setType(event.target.value as DataRequestType)}
          >
            <option value="access">Access</option>
            <option value="delete">Delete</option>
          </select>
          <Input
            type="email"
            required
            placeholder="Subject email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" disabled={create.isPending}>
            Open request
          </Button>
        </form>
      </Can>
      <QueryBody loading={requests.isLoading} error={requests.error}>
        {requests.data ? <DataTable columns={columns} data={requests.data} empty="No data requests yet" /> : null}
      </QueryBody>
    </div>
  )
}
