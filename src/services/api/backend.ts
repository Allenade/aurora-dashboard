import { fail, normalizeError, ok, UNREACHABLE_MESSAGE, type Result } from '@/services/api/api.error'
import { apiV1Url, type ApiRequest } from '@/services/api/api.instance'
import { getAppSession } from '@/server/session'

export async function backendExecute(request: ApiRequest): Promise<Result<unknown>> {
  const session = await getAppSession()
  const first = await send(request, session.data.accessToken)
  if (first.status !== 401 || !session.data.refreshToken) return first.result
  const refreshed = await refresh(session.data.refreshToken)
  if (!refreshed) {
    await session.clear()
    return fail(401, 'Session expired', { path: request.path })
  }
  await session.update({
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
  })
  return (await send(request, refreshed.accessToken)).result
}

async function send(request: ApiRequest, accessToken?: string) {
  if (!accessToken) {
    return { status: 401, result: fail(401, 'Unauthorized', { path: request.path }) }
  }
  let url: URL
  try {
    url = apiV1Url(request.path, request.query)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'BACKEND_URL is not set.'
    return { status: 503, result: fail(503, message, { path: request.path }) }
  }
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` })
  let body: BodyInit | undefined
  if (request.body instanceof FormData) {
    body = request.body
  } else if (request.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(request.body)
  }
  try {
    const response = await fetch(url, { method: request.method, headers, body })
    const result = await readResponse(response, request.path)
    return { status: response.status, result }
  } catch {
    return {
      status: 503,
      result: fail(503, UNREACHABLE_MESSAGE, { path: request.path }),
    }
  }
}

async function readResponse(response: Response, path: string): Promise<Result<unknown>> {
  const type = response.headers.get('content-type') ?? ''
  if (type.includes('text/csv') || path === '/admin/compliance/export') {
    const text = await response.text()
    if (!response.ok) return fail(response.status, text || 'Export failed', { path })
    return ok(text)
  }
  const payload = await readJson(response)
  if (!response.ok) return { ok: false, error: normalizeError(response.status, payload, path) }
  return ok(payload)
}

async function refresh(refreshToken: string) {
  let response: Response
  try {
    response = await fetch(apiV1Url('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
  } catch {
    return null
  }
  if (!response.ok) return null
  const payload = (await response.json()) as { accessToken?: string; refreshToken?: string }
  if (!payload.accessToken || !payload.refreshToken) return null
  return { accessToken: payload.accessToken, refreshToken: payload.refreshToken }
}

async function readJson(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text }
  }
}
