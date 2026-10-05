import { useEffect, useMemo } from 'react'
import { courseOptions } from '@/lib/registrant-filters'

const selectClass = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm'

/**
 * Course filter. Options are the courses argument only, which callers fill
 * from the courses API. An empty list stays empty.
 */
export function CourseSelect({
  courses,
  loading,
  error,
  value,
  onChange,
}: {
  courses: Array<{ slug: string; name: string }> | undefined
  loading: boolean
  error: boolean
  value: string
  onChange: (slug: string) => void
}) {
  const options = useMemo(() => courseOptions(courses ?? []), [courses])

  useEffect(() => {
    if (loading || error) return
    if (value && !options.some(([slug]) => slug === value)) onChange('')
  }, [error, loading, onChange, options, value])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading courses.</p>
  }
  if (error) {
    return <p className="text-sm text-destructive">Courses could not be loaded.</p>
  }
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">No courses yet.</p>
  }

  return (
    <select
      aria-label="Course"
      className={selectClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">All courses</option>
      {options.map(([slug, name]) => (
        <option key={slug} value={slug}>
          {name}
        </option>
      ))}
    </select>
  )
}
