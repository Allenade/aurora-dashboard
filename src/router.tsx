import { QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { NotFound } from '@/components/states'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError } from '@/services/api/api.error'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  let signingOut = false
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        // The session ended on the server. Send the user back to sign in
        // instead of leaving every page showing an error.
        if (
          error instanceof ApiError &&
          error.statusCode === 401 &&
          typeof window !== 'undefined'
        ) {
          if (signingOut || window.location.pathname.startsWith('/auth/')) return
          signingOut = true
          queryClient.removeQueries({ queryKey: queryKeys.session })
          void router.navigate({ to: '/auth/signin', replace: true }).finally(() => {
            queryClient.clear()
            signingOut = false
          })
        }
      },
    }),
    defaultOptions: {
      queries: { staleTime: 15_000, retry: false },
    },
  })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultNotFoundComponent: NotFound,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
