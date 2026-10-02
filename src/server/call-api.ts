import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { executeApi } from '@/services/api/execute'

const ApiInput = z.object({
  method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']),
  path: z.string().min(1),
  query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  body: z.unknown().optional(),
})

export const callApi = createServerFn({ method: 'POST' })
  .validator(ApiInput)
  .handler(async ({ data }) => {
    const result = await executeApi({
      method: data.method,
      path: data.path,
      query: data.query,
      body: data.body,
    })
    return { payload: JSON.stringify(result) }
  })
