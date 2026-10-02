export type ApiErrorBody = {
  statusCode: number
  error: string
  message: string
  details?: string[]
  path?: string
  timestamp?: string
  requestId?: string
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody }

export class ApiError extends Error {
  statusCode: number
  details?: string[]

  constructor(error: ApiErrorBody) {
    super(error.message)
    this.name = 'ApiError'
    this.statusCode = error.statusCode
    this.details = error.details
  }
}

export function apiError(
  statusCode: number,
  message: string,
  extra?: Partial<ApiErrorBody>,
): ApiErrorBody {
  return {
    statusCode,
    error: extra?.error ?? statusText(statusCode),
    message,
    details: extra?.details,
    path: extra?.path,
    timestamp: extra?.timestamp ?? new Date().toISOString(),
    requestId: extra?.requestId,
  }
}

export const UNREACHABLE_MESSAGE =
  'Could not reach the server. Check that it is running, then try again.'

export function fail<T = never>(
  statusCode: number,
  message: string,
  extra?: Partial<ApiErrorBody>,
): Result<T> {
  return { ok: false, error: apiError(statusCode, message, extra) }
}

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function normalizeError(status: number, payload: unknown, path?: string) {
  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : typeof body.message === 'string'
        ? body.message
        : statusText(status)
    return apiError(status, message, {
      error: typeof body.error === 'string' ? body.error : statusText(status),
      details: Array.isArray(body.details)
        ? body.details.filter((item): item is string => typeof item === 'string')
        : undefined,
      path: typeof body.path === 'string' ? body.path : path,
      timestamp: typeof body.timestamp === 'string' ? body.timestamp : undefined,
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    })
  }
  return apiError(status, statusText(status), { path })
}

function statusText(status: number) {
  if (status === 400) return 'Bad Request'
  if (status === 401) return 'Unauthorized'
  if (status === 403) return 'Forbidden'
  if (status === 404) return 'Not Found'
  if (status === 409) return 'Conflict'
  if (status >= 500) return 'Server Error'
  return 'Request failed'
}
