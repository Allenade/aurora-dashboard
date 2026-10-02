import { fail, type Result } from '@/services/api/api.error'
import type { ApiRequest } from '@/services/api/api.instance'
import { backendExecute } from '@/services/api/backend'
import { getAppSession } from '@/server/session'
import type { SessionUser } from '@/queries/auth/interfaces/session.dto'

export async function currentSessionUser(): Promise<SessionUser | null> {
  const session = await getAppSession()
  if (!session.data.accessToken) return null
  const result = await backendExecute({ method: 'GET', path: '/auth/me' })
  if (!result.ok) {
    if (result.error.statusCode === 503) throw new Error(result.error.message)
    return null
  }
  return result.data as SessionUser
}

export async function executeApi(request: ApiRequest): Promise<Result<unknown>> {
  const user = await currentSessionUser()
  if (!user) return fail(401, 'Unauthorized', { path: request.path })
  return backendExecute(request)
}
