import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { UNREACHABLE_MESSAGE } from '@/services/api/api.error'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Core 3.0 Compliance' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: 'data:,' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Orbitron:wght@500;700&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  errorComponent: RootError,
})

function RootError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'The page could not be loaded.'
  const unreachable = message === UNREACHABLE_MESSAGE || message === 'BACKEND_URL is not set.'
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-destructive/40 bg-card p-6">
        <p className="font-display text-sm tracking-[0.18em]">AURORA</p>
        <h1 className="mt-4 text-lg font-semibold">
          {unreachable ? 'The server could not be reached' : 'Something went wrong'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  )
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
