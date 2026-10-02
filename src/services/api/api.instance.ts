export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export type ApiQuery = Record<string, string | number | boolean | null | undefined>

export type ApiRequest = {
  method: HttpMethod
  path: string
  query?: ApiQuery
  body?: unknown
}

export function backendOrigin() {
  return (process.env.BACKEND_URL ?? '').replace(/\/$/, '')
}

export function apiV1Url(path: string, query?: ApiQuery) {
  const origin = backendOrigin()
  if (!origin) throw new Error('BACKEND_URL is not set.')
  const suffix = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${origin}/api/v1${suffix}`)
  appendQuery(url, query)
  return url
}

export function appendQuery(url: URL, query?: ApiQuery) {
  if (!query) return
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }
}

export function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 32) return secret
  throw new Error('SESSION_SECRET must be at least 32 characters')
}
