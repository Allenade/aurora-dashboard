import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { PageHeader, QueryBody } from '@/components/states'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCount, formatNaira, formatPercent } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { last30Days } from '@/lib/range'
import { api } from '@/queries/api'
import type {
  ComplianceSummary,
  ComplianceTests,
  TimelinePoint,
} from '@/queries/compliance/interfaces/compliance.dto'

export const Route = createFileRoute('/_authenticated/compliance/')({
  component: OverviewPage,
})

const chartConfig = {
  collected: { label: 'Collected', color: '#c6ff00' },
} satisfies ChartConfig

const once = {
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
}

function OverviewPage() {
  const query = last30Days()
  const summary = useQuery({
    queryKey: queryKeys.compliance.summary(query.from, query.to),
    queryFn: () =>
      api<ComplianceSummary>({
        method: 'GET',
        path: '/admin/compliance/summary',
        query,
      }),
    ...once,
  })
  const timeline = useQuery({
    queryKey: queryKeys.compliance.timeline(query.from, query.to),
    queryFn: () =>
      api<TimelinePoint[]>({
        method: 'GET',
        path: '/admin/compliance/timeline',
        query,
      }),
    ...once,
  })
  const tests = useQuery({
    queryKey: queryKeys.compliance.tests,
    queryFn: () =>
      api<ComplianceTests>({ method: 'GET', path: '/admin/compliance/tests' }),
    ...once,
  })
  const passed = tests.data?.checks.filter((check) => check.pass).length ?? 0
  const total = tests.data?.checks.length ?? 0
  const score = total ? Math.round((passed / total) * 100) : 0
  const counts = summary.data?.countsByStatus ?? {}
  const enrolled =
    (counts.success?.count ?? 0) +
    (counts.pending?.count ?? 0) +
    (counts.failed?.count ?? 0) +
    (counts.refunded?.count ?? 0)
  const paid = counts.success?.count ?? 0

  return (
    <div>
      <PageHeader
        eyebrow="COMPLIANCE"
        title="Overview"
        description="Last 30 days of enrollment health, from the compliance summary, timeline, and control checks."
      />
      <QueryBody
        loading={summary.isLoading || tests.isLoading}
        error={summary.error ?? tests.error}
      >
        {summary.data && tests.data ? (
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
              {tests.data.checks.map((check) => (
                <div
                  key={check.id}
                  className="rounded-lg border border-border bg-card px-3 py-2"
                >
                  <p className="text-xs text-muted-foreground">{check.name}</p>
                  <p
                    className={
                      check.pass
                        ? 'mt-1 text-sm text-primary'
                        : 'mt-1 text-sm text-destructive'
                    }
                  >
                    {check.pass ? 'Pass' : 'Fail'}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-4">
                <ScoreRing value={score} />
                <p className="mt-2 font-mono text-sm">
                  {passed}/{total}
                </p>
                <p className="text-xs text-muted-foreground">controls passing</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Collected" value={formatNaira(summary.data.collected)} />
                <Kpi
                  label="Enrollments"
                  value={formatCount(enrolled)}
                  hint={`${formatCount(paid)} paid`}
                />
                <Kpi
                  label="Success share"
                  value={enrolled ? formatPercent((paid / enrolled) * 100, 1) : '0%'}
                />
                <Kpi
                  label="Pending over 24h"
                  value={formatCount(summary.data.pendingOver24h)}
                />
                <Kpi label="Exceptions" value={formatCount(summary.data.exceptions)} />
                <Kpi
                  label="Consent"
                  value={formatPercent(summary.data.consentPercent, 1)}
                />
                <Kpi
                  label="Unknown age"
                  value={formatCount(summary.data.unknownAgeStudents)}
                />
                <Kpi
                  label="Pending amount"
                  value={formatNaira(counts.pending?.amount ?? 0)}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="mb-2 text-sm text-muted-foreground">Collected by day</p>
              <QueryBody loading={timeline.isLoading} error={timeline.error}>
                {timeline.data && timeline.data.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No payments in the last 30 days.
                  </p>
                ) : (
                  <ChartContainer config={chartConfig} className="h-52 w-full">
                    <AreaChart data={timeline.data ?? []}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#9b9b96', fontSize: 11 }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        dataKey="collected"
                        stroke="#c6ff00"
                        fill="#c6ff00"
                        fillOpacity={0.15}
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </QueryBody>
            </div>
            <div className="rounded-lg border border-border bg-card">
              <p className="border-b border-border px-3 py-2 text-sm">Course seats</p>
              <div className="divide-y divide-border">
                {summary.data.seats.length === 0 ? (
                  <p className="px-3 py-6 text-sm text-muted-foreground">
                    No courses yet.
                  </p>
                ) : null}
                {summary.data.seats.map((seat) => (
                  <div
                    key={seat.slug}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span>{seat.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {seat.seatsTaken}
                      {seat.seatCap == null ? '' : ` / ${seat.seatCap}`} · {seat.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </QueryBody>
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function ScoreRing({ value }: { value: number }) {
  const radius = 42
  const circ = 2 * Math.PI * radius
  const dash = (value / 100) * circ
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" aria-label={`${value} percent`}>
      <circle
        cx="60"
        cy="60"
        r={radius}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="8"
        fill="none"
      />
      <circle
        cx="60"
        cy="60"
        r={radius}
        stroke="#c6ff00"
        strokeWidth="8"
        fill="none"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
      <text
        x="60"
        y="66"
        textAnchor="middle"
        fill="#fafafa"
        fontSize="22"
        fontFamily="JetBrains Mono, monospace"
      >
        {value}%
      </text>
    </svg>
  )
}
