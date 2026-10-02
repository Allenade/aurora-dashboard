import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getSessionUser } from '@/server/auth'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const user = await getSessionUser()
    if (!user) throw redirect({ to: '/auth/signin' })
    return { user }
  },
  component: () => <Outlet />,
})
