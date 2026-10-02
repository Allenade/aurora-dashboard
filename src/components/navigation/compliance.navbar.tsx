import { HugeiconsIcon } from '@hugeicons/react'
import { Menu01Icon, SearchIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { useSessionUser } from '@/components/ability'
import { initials } from '@/lib/format'
import { useUiStore } from '@/lib/ui-store'
export function ComplianceNavbar() {
  const user = useSessionUser()
  const setCommandOpen = useUiStore((state) => state.setCommandOpen)
  const setNavOpen = useUiStore((state) => state.setNavOpen)
  const role = user?.roles[0]?.name ?? ''
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border px-3 md:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setNavOpen(true)}
        aria-label="Open navigation"
      >
        <HugeiconsIcon icon={Menu01Icon} />
      </Button>
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="flex h-8 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 text-left text-sm text-muted-foreground md:max-w-sm"
      >
        <HugeiconsIcon icon={SearchIcon} className="size-4" />
        <span className="flex-1">Search pages</span>
        <span className="hidden font-mono text-[10px] sm:inline">Ctrl K</span>
      </button>
      <div className="ml-auto flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm leading-tight">
            {user ? `${user.firstName} ${user.lastName}` : ''}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {role}
          </p>
        </div>
        <div className="flex size-8 items-center justify-center rounded-full bg-raised font-mono text-xs">
          {user ? initials(user.firstName, user.lastName) : ''}
        </div>
      </div>
    </header>
  )
}
