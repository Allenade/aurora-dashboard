import { collectPages } from '@/lib/pages'
import { pageWithProgram } from '@/lib/program'
import { api } from '@/queries/api'
import type { EnrollmentPage } from '@/queries/payments/interfaces/payment.dto'
import type { ApiQuery } from '@/services/api/api.instance'

const programQuerySupport: { current: boolean | null } = { current: null }

export async function loadEnrollments(
  query: ApiQuery = {},
  options?: { limit?: number; maxPages?: number },
) {
  return collectPages((page, limit) => {
    const base = { ...query, page, limit }
    return pageWithProgram(
      (program) =>
        api<EnrollmentPage>({
          method: 'GET',
          path: '/admin/enter-first/enrollments',
          query: program ? { ...base, program } : base,
        }),
      programQuerySupport,
    )
  }, options)
}
