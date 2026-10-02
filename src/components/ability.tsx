import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { allows, defineAbilityFor, type AppAbility, type AppAction, type AppSubject } from '@/lib/ability'
import type { SessionUser } from '@/queries/auth/interfaces/session.dto'

const AbilityContext = createContext<AppAbility>(defineAbilityFor(null))
const UserContext = createContext<SessionUser | null>(null)

export function AbilityProvider({
  user,
  children,
}: {
  user: SessionUser
  children: ReactNode
}) {
  const ability = useMemo(() => defineAbilityFor(user), [user])
  return (
    <UserContext.Provider value={user}>
      <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
    </UserContext.Provider>
  )
}

export function useAbility() {
  return useContext(AbilityContext)
}

export function useSessionUser() {
  return useContext(UserContext)
}

export function Can({
  action,
  subject,
  children,
}: {
  action: AppAction
  subject: AppSubject
  children: ReactNode
}) {
  const ability = useAbility()
  if (!allows(ability, action, subject)) return null
  return children
}
