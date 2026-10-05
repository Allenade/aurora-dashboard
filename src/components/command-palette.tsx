import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { NAV } from '@/components/navigation/compliance.sidebar'
import { useUiStore } from '@/lib/ui-store'
import { useSignOut } from '@/queries/auth/session'

export function CommandPalette() {
  const open = useUiStore((state) => state.commandOpen)
  const setOpen = useUiStore((state) => state.setCommandOpen)
  const navigate = useNavigate()
  const { signOut } = useSignOut()

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Jump to a page" />
        <CommandList>
          <CommandEmpty>No matching page</CommandEmpty>
          <CommandGroup heading="Compliance">
            <CommandItem
              value="Core 3.0"
              onSelect={() => {
                setOpen(false)
                void navigate({ to: '/compliance/payments' })
              }}
            >
              Core 3.0
            </CommandItem>
            {NAV.map((item) => (
              <CommandItem
                key={item.to}
                value={item.label}
                onSelect={() => {
                  setOpen(false)
                  void navigate({ to: item.to })
                }}
              >
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Session">
            <CommandItem
              value="Sign out"
              onSelect={() => {
                setOpen(false)
                void signOut()
              }}
            >
              Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
