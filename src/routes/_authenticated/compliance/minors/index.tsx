import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { CourseSelect } from '@/components/course-select'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { ExportButtons } from '@/components/export-buttons'
import { PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import { loadEnrollments } from '@/lib/load-enrollments'
import { CORE_PROGRAM, peopleInProgram } from '@/lib/program'
import { queryKeys } from '@/lib/query-keys.factory'
import {
  courseOptions,
  filterRegistrants,
  registrantExportColumns,
} from '@/lib/registrant-filters'
import { api } from '@/queries/api'
import type { AdminCourse } from '@/queries/courses/interfaces/course.dto'
import type { Enrollment } from '@/queries/payments/interfaces/payment.dto'

export const Route = createFileRoute('/_authenticated/compliance/minors/')({
  component: MinorsPage,
})

function MinorsPage() {
  const [track, setTrack] = useState('')
  const minors = useQuery({
    queryKey: ['enrollments', 'minors', CORE_PROGRAM],
    queryFn: () => loadMinors(),
  })
  const courses = useQuery({
    queryKey: queryKeys.courses.all,
    queryFn: () => api<AdminCourse[]>({ method: 'GET', path: '/admin/courses' }),
  })
  const loaded = minors.data?.items ?? []
  const people = useMemo(() => peopleInProgram(loaded), [loaded])
  const tracks = useMemo(() => courseOptions(courses.data ?? []), [courses.data])
  const filtered = useMemo(
    () => filterRegistrants(people, { track, age: 'all', from: '', to: '' }),
    [people, track],
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
        eyebrow="CORE 3.0"
        title="Minors"
        description="People under 18 in Core 3.0. The list API has no minor filter, so this page reads each page. Excel and PDF include the rows that match the course filter."
        actions={
          <ExportButtons
            filename="core-3-minors"
            title="Core 3.0 minors"
            columns={exportColumns}
            rows={filtered}
          />
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Program <span className="text-foreground">{CORE_PROGRAM}</span>
        </span>
        <CourseSelect
          courses={courses.data}
          loading={courses.isLoading}
          error={courses.isError}
          value={track}
          onChange={setTrack}
        />
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
                Loaded the first {minors.data.loaded} enrollments, then kept minors in{' '}
                {CORE_PROGRAM}. Later pages are not included.
              </p>
            ) : null}
            <p className="mb-3 text-sm text-muted-foreground">
              {filtered.length} minors in {CORE_PROGRAM} · {missing} without guardian
              consent
            </p>
            <DataTable
              columns={columns}
              data={filtered}
              empty={
                track
                  ? 'No minors match that course'
                  : `No minors in ${CORE_PROGRAM} yet`
              }
            />
          </>
        ) : null}
      </QueryBody>
    </div>
  )
}

async function loadMinors() {
  const collected = await loadEnrollments()
  const inProgram = peopleInProgram(collected.items)
  return {
    items: inProgram.filter((item) => item.isMinor),
    loaded: collected.items.length,
    truncated: collected.truncated,
  }
}
