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
      toast.success('Invite link removed')
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
        `Remove invite ${who}? The enroll link will stop working. Paid enrollments stay.`,
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
      header: 'Person',
      cell: ({ row }) =>
        row.original.person
          ? `${row.original.person.firstName} ${row.original.person.lastName}`
          : 'Open link',
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
              void navigator.clipboard.writeText(row.original.enrollUrl)
              toast.success('Invite link copied')
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
        title="Invite links"
        description="Generate discount or free enroll URLs. The website charges the catalogue price unless someone opens one of these links."
        actions={
          <Can action="create" subject="enter_first">
            <Button onClick={() => setCreating(true)}>New invite</Button>
          </Can>
        }
      />
      <div className="mb-3">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search code or label"
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
              title="No invite links yet"
              body="Create a free or discounted link to send to a partner or selected student."
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

  const [label, setLabel] = useState('')
  const [personId, setPersonId] = useState('')
  const [lockToPerson, setLockToPerson] = useState(true)
  const [offerType, setOfferType] = useState<InviteOfferType>('free')
  const [discountPercent, setDiscountPercent] = useState('20')
  const [discountAmount, setDiscountAmount] = useState('10000')
  const [trackScope, setTrackScope] = useState<InviteTrackScope>('all')
  const [trackSlugs, setTrackSlugs] = useState<string[]>([])
  const [maxRedemptions, setMaxRedemptions] = useState('1')
  const [expiresAt, setExpiresAt] = useState('')
  const [notes, setNotes] = useState('')

  const openCourses = useMemo(
    () => (courses.data ?? []).filter((course) => course.status !== 'archived'),
    [courses.data],
  )

  const create = useMutation({
    mutationFn: (body: CreateInviteBody) =>
      api<Invite>({ method: 'POST', path: '/admin/enter-first/invites', body }),
    onSuccess: (invite) => {
      toast.success('Invite created')
      void navigator.clipboard.writeText(invite.enrollUrl)
      toast.message('Link copied', { description: invite.enrollUrl })
      onCreated()
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not create invite'),
  })

  function toggleTrack(slug: string) {
    setTrackSlugs((current) =>
      current.includes(slug) ? current.filter((id) => id !== slug) : [...current, slug],
    )
  }

  function submit() {
    const body: CreateInviteBody = {
      label: label.trim() || undefined,
      personId: personId || undefined,
      lockToPerson: personId ? lockToPerson : false,
      offerType,
      trackScope,
      trackSlugs: trackScope === 'selected' ? trackSlugs : undefined,
      maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      notes: notes.trim() || undefined,
    }
    if (offerType === 'discount_percent') {
      body.discountPercent = Number(discountPercent)
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
          <SheetTitle>New invite</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          <Field label="Label">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Partner — Ada"
            />
          </Field>
          <Field label="Person (optional)">
            <select
              className={selectClass}
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">Open link — anyone</option>
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
              <option value="free">Free</option>
              <option value="discount_percent">Percent discount</option>
              <option value="discount_fixed">Fixed ₦ discount</option>
            </select>
          </Field>
          {offerType === 'discount_percent' ? (
            <Field label="Percent off">
              <Input
                inputMode="numeric"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
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
            Create and copy link
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
      toast.success('Invite updated')
      onChanged()
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not update'),
  })

  return (
    <Sheet open={Boolean(invite)} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{invite?.code ?? 'Invite'}</SheetTitle>
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
      <p className="font-mono text-xs break-all text-muted-foreground">{invite.enrollUrl}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void navigator.clipboard.writeText(invite.enrollUrl)
          toast.success('Invite link copied')
        }}
      >
        Copy link
      </Button>
      <p>Offer {invite.discountLabel}</p>
      <p>
        Uses {invite.redemptionCount}
        {invite.maxRedemptions == null ? '' : ` / ${invite.maxRedemptions}`}
      </p>
      <p>Expires {invite.expiresAt ? formatWat(invite.expiresAt) : 'never'}</p>
      {invite.person ? (
        <p>
          Person {invite.person.firstName} {invite.person.lastName} · {invite.person.email}
        </p>
      ) : (
        <p>Open link</p>
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
              Remove invite
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
