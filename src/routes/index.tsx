import { createFileRoute, redirect } from '@tanstack/react-router'
import { sessionQuery } from '@/queries/auth/session'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    throw redirect({ to: user ? '/compliance' : '/auth/signin' })
  },
})
