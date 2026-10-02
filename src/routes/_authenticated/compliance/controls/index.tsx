import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, QueryBody } from '@/components/states'
import { queryKeys } from '@/lib/query-keys.factory'
import { api } from '@/queries/api'
import type { ComplianceTests } from '@/queries/compliance/interfaces/compliance.dto'

export const Route = createFileRoute('/_authenticated/compliance/controls/')({
  component: ControlsPage,
})

function ControlsPage() {
  const tests = useQuery({
    queryKey: queryKeys.compliance.tests,
    queryFn: () => api<ComplianceTests>({ method: 'GET', path: '/admin/compliance/tests' }),
  })
  return (
    <div>
      <PageHeader
        eyebrow="CONTROLS"
        title="Controls"
        description="Webhook signature, Paystack key, consent capture, policy pages, and rate limiting."
      />
      <QueryBody loading={tests.isLoading} error={tests.error}>
        {tests.data ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {tests.data.checks.map((check) => (
              <li key={check.id} className="px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">{check.name}</p>
                  <span className={check.pass ? 'text-sm text-primary' : 'text-sm text-destructive'}>
                    {check.pass ? 'Pass' : 'Fail'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </QueryBody>
      <p className="mt-4 text-sm text-muted-foreground">
        Bank transfer callback is retired. Payments confirm through Paystack only, including Pay with Transfer.
      </p>
    </div>
  )
}
