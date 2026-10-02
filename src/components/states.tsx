import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { UNREACHABLE_MESSAGE } from '@/services/api/api.error'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="font-display text-[10px] tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function QueryBody({
  loading,
  error,
  children,
}: {
  loading: boolean
  error: Error | null
  children: ReactNode
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (error) {
    const unreachable = error.message === UNREACHABLE_MESSAGE || error.message === 'BACKEND_URL is not set.'
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
        <p className="font-medium text-destructive">
          {unreachable ? 'The server could not be reached' : 'This page could not load'}
        </p>
        <p className="mt-1 text-destructive/90">{error.message}</p>
      </div>
    )
  }
  return children
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
