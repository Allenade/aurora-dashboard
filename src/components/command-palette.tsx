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
import { logout } from '@/server/auth'

export function CommandPalette() {
  const open = useUiStore((state) => state.commandOpen)
  const setOpen = useUiStore((state) => state.setCommandOpen)
  const navigate = useNavigate()

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
                void logout().then(() => {
                  window.location.href = '/auth/signin'
                })
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
