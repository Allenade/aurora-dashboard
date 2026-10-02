import { queryOptions, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys.factory'
import { getSessionUser, logout } from '@/server/auth'

/**
 * The signed-in user, cached so route guards do not call /auth/me on every
 * navigation or link preload. API calls still carry the session cookie, and a
 * 401 from any of them sends the user back to sign in.
 */
export const sessionQuery = queryOptions({
  queryKey: queryKeys.session,
  queryFn: () => getSessionUser(),
  staleTime: 5 * 60_000,
})

export function useSignOut() {
  const router = useRouter()
  const client = useQueryClient()
  const [pending, setPending] = useState(false)

  async function signOut() {
    if (pending) return
    setPending(true)
    try {
      await logout()
    } catch {
      toast.error('Could not reach the server. You are signed out on this device.')
    }
    // Drop the cached user first so the sign-in guard does not send us back.
    client.removeQueries({ queryKey: queryKeys.session })
    await router.navigate({ to: '/auth/signin', replace: true })
    client.clear()
    setPending(false)
  }

  return { signOut, pending }
}
