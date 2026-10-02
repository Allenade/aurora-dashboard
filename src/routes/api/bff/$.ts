import { createFileRoute } from '@tanstack/react-router'
import { backendExecute } from '@/services/api/backend'
import { executeApi } from '@/services/api/execute'
import type { HttpMethod } from '@/services/api/api.instance'

export const Route = createFileRoute('/api/bff/$')({
  server: {
    handlers: {
      GET: ({ request }) => proxy(request),
      POST: ({ request }) => proxy(request),
      PATCH: ({ request }) => proxy(request),
      PUT: ({ request }) => proxy(request),
      DELETE: ({ request }) => proxy(request),
    },
  },
})

async function proxy(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/bff/, '') || '/'
  if (path.startsWith('/auth/login') || path.startsWith('/auth/refresh')) {
    return Response.json(
      { statusCode: 403, error: 'Forbidden', message: 'Use the sign-in form' },
      { status: 403 },
    )
  }
  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })
  const method = request.method as HttpMethod
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const result = await backendExecute({ method, path, query, body: form })
    if (!result.ok) return Response.json(result.error, { status: result.error.statusCode })
    return Response.json(result.data)
  }
  let body: unknown
  if (method !== 'GET' && method !== 'DELETE' && contentType.includes('application/json')) {
    body = await request.json().catch(() => ({}))
  }
  const result = await executeApi({ method, path, query, body })
  if (!result.ok) return Response.json(result.error, { status: result.error.statusCode })
  if (method === 'GET' && path === '/admin/compliance/export' && typeof result.data === 'string') {
    return new Response(result.data, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="core30-enrollments.csv"',
      },
    })
  }
  return Response.json(result.data)
}
