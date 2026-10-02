import { normalizeError, type Result } from '@/services/api/api.error'
import { appendQuery, type ApiQuery, type HttpMethod } from '@/services/api/api.instance'

type ClientOptions = {
  method?: HttpMethod
  query?: ApiQuery
  body?: unknown
  formData?: FormData
}

export async function apiClient<T>(
  path: string,
  options: ClientOptions = {},
): Promise<Result<T>> {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, window.location.origin)
  if (!url.pathname.startsWith('/api/bff')) {
    url.pathname = `/api/bff${url.pathname}`
  }
  appendQuery(url, options.query)
  const headers = new Headers()
  headers.set('accept', 'application/json')
  let body: BodyInit | undefined
  if (options.formData) {
    body = options.formData
  } else if (options.body !== undefined) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(options.body)
  }
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body,
    credentials: 'include',
  })
  return readResult<T>(response)
}

export async function readResult<T>(response: Response): Promise<Result<T>> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok) {
    const payload = contentType.includes('json') ? await safeJson(response) : null
    return {
      ok: false,
      error: normalizeError(response.status, payload, new URL(response.url).pathname),
    }
  }
  if (contentType.includes('json')) {
    return { ok: true, data: (await response.json()) as T }
  }
  return { ok: true, data: (await response.text()) as T }
}

async function safeJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}
