export const queryKeys = {
  session: ['session'] as const,
  config: ['public-config'] as const,
  compliance: {
    summary: (from?: string, to?: string) =>
      ['compliance', 'summary', from ?? '', to ?? ''] as const,
    timeline: (from?: string, to?: string) =>
      ['compliance', 'timeline', from ?? '', to ?? ''] as const,
    exceptions: ['compliance', 'exceptions'] as const,
    tests: ['compliance', 'tests'] as const,
    dataRequests: ['compliance', 'data-requests'] as const,
  },
  courses: {
    all: ['courses'] as const,
    detail: (id: string) => ['courses', id] as const,
  },
  users: {
    all: ['users'] as const,
  },
  enrollments: {
    list: (query: Record<string, string | number | undefined>) =>
      ['enrollments', query] as const,
    detail: (id: string) => ['enrollments', id] as const,
  },
  emails: {
    sent: ['emails', 'sent'] as const,
    drafts: ['emails', 'drafts'] as const,
    sentDetail: (id: string) => ['emails', 'sent', id] as const,
    campaigns: ['emails', 'campaigns'] as const,
    campaign: (id: string) => ['emails', 'campaigns', id] as const,
    messages: (campaignId?: string) =>
      ['emails', 'messages', campaignId ?? ''] as const,
    templates: ['emails', 'templates'] as const,
    suppressions: ['emails', 'suppressions'] as const,
  },
  refunds: {
    all: ['refunds'] as const,
    detail: (id: string) => ['refunds', id] as const,
  },
  audit: (query: Record<string, string | number | undefined>) =>
    ['audit', query] as const,
  settings: ['settings', 'organization'] as const,
}
