import { createFileRoute, Outlet, useRouteContext } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AbilityProvider } from '@/components/ability'
import { CommandPalette } from '@/components/command-palette'
import {
  ComplianceSidebar,
  type BadgeKey,
} from '@/components/navigation/compliance.sidebar'
import { ComplianceNavbar } from '@/components/navigation/compliance.navbar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { loadEnrollments } from '@/lib/load-enrollments'
import { peopleInProgram } from '@/lib/program'
import { queryKeys } from '@/lib/query-keys.factory'
import { useUiStore } from '@/lib/ui-store'
import { api } from '@/queries/api'
import type {
  ComplianceSummary,
  ComplianceTests,
  DataRequest,
} from '@/queries/compliance/interfaces/compliance.dto'
import type { AdminCourse } from '@/queries/courses/interfaces/course.dto'
import type { EmailCampaign } from '@/queries/emails/interfaces/email.dto'
import type { RefundRequest } from '@/queries/refunds/interfaces/refund.dto'
import type { OrganizationSettings } from '@/queries/settings/interfaces/settings.dto'
export const Route = createFileRoute('/_authenticated/compliance')({
  component: ComplianceLayout,
})

function ComplianceLayout() {
  const { user } = useRouteContext({ from: '/_authenticated' })
  const navOpen = useUiStore((state) => state.navOpen)
  const setNavOpen = useUiStore((state) => state.setNavOpen)
  const badges = useBadges()

  return (
    <AbilityProvider user={user}>
      <div className="flex min-h-screen bg-background">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 overflow-y-auto border-r border-border md:block">
          <ComplianceSidebar badges={badges} />
        </aside>
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="w-64 bg-black p-0">
            <ComplianceSidebar badges={badges} onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <ComplianceNavbar />
          <main className="flex-1 px-3 py-4 md:px-6 md:py-6">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette />
    </AbilityProvider>
  )
}

function useBadges(): Partial<Record<BadgeKey, number>> {
  const summary = useQuery({
    queryKey: queryKeys.compliance.summary(),
    queryFn: () =>
      api<ComplianceSummary>({ method: 'GET', path: '/admin/compliance/summary' }),
  })
  const courses = useQuery({
    queryKey: queryKeys.courses.all,
    queryFn: () => api<AdminCourse[]>({ method: 'GET', path: '/admin/courses' }),
  })
  const refunds = useQuery({
    queryKey: queryKeys.refunds.all,
    queryFn: () => api<RefundRequest[]>({ method: 'GET', path: '/admin/refunds' }),
  })
  const tests = useQuery({
    queryKey: queryKeys.compliance.tests,
    queryFn: () =>
      api<ComplianceTests>({ method: 'GET', path: '/admin/compliance/tests' }),
  })
  const requests = useQuery({
    queryKey: queryKeys.compliance.dataRequests,
    queryFn: () =>
      api<DataRequest[]>({ method: 'GET', path: '/admin/compliance/data-requests' }),
  })
  const campaigns = useQuery({
    queryKey: queryKeys.emails.campaigns,
    queryFn: () =>
      api<EmailCampaign[]>({ method: 'GET', path: '/admin/emails/campaigns' }),
  })
  const settings = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () =>
      api<OrganizationSettings>({
        method: 'GET',
        path: '/admin/settings/organization',
      }),
  })
  const minors = useQuery({
    queryKey: ['enrollments', 'minor-count'],
    queryFn: () => countMinors(),
  })
  const policyGaps = settings.data
    ? [
        settings.data.termsUrl,
        settings.data.privacyUrl,
        settings.data.marketingPolicyUrl,
      ].filter((url) => !url).length
    : 0
  return {
    courses: courses.data?.length,
    emails: campaigns.data?.filter(
      (row) => row.status === 'sending' || row.status === 'queued',
    ).length,
    payments: summary.data?.exceptions,
    refunds: refunds.data?.filter((row) => row.status === 'requested').length,
    consent: policyGaps || undefined,
    minors: minors.data,
    requests: requests.data?.filter(
      (row) => row.status === 'open' || row.status === 'in_progress',
    ).length,
    controls: tests.data?.checks.filter((check) => !check.pass).length,
    claims: summary.data?.exceptions,
  }
}

async function countMinors() {
  const collected = await loadEnrollments({}, { maxPages: 8 })
  return peopleInProgram(collected.items).filter((row) => row.isMinor).length
}
