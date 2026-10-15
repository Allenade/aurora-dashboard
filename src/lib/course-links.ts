import type { CourseLink } from '@/queries/courses/interfaces/course.dto'

export const LINK_NAME_REQUIRED = 'Add a name for this button.'
export const LINK_URL_INVALID = 'Use a full https:// link.'
export const LINKS_FORM_ERROR = 'Check the links.'

export type CourseLinkDraft = {
  key: string
  label: string
  url: string
}

let nextKey = 0

export function newLinkKey() {
  nextKey += 1
  return `link-${nextKey}`
}

/** A full https:// address with a real host, such as https://docs.google.com/... */
export function isHttpsLink(value: string) {
  const raw = value.trim()
  if (!raw) return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && Boolean(url.hostname) && url.hostname.includes('.')
  } catch {
    return false
  }
}

/** Blank rows are fine. A name without a full https:// link, or a link without a name, is not. */
export function courseLinkError(row: { label: string; url: string }) {
  const label = row.label.trim()
  const url = row.url.trim()
  if (!label && !url) return null
  if (!label) return LINK_NAME_REQUIRED
  if (!isHttpsLink(url)) return LINK_URL_INVALID
  return null
}

export function draftsFromLinks(
  links: readonly CourseLink[] | null | undefined,
): CourseLinkDraft[] {
  if (!links?.length) return []
  return links.map((link) => ({
    key: newLinkKey(),
    label: link.label ?? '',
    url: link.url ?? '',
  }))
}

export function prepareCourseLinks(
  rows: readonly { key: string; label: string; url: string }[],
): { ok: true; links: CourseLink[] } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const links: CourseLink[] = []
  for (const row of rows) {
    const label = row.label.trim()
    const url = row.url.trim()
    if (!label && !url) continue
    const problem = courseLinkError({ label, url })
    if (problem) {
      errors[row.key] = problem
      continue
    }
    links.push({ label, url })
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, links }
}

export function moveLink<T>(items: readonly T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (index < 0 || target < 0 || index >= items.length || target >= items.length) {
    return items.slice()
  }
  const next = items.slice()
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item as T)
  return next
}
