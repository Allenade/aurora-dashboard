import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { apiV1Url } from '@/services/api/api.instance'
import { fail, ok, normalizeError, UNREACHABLE_MESSAGE } from '@/services/api/api.error'
import { getAppSession } from '@/server/session'
import { currentSessionUser } from '@/services/api/execute'
import type { LoginResponse } from '@/queries/auth/interfaces/session.dto'

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
})

export const getSessionUser = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await currentSessionUser()
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    type: user.type,
    avatarUrl: user.avatarUrl ?? null,
    roles: user.roles.map((role) => ({
      id: role.id,
      slug: role.slug,
      name: role.name,
    })),
    permissions: user.permissions.map((permission) => ({
      action: permission.action,
      resource: permission.resource,
    })),
    rules: user.rules.map((rule) => ({
      action: Array.isArray(rule.action) ? rule.action.join(',') : rule.action,
      subject: Array.isArray(rule.subject) ? rule.subject.join(',') : rule.subject,
      inverted: Boolean(rule.inverted),
    })),
  }
})

export const login = createServerFn({ method: 'POST' })
  .validator(LoginInput)
  .handler(async ({ data }) => {
    const session = await getAppSession()
    let response: Response
    try {
      response = await fetch(apiV1Url('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          rememberMe: data.rememberMe,
        }),
      })
    } catch (error) {
      const message = error instanceof Error && error.message === 'BACKEND_URL is not set.'
        ? error.message
        : UNREACHABLE_MESSAGE
      return fail(503, message)
    }
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return { ok: false, error: normalizeError(response.status, payload, '/auth/login') }
    }
    const body = payload as LoginResponse
    await session.update({
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      rememberMe: data.rememberMe,
    })
    return ok({ user: body.user })
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await getAppSession()
  if (session.data.accessToken) {
    try {
      await fetch(apiV1Url('/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.data.accessToken}` },
      })
    } catch {
      // The local session still ends if the server cannot be reached.
    }
  }
  await session.clear()
  return ok({ ok: true })
})
