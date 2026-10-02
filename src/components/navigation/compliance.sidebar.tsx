import { Link, useRouterState } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  Book02Icon,
  CheckListIcon,
  CreditCardIcon,
  File01Icon,
  Home01Icon,
  Mail01Icon,
  Settings01Icon,
  Shield01Icon,
  UndoIcon,
  UserGroupIcon,
  LeftToRightListDashIcon,
  Logout01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from 'cn'
import { useSignOut } from '@/queries/auth/session'

export const NAV = [
  { to: '/compliance', label: 'Overview', icon: Home01Icon, exact: true, badgeKey: null },
  { to: '/compliance/courses', label: 'Courses', icon: Book02Icon, exact: false, badgeKey: 'courses' },
  { to: '/compliance/emails', label: 'Emails', icon: Mail01Icon, exact: false, badgeKey: 'emails' },
  { to: '/compliance/payments', label: 'Payments', icon: CreditCardIcon, exact: false, badgeKey: 'payments' },
  { to: '/compliance/refunds', label: 'Refunds', icon: UndoIcon, exact: false, badgeKey: 'refunds' },
  { to: '/compliance/consent', label: 'Consent', icon: Shield01Icon, exact: false, badgeKey: 'consent' },
  { to: '/compliance/minors', label: 'Minors', icon: UserGroupIcon, exact: false, badgeKey: 'minors' },
  { to: '/compliance/data-requests', label: 'Data requests', icon: File01Icon, exact: false, badgeKey: 'requests' },
  { to: '/compliance/controls', label: 'Controls', icon: CheckListIcon, exact: false, badgeKey: 'controls' },
  { to: '/compliance/audit', label: 'Audit log', icon: LeftToRightListDashIcon, exact: false, badgeKey: null },
  { to: '/compliance/claims', label: 'Claims', icon: Alert02Icon, exact: false, badgeKey: 'claims' },
  { to: '/compliance/settings', label: 'Settings', icon: Settings01Icon, exact: false, badgeKey: null },
] as const

export type BadgeKey = Exclude<(typeof NAV)[number]['badgeKey'], null>

export function ComplianceSidebar({
  badges,
  onNavigate,
}: {
  badges: Partial<Record<BadgeKey, number>>
  onNavigate?: () => void
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { signOut, pending } = useSignOut()
  return (
    <div className="flex h-full flex-col bg-black">
      <div className="px-4 py-4">
        <p className="font-display text-sm tracking-[0.18em] text-foreground">AURORA</p>
        <p className="font-display text-[10px] tracking-[0.16em] text-muted-foreground">
          CORE 3.0
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(`${item.to}/`)
          const badge = item.badgeKey ? badges[item.badgeKey] : undefined
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]',
                active ? 'bg-raised text-foreground' : 'text-muted-foreground hover:bg-surface hover:text-foreground',
              )}
            >
              <HugeiconsIcon icon={item.icon} className="size-4" />
              <span className="flex-1">{item.label}</span>
              {badge ? (
                <span className="font-mono text-[11px] text-muted-foreground">{badge}</span>
              ) : null}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-border px-2 py-3">
        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            void signOut()
          }}
          disabled={pending}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-surface hover:text-primary disabled:opacity-60"
        >
          <HugeiconsIcon icon={Logout01Icon} className="size-4" />
          <span className="flex-1">{pending ? 'Signing out' : 'Sign out'}</span>
        </button>
      </div>
    </div>
  )
}
