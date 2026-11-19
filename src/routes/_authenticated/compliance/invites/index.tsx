import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Can, useAbility } from '@/components/ability'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { EmptyState, PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { allows } from '@/lib/ability'
import { formatWat } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import type { AdminCourse } from '@/queries/courses/interfaces/course.dto'
import type {
  CreateInviteBody,
  Invite,
  InviteOfferType,
  InvitePage,
  InviteTrackScope,
  UpdateInviteBody,
} from '@/queries/invites/interfaces/invite.dto'
import type { PersonPage } from '@/queries/people/interfaces/person.dto'

export const Route = createFileRoute('/_authenticated/compliance/invites/')({
  component: InvitesPage,
})

const selectClass = 'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm'

function InvitesPage() {
  const ability = useAbility()
  const canUpdate = allows(ability, 'update', 'enter_first')
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Invite | null>(null)

  const list = useQuery({
    queryKey: queryKeys.invites.list({ q }),
    queryFn: () =>
      api<InvitePage>({
        method: 'GET',
        path: '/admin/enter-first/invites',
        query: { q: q.trim() || undefined, page: 1, limit: 100 },
      }),
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>({
        method: 'DELETE',
        path: `/admin/enter-first/invites/${id}`,
      }),
    onSuccess: (_data, id) => {
      toast.success('Coupon removed')
      if (selected?.id === id) setSelected(null)
      void queryClient.invalidateQueries({ queryKey: ['invites'] })
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not remove'),
  })

  function confirmRemove(invite: Invite) {
    const who = invite.person
      ? `${invite.person.firstName} ${invite.person.lastName}`
      : invite.code
    if (
      confirm(
        `Remove coupon ${who}? The code will stop working on the website. Paid enrollments stay.`,
      )
    ) {
      remove.mutate(invite.id)
    }
  }

  const columns: Column<Invite>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-sm">{row.original.code}</p>
          <p className="text-xs text-muted-foreground">{row.original.label ?? '—'}</p>
        </div>
      ),
    },
    {
      id: 'person',
      header: 'Who',
      cell: ({ row }) =>
        row.original.allowedEmail
          ? row.original.allowedEmail
          : row.original.person
            ? `${row.original.person.firstName} ${row.original.person.lastName}`
            : 'One use per email',
    },
    {
      id: 'offer',
      header: 'Offer',
      cell: ({ row }) => row.original.discountLabel,
    },
    {
      id: 'uses',
      header: 'Uses',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.redemptionCount}
          {row.original.maxRedemptions == null
            ? ' · open'
            : ` / ${row.original.maxRedemptions}`}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className={row.original.active ? 'text-foreground' : 'text-muted-foreground'}>
          {row.original.active ? 'Active' : 'Off'}
        </span>
      ),
    },
    {
      id: 'copy',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation()
              void navigator.clipboard.writeText(row.original.code)
              toast.success('Coupon code copied')
            }}
          >
            Copy
          </Button>
          {canUpdate ? (
            <Button
              size="sm"
              variant="outline"
              disabled={remove.isPending}
              onClick={(event) => {
                event.stopPropagation()
                confirmRemove(row.original)
              }}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="OFFERS"
        title="Coupons"
        description="Percent coupons can be shared. Each email can use a code once. Free or 100% coupons are locked to one email."
        actions={
          <Can action="create" subject="enter_first">
            <Button onClick={() => setCreating(true)}>New coupon</Button>
          </Can>
        }
      />
      <div className="mb-3">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search coupon code or label"
          className="max-w-sm"
        />
      </div>
      <QueryBody loading={list.isLoading} error={list.error}>
        {list.data ? (
          list.data.items.length ? (
            <DataTable
              columns={columns}
              data={list.data.items}
              onRow={
                canUpdate || allows(ability, 'read', 'enter_first')
                  ? (row) => setSelected(row)
                  : undefined
              }
            />
          ) : (
            <EmptyState
              title="No coupons yet"
              body="Create a code, set the percent (or Free), and students type it on Core 3.0 enroll."
            />
          )
        ) : null}
      </QueryBody>
      <CreateInviteSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false)
          void queryClient.invalidateQueries({ queryKey: ['invites'] })
        }}
      />
      <InviteDrawer
        invite={selected}
        onClose={() => setSelected(null)}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: ['invites'] })}
        onRemove={selected ? () => confirmRemove(selected) : undefined}
        removing={remove.isPending}
      />
    </div>
  )
}

function CreateInviteSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const people = useQuery({
    queryKey: queryKeys.people.list({ scope: 'invite-form' }),
    enabled: open,
    queryFn: () =>
      api<PersonPage>({
        method: 'GET',
        path: '/admin/enter-first/people',
        query: { page: 1, limit: 100 },
      }),
  })
  const courses = useQuery({
    queryKey: queryKeys.courses.all,
    enabled: open,
    queryFn: () => api<AdminCourse[]>({ method: 'GET', path: '/admin/courses' }),
  })

  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [personId, setPersonId] = useState('')
  const [lockToPerson, setLockToPerson] = useState(true)
  const [offerType, setOfferType] = useState<InviteOfferType>('discount_percent')
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountAmount, setDiscountAmount] = useState('10000')
  const [trackScope, setTrackScope] = useState<InviteTrackScope>('all')
  const [trackSlugs, setTrackSlugs] = useState<string[]>([])
  const [maxRedemptions, setMaxRedemptions] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [notes, setNotes] = useState('')
  const [allowedEmail, setAllowedEmail] = useState('')

  const openCourses = useMemo(
    () => (courses.data ?? []).filter((course) => course.status !== 'archived'),
    [courses.data],
  )

  const create = useMutation({
    mutationFn: (body: CreateInviteBody) =>
      api<Invite>({ method: 'POST', path: '/admin/enter-first/invites', body }),
    onSuccess: (invite) => {
      toast.success('Coupon created')
      void navigator.clipboard.writeText(invite.code)
      toast.message('Code copied', { description: invite.code.toUpperCase() })
      onCreated()
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not create coupon'),
  })

  function toggleTrack(slug: string) {
    setTrackSlugs((current) =>
      current.includes(slug) ? current.filter((id) => id !== slug) : [...current, slug],
    )
  }

  function submit() {
    if (!code.trim()) {
      toast.error('Enter a coupon code')
      return
    }
    const percent = Number(discountPercent)
    if (offerType === 'discount_percent') {
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
        toast.error('Enter a whole percent from 1 to 100')
        return
      }
    }
    const personal = offerType === 'free' || (offerType === 'discount_percent' && percent === 100)
    if (personal && !allowedEmail.trim()) {
      toast.error('Enter the student email for a free coupon')
      return
    }
    const body: CreateInviteBody = {
      code: code.trim(),
      label: label.trim() || undefined,
      personId: personId || undefined,
      lockToPerson: personId ? lockToPerson : false,
      allowedEmail: allowedEmail.trim() || undefined,
      offerType,
      trackScope,
      trackSlugs: trackScope === 'selected' ? trackSlugs : undefined,
      maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      notes: notes.trim() || undefined,
    }
    if (offerType === 'discount_percent') {
      body.discountPercent = percent
    }
    if (offerType === 'discount_fixed') {
      body.discountAmount = Number(discountAmount)
    }
    create.mutate(body)
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New coupon</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          <Field label="Coupon code">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AURORA20"
              autoCapitalize="characters"
            />
          </Field>
          <Field label="Label">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Launch 20% off"
            />
          </Field>
          <Field label="Person (optional)">
            <select
              className={selectClass}
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">Anyone can use this code</option>
              {(people.data?.items ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName} · {person.email}
                </option>
              ))}
            </select>
          </Field>
          {personId ? (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm">Lock to person email</p>
                <p className="text-xs text-muted-foreground">
                  Enroll email must match the person.
                </p>
              </div>
              <Switch checked={lockToPerson} onCheckedChange={setLockToPerson} />
            </div>
          ) : null}
          <Field label="Offer">
            <select
              className={selectClass}
              value={offerType}
              onChange={(e) => setOfferType(e.target.value as InviteOfferType)}
            >
              <option value="discount_percent">Percent off</option>
              <option value="free">Free (no payment)</option>
              <option value="discount_fixed">Fixed ₦ discount</option>
            </select>
          </Field>
          {offerType === 'discount_percent' ? (
            <Field label="Percent off">
              <Input
                inputMode="numeric"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="e.g. 10, 20, or 100"
              />
            </Field>
          ) : null}
          {offerType === 'discount_fixed' ? (
            <Field label="Amount off (naira)">
              <Input
                inputMode="numeric"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </Field>
          ) : null}
          <Field
            label={
              offerType === 'free' ||
              (offerType === 'discount_percent' && discountPercent === '100')
                ? 'Student email'
                : 'Lock to email (optional)'
            }
          >
            <Input
              type="email"
              value={allowedEmail}
              onChange={(e) => setAllowedEmail(e.target.value)}
              placeholder="ada@example.com"
            />
            <p className="text-xs text-muted-foreground">
              {offerType === 'free' ||
              (offerType === 'discount_percent' && discountPercent === '100')
                ? 'Only this email can use the code. Required for free coupons.'
                : 'Leave blank so many students can use it, once each. Fill it to lock the code to one person.'}
            </p>
          </Field>
          <Field label="Tracks covered">
            <select
              className={selectClass}
              value={trackScope}
              onChange={(e) => setTrackScope(e.target.value as InviteTrackScope)}
            >
              <option value="all">All selected tracks</option>
              <option value="selected">Only specific tracks</option>
            </select>
          </Field>
          {trackScope === 'selected' ? (
            <div className="space-y-1 rounded-md border border-border p-2">
              {openCourses.map((course) => (
                <label key={course.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={trackSlugs.includes(course.slug)}
                    onChange={() => toggleTrack(course.slug)}
                  />
                  {course.name}
                </label>
              ))}
            </div>
          ) : null}
          <Field label="Max uses">
            <Input
              inputMode="numeric"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Leave blank for unlimited"
            />
          </Field>
          <Field label="Expires">
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button disabled={create.isPending} onClick={submit}>
            Create and copy code
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function InviteDrawer({
  invite,
  onClose,
  onChanged,
  onRemove,
  removing,
}: {
  invite: Invite | null
  onClose: () => void
  onChanged: () => void
  onRemove?: () => void
  removing: boolean
}) {
  const save = useMutation({
    mutationFn: (body: UpdateInviteBody) =>
      api<Invite>({
        method: 'PATCH',
        path: `/admin/enter-first/invites/${invite!.id}`,
        body,
      }),
    onSuccess: () => {
      toast.success('Coupon updated')
      onChanged()
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not update'),
  })

  return (
    <Sheet open={Boolean(invite)} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{invite?.code?.toUpperCase() ?? 'Coupon'}</SheetTitle>
        </SheetHeader>
        {invite ? (
          <InviteEditForm
            key={invite.id}
            invite={invite}
            onSave={(body) => save.mutate(body)}
            saving={save.isPending}
            onRemove={onRemove}
            removing={removing}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function InviteEditForm({
  invite,
  onSave,
  saving,
  onRemove,
  removing,
}: {
  invite: Invite
  onSave: (body: UpdateInviteBody) => void
  saving: boolean
  onRemove?: () => void
  removing: boolean
}) {
  const [label, setLabel] = useState(invite.label ?? '')
  const [active, setActive] = useState(invite.active)
  const [maxRedemptions, setMaxRedemptions] = useState(
    invite.maxRedemptions == null ? '' : String(invite.maxRedemptions),
  )
  const [notes, setNotes] = useState(invite.notes ?? '')

  return (
    <div className="space-y-3 px-4 pb-6 text-sm">
      <p className="font-mono text-sm">{invite.code.toUpperCase()}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void navigator.clipboard.writeText(invite.code)
          toast.success('Coupon code copied')
        }}
      >
        Copy code
      </Button>
      <p>Offer {invite.discountLabel}</p>
      <p>
        Uses {invite.redemptionCount}
        {invite.maxRedemptions == null ? '' : ` / ${invite.maxRedemptions}`}
      </p>
      <p>Expires {invite.expiresAt ? formatWat(invite.expiresAt) : 'never'}</p>
      {invite.allowedEmail ? (
        <p>Locked to {invite.allowedEmail}</p>
      ) : invite.person ? (
        <p>
          Person {invite.person.firstName} {invite.person.lastName} · {invite.person.email}
        </p>
      ) : (
        <p>One use per email</p>
      )}
      <Can action="update" subject="enter_first">
        <Field label="Label">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <p className="text-sm">Active</p>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
        <Field label="Max uses">
          <Input
            inputMode="numeric"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={saving}
            onClick={() =>
              onSave({
                label: label.trim() || null,
                active,
                maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
                notes: notes.trim() || null,
              })
            }
          >
            Save
          </Button>
          {onRemove ? (
            <Button variant="outline" disabled={removing} onClick={onRemove}>
              Remove coupon
            </Button>
          ) : null}
        </div>
      </Can>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
