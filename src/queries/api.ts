import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, type Result } from '@/services/api/api.error'
import type { ApiQuery, ApiRequest, HttpMethod } from '@/services/api/api.instance'
import { callApi } from '@/server/call-api'

export async function api<T>(request: ApiRequest): Promise<T> {
  const query = cleanQuery(request.query)
  const wire = await callApi({
    data: {
      method: request.method,
      path: request.path,
      query,
      body: request.body,
    },
  })
  const result = JSON.parse(wire.payload) as Result<T>
  if (!result.ok) throw new ApiError(result.error)
  return result.data
}

function cleanQuery(query?: ApiQuery) {
  if (!query) return undefined
  const next: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) next[key] = value
  }
  return next
}

export function useApiMutation<T>(
  request: (variables: { method: HttpMethod; path: string; query?: ApiQuery; body?: unknown }) => ApiRequest,
  invalidate: ReadonlyArray<readonly unknown[]> = [],
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (variables: { method: HttpMethod; path: string; query?: ApiQuery; body?: unknown }) =>
      api<T>(request(variables)),
    onSuccess: async () => {
      await Promise.all(invalidate.map((key) => client.invalidateQueries({ queryKey: key })))
    },
  })
}

export { ApiError }
