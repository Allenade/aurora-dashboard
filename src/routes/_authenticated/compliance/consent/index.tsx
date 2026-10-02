import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, QueryBody } from '@/components/states'
import { formatPercent } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { api } from '@/queries/api'
import type { ComplianceSummary } from '@/queries/compliance/interfaces/compliance.dto'
import type { OrganizationSettings } from '@/queries/settings/interfaces/settings.dto'

export const Route = createFileRoute('/_authenticated/compliance/consent/')({
  component: ConsentPage,
})

function ConsentPage() {
  const summary = useQuery({
    queryKey: queryKeys.compliance.summary(),
    queryFn: () => api<ComplianceSummary>({ method: 'GET', path: '/admin/compliance/summary' }),
  })
  const settings = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api<OrganizationSettings>({ method: 'GET', path: '/admin/settings/organization' }),
  })
  const policies = settings.data
    ? [
        ['Terms', settings.data.termsUrl, settings.data.termsVersion],
        ['Privacy', settings.data.privacyUrl, settings.data.privacyVersion],
        ['Marketing', settings.data.marketingPolicyUrl, ''],
      ]
    : []
  return (
    <div>
      <PageHeader
        eyebrow="CONSENT"
        title="Consent and policies"
        description="Consent lives on each enrollment. Policy URLs live in organization settings."
      />
      <QueryBody loading={summary.isLoading || settings.isLoading} error={summary.error ?? settings.error}>
        {summary.data ? (
          <div className="space-y-4">
            <p className="font-mono text-2xl">{formatPercent(summary.data.consentPercent, 1)}</p>
            <p className="text-sm text-muted-foreground">
              Share of enrollments in the default window with consentAt.
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {policies.map(([name, url, version]) => (
                <li key={name} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{name}</span>
                  <span className={url ? 'font-mono text-xs' : 'text-destructive'}>
                    {url ? `${version || 'url set'}` : 'Not configured'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </QueryBody>
    </div>
  )
}
