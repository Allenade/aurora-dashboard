import { ApiError, normalizeError, UNREACHABLE_MESSAGE } from '@/services/api/api.error'
import type {
  AdminCourse,
  CourseSyllabus,
} from '@/queries/courses/interfaces/course.dto'

export const COURSE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const COURSE_SYLLABUS_PDF_MAX_BYTES = 10 * 1024 * 1024
export const COURSE_SYLLABUS_TEXT_MAX_CHARS = 50_000

export const IMAGE_UPLOAD_UNAVAILABLE = "Image upload isn't set up yet"
export const SYLLABUS_UPLOAD_UNAVAILABLE = "Syllabus upload isn't set up yet"

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
])
const PDF_TYPES = new Set(['application/pdf', 'application/x-pdf'])
const STORAGE_UNAVAILABLE = /storage is not configured|cloudflare r2|isn't set up/i

type NamedFile = {
  name: string
  type: string
  size: number
}

export function httpUrl(value?: string | null) {
  const url = value?.trim()
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) return null
  return url
}

export function readCourseMedia(course: {
  imageUrl?: string | null
  syllabus?: Partial<CourseSyllabus> | null
}): { imageUrl: string | null; syllabus: CourseSyllabus } {
  const text = course.syllabus?.text
  return {
    imageUrl: httpUrl(course.imageUrl),
    syllabus: {
      url: httpUrl(course.syllabus?.url),
      filename: course.syllabus?.filename?.trim() || null,
      text: typeof text === 'string' && text.trim() ? text : null,
    },
  }
}

export function imageFileError(file: NamedFile) {
  if (file.size > COURSE_IMAGE_MAX_BYTES) return 'Pictures must be 5 MB or smaller.'
  const type = file.type.toLowerCase().split(';')[0].trim()
  if (IMAGE_TYPES.has(type)) return null
  const namedOk = /\.(jpe?g|png|webp)$/i.test(file.name)
  if ((!type || type === 'application/octet-stream') && namedOk) return null
  return 'Use a JPEG, PNG, or WebP picture.'
}

export function syllabusFileError(file: NamedFile) {
  if (file.size > COURSE_SYLLABUS_PDF_MAX_BYTES) {
    return 'The syllabus PDF must be 10 MB or smaller.'
  }
  const type = file.type.toLowerCase().split(';')[0].trim()
  if (PDF_TYPES.has(type)) return null
  const namedPdf = file.name.toLowerCase().endsWith('.pdf')
  if ((!type || type === 'application/octet-stream') && namedPdf) return null
  return 'Use a PDF.'
}

type SyllabusGroup = {
  heading: string | null
  items: string[]
}

/** A line ending in ":" or starting with "#" is a heading. A blank line starts a new group. */
export function syllabusLinesToHtml(source: string) {
  const groups: SyllabusGroup[] = []
  let current: SyllabusGroup = { heading: null, items: [] }
  const flush = () => {
    if (current.heading || current.items.length) groups.push(current)
    current = { heading: null, items: [] }
  }
  for (const raw of source.split(/\r\n|\n|\r/)) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const heading = syllabusHeading(line)
    if (heading) {
      if (current.heading || current.items.length) flush()
      current.heading = heading
      continue
    }
    current.items.push(line)
  }
  flush()
  return groups
    .map((group) => {
      const parts: string[] = []
      if (group.heading) parts.push(`<h2>${escapeHtml(group.heading)}</h2>`)
      if (group.items.length) {
        const items = group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
        parts.push(`<ul>${items}</ul>`)
      }
      return parts.join('')
    })
    .join('')
}

/** Stored syllabus HTML becomes one editable line per heading or topic. */
export function syllabusHtmlToLines(value: string) {
  const source = value.replace(/\r\n/g, '\n')
  if (!/<\s*(?:h[2-4]|ul|ol|li|p|br|div)\b/i.test(source)) return source.trim()
  const lines: string[] = []
  let last: 'none' | 'heading' | 'item' = 'none'
  let listOpen = false
  const blocks =
    /<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>|<li\b[^>]*>([\s\S]*?)<\/li>|<p\b[^>]*>([\s\S]*?)<\/p>|<br\s*\/?>|<\/ul>|<\/ol>|<ul\b[^>]*>|<ol\b[^>]*>/gi
  for (const match of source.matchAll(blocks)) {
    const tag = match[0]
    if (/^<ul\b/i.test(tag) || /^<ol\b/i.test(tag)) {
      if (!listOpen && last === 'item') lines.push('')
      listOpen = true
      continue
    }
    if (/^<\/ul/i.test(tag) || /^<\/ol/i.test(tag)) {
      listOpen = false
      continue
    }
    if (/^<br/i.test(tag)) {
      if (last !== 'none') lines.push('')
      last = 'none'
      listOpen = false
      continue
    }
    const text = visibleHtmlText(match[2] ?? match[3] ?? match[4] ?? '')
    if (!text) continue
    if (/^<h[2-4]/i.test(tag)) {
      if (last === 'item' || last === 'heading') lines.push('')
      lines.push(text.endsWith(':') || text.startsWith('#') ? text : `# ${text}`)
      last = 'heading'
      listOpen = false
      continue
    }
    lines.push(text)
    last = 'item'
  }
  const parsed = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (parsed) return parsed
  return visibleHtmlText(source)
}

/** Blank text clears the syllabus text. Lines are stored as headings and lists. */
export function syllabusTextBody(
  text: string,
): { text: string | null } | { error: string } {
  const html = syllabusLinesToHtml(text)
  if (!html) return { text: null }
  if (html.length > COURSE_SYLLABUS_TEXT_MAX_CHARS) {
    return { error: 'Week-by-week topics must be 50,000 characters or fewer.' }
  }
  return { text: html }
}

function syllabusHeading(line: string) {
  if (line.startsWith('#')) {
    const text = line.replace(/^#+\s*/, '').trim()
    return text || null
  }
  if (line.endsWith(':')) return line
  return null
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function visibleHtmlText(value: string) {
  const stripped = value.replace(/<[^>]+>/g, ' ')
  return decodeHtml(stripped).replace(/\s+/g, ' ').trim()
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
}

export function courseUploadErrorMessage(
  status: number,
  serverMessage: string,
  kind: 'image' | 'pdf',
) {
  const message = serverMessage.trim()
  if (status === 503 && (message === '' || STORAGE_UNAVAILABLE.test(message))) {
    return kind === 'image' ? IMAGE_UPLOAD_UNAVAILABLE : SYLLABUS_UPLOAD_UNAVAILABLE
  }
  if (status === 413) {
    return kind === 'image'
      ? 'Pictures must be 5 MB or smaller.'
      : 'The syllabus PDF must be 10 MB or smaller.'
  }
  if (status === 400) {
    if (message) return message
    return kind === 'image' ? 'Use a JPEG, PNG, or WebP picture.' : 'Use a PDF.'
  }
  return message || 'Upload failed.'
}

export function syllabusTextProblem(status: number, serverMessage: string) {
  const message = serverMessage.trim()
  if (status === 400) return message || 'That text could not be saved.'
  return message || 'Could not save the topics.'
}

export async function uploadCourseFile(
  path: string,
  file: File,
  kind: 'image' | 'pdf',
): Promise<AdminCourse> {
  const form = new FormData()
  form.append('file', file)
  let response: Response
  try {
    response = await fetch(`/api/bff${path}`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    })
  } catch {
    throw new Error(UNREACHABLE_MESSAGE)
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = normalizeError(response.status, payload, path)
    throw new Error(courseUploadErrorMessage(error.statusCode, error.message, kind))
  }
  if (!payload || typeof payload !== 'object') throw new Error('Upload failed.')
  return payload as AdminCourse
}

export function mediaErrorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message || fallback
  if (err instanceof Error && err.message) return err.message
  return fallback
}
