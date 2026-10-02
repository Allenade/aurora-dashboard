import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { PageHeader, QueryBody } from '@/components/states'
import { api } from '@/queries/api'
import type { Enrollment, EnrollmentPage } from '@/queries/payments/interfaces/payment.dto'

export const Route = createFileRoute('/_authenticated/compliance/minors/')({
  component: MinorsPage,
})

function MinorsPage() {
  const minors = useQuery({
    queryKey: ['enrollments', 'minors'],
    queryFn: () => loadMinors(),
  })
  const columns: Column<Enrollment>[] = [
    {
      id: 'name',
      header: 'Student',
      cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`,
    },
    {
      id: 'email',
      header: 'Email',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.email}</span>,
    },
    {
      id: 'guardian',
      header: 'Guardian',
      cell: ({ row }) => row.original.guardianName ?? 'Missing',
    },
    {
      id: 'consent',
      header: 'Guardian consent',
      cell: ({ row }) => (row.original.guardianConsent ? 'Yes' : 'No'),
    },
    {
      id: 'tracks',
      header: 'Tracks',
      cell: ({ row }) => row.original.tracks.join(', '),
    },
  ]
  const missing = minors.data?.filter((row) => !row.guardianConsent).length ?? 0
  return (
    <div>
      <PageHeader
        eyebrow="MINORS"
        title="Minors"
        description="Enrollments with isMinor. The list endpoint has no minor filter, so this page reads each page."
      />
      <QueryBody loading={minors.isLoading} error={minors.error}>
        {minors.data ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {minors.data.length} minors · {missing} without guardian consent
            </p>
            <DataTable columns={columns} data={minors.data} empty="No minors yet" />
          </>
        ) : null}
      </QueryBody>
    </div>
  )
}

async function loadMinors() {
  const rows: Enrollment[] = []
  for (let page = 1; page <= 8; page += 1) {
    const result = await api<EnrollmentPage>({
      method: 'GET',
      path: '/admin/enter-first/enrollments',
      query: { page, limit: 100 },
    })
    rows.push(...result.items.filter((item) => item.isMinor))
    if (page >= result.pageCount) break
  }
  return rows
}
