import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { sessionQuery } from '@/queries/auth/session'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (!user) throw redirect({ to: '/auth/signin' })
    return { user }
  },
  component: () => <Outlet />,
})
