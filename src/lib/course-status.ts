const KNOWN_LABEL: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived',
}

/** Turn API status values into the words shown in the dashboard. */
export function courseStatusLabel(status: string | null | undefined) {
  const folded = foldStatus(status)
  if (folded === 'past cutoff') return 'Closed'
  return KNOWN_LABEL[folded] ?? titleCase(status)
}

/** Status value for the course form. Past cutoff is edited as Closed. */
export function editableCourseStatus(status: string | null | undefined) {
  const folded = foldStatus(status)
  if (folded === 'past cutoff' || folded === 'closed') return 'closed' as const
  if (folded === 'draft' || folded === 'open' || folded === 'archived') return folded
  return 'closed' as const
}

function foldStatus(status: string | null | undefined) {
  return (status ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function titleCase(status: string | null | undefined) {
  const raw = (status ?? '').trim()
  if (!raw) return ''
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
