import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSessionUser, login } from '@/server/auth'

export const Route = createFileRoute('/auth/signin')({
  beforeLoad: async () => {
    const user = await getSessionUser()
    if (user) throw redirect({ to: '/compliance' })
  },
  component: SignInPage,
})

function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await login({ data: { email, password } })
    setPending(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    toast.success('Signed in')
    await router.navigate({ to: '/compliance' })
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6"
      >
        <p className="font-display text-sm tracking-[0.18em]">AURORA</p>
        <p className="font-display text-[10px] tracking-[0.16em] text-muted-foreground">
          CORE 3.0 COMPLIANCE
        </p>
        <h1 className="mt-4 text-lg font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the email and password from your staff account.
        </p>
        <div className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in' : 'Sign in'}
          </Button>
        </div>
      </form>
    </main>
  )
}
