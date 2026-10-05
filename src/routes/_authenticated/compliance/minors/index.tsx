import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { ExportButtons } from '@/components/export-buttons'
import { PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import { collectPages } from '@/lib/pages'
import { queryKeys } from '@/lib/query-keys.factory'
import {
  filterRegistrants,
  registrantExportColumns,
  trackChoices,
} from '@/lib/registrant-filters'
import { api } from '@/queries/api'
import type { AdminCourse } from '@/queries/courses/interfaces/course.dto'
import type {
  Enrollment,
  EnrollmentPage,
} from '@/queries/payments/interfaces/payment.dto'

export const Route = createFileRoute('/_authenticated/compliance/minors/')({
  component: MinorsPage,
})

function MinorsPage() {
  const [track, setTrack] = useState('')
  const minors = useQuery({
    queryKey: ['enrollments', 'minors'],
    queryFn: () => loadMinors(),
  })
  const courses = useQuery({
    queryKey: queryKeys.courses.all,
    queryFn: () => api<AdminCourse[]>({ method: 'GET', path: '/admin/courses' }),
  })
  const loaded = minors.data?.items ?? []
  const tracks = useMemo(
    () => trackChoices(courses.data ?? [], loaded),
    [courses.data, loaded],
  )
  const filtered = useMemo(
    () => filterRegistrants(loaded, { track, age: 'all', from: '', to: '' }),
    [loaded, track],
  )
  const exportColumns = useMemo(() => {
    const names = new Map(tracks)
    return registrantExportColumns((slug) => names.get(slug) ?? slug)
  }, [tracks])
  const columns: Column<Enrollment>[] = [
    {
      id: 'name',
      header: 'Student',
      cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`,
    },
    {
      id: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.email}</span>
      ),
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
      header: 'Courses',
      cell: ({ row }) =>
        row.original.tracks
          .map((slug) => tracks.find(([id]) => id === slug)?.[1] ?? slug)
          .join(', '),
    },
  ]
  const missing = filtered.filter((row) => !row.guardianConsent).length
  return (
    <div>
      <PageHeader
        eyebrow="MINORS"
        title="Minors"
        description="Enrollments marked under 18. The list API has no minor filter, so this page reads each page. Excel and PDF include the rows that match the course filter."
        actions={
          <ExportButtons
            filename="minors"
            title="Minors"
            columns={exportColumns}
            rows={filtered}
          />
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Course"
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          value={track}
          onChange={(event) => setTrack(event.target.value)}
        >
          <option value="">All courses</option>
          {tracks.map(([slug, name]) => (
            <option key={slug} value={slug}>
              {name}
            </option>
          ))}
        </select>
        {track ? (
          <Button size="sm" variant="ghost" onClick={() => setTrack('')}>
            Clear
          </Button>
        ) : null}
      </div>
      <QueryBody loading={minors.isLoading} error={minors.error}>
        {minors.data ? (
          <>
            {minors.data.truncated ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Loaded the first {loaded.length} enrollments, then kept the minors.
                Later pages are not included.
              </p>
            ) : null}
            <p className="mb-3 text-sm text-muted-foreground">
              {filtered.length} minors · {missing} without guardian consent
            </p>
            <DataTable
              columns={columns}
              data={filtered}
              empty={track ? 'No minors match that course' : 'No minors yet'}
            />
          </>
        ) : null}
      </QueryBody>
    </div>
  )
}

async function loadMinors() {
  const collected = await collectPages((page, limit) =>
    api<EnrollmentPage>({
      method: 'GET',
      path: '/admin/enter-first/enrollments',
      query: { page, limit },
    }),
  )
  return {
    items: collected.items.filter((item) => item.isMinor),
    truncated: collected.truncated,
  }
}
