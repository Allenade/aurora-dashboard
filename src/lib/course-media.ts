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

/** Blank text clears the syllabus text. A long value is refused before it is sent. */
export function syllabusTextBody(
  text: string,
): { text: string | null } | { error: string } {
  if (text.trim().length > COURSE_SYLLABUS_TEXT_MAX_CHARS) {
    return { error: 'Week-by-week topics must be 50,000 characters or fewer.' }
  }
  if (!text.trim()) return { text: null }
  return { text }
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
