import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Can, useAbility } from '@/components/ability'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { EmptyState, PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { allows } from '@/lib/ability'
import { formatWat } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import type {
  CreatePersonBody,
  Person,
  PersonPage,
  UpdatePersonBody,
} from '@/queries/people/interfaces/person.dto'

export const Route = createFileRoute('/_authenticated/compliance/people/')({
  component: PeoplePage,
})

function PeoplePage() {
  const ability = useAbility()
  const canUpdate = allows(ability, 'update', 'enter_first')
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Person | null>(null)

  const list = useQuery({
    queryKey: queryKeys.people.list({ q }),
    queryFn: () =>
      api<PersonPage>({
        method: 'GET',
        path: '/admin/enter-first/people',
        query: { q: q.trim() || undefined, page: 1, limit: 100 },
      }),
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>({
        method: 'DELETE',
        path: `/admin/enter-first/people/${id}`,
      }),
    onSuccess: (_data, id) => {
      toast.success('Person and their invite links removed')
      if (selected?.id === id) setSelected(null)
      void queryClient.invalidateQueries({ queryKey: ['people'] })
      void queryClient.invalidateQueries({ queryKey: ['invites'] })
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not remove'),
  })

  function confirmRemove(person: Person) {
    if (
      confirm(
        `Remove ${person.firstName} ${person.lastName} and their invite links? Paid enrollments stay.`,
      )
    ) {
      remove.mutate(person.id)
    }
  }

  const columns: Column<Person>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <p>
            {row.original.firstName} {row.original.lastName}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {row.original.email}
          </p>
        </div>
      ),
    },
    {
      id: 'phone',
      header: 'Phone',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.phone ?? '—'}</span>
      ),
    },
    {
      id: 'notes',
      header: 'Notes',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.notes ?? '—'}</span>
      ),
    },
    {
      id: 'when',
      header: 'Added',
      cell: ({ row }) => (
        <span className="font-mono text-[11px]">{formatWat(row.original.createdAt)}</span>
      ),
    },
    ...(canUpdate
      ? [
          {
            id: 'remove',
            header: '',
            cell: ({ row }) => (
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
            ),
          } satisfies Column<Person>,
        ]
      : []),
  ]

  return (
    <div>
      <PageHeader
        eyebrow="OFFERS"
        title="People"
        description="Contacts you send special invite links to. Create a person, then open Invite links to generate a discount or free URL."
        actions={
          <Can action="create" subject="enter_first">
            <Button onClick={() => setCreating(true)}>Add person</Button>
          </Can>
        }
      />
      <div className="mb-3">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search name or email"
          className="max-w-sm"
        />
      </div>
      <QueryBody loading={list.isLoading} error={list.error}>
        {list.data ? (
          list.data.items.length ? (
            <DataTable
              columns={columns}
              data={list.data.items}
              onRow={canUpdate || allows(ability, 'read', 'enter_first') ? (row) => setSelected(row) : undefined}
            />
          ) : (
            <EmptyState
              title="No people yet"
              body="Add a contact when you want to send them a free or discounted enroll link."
            />
          )
        ) : null}
      </QueryBody>
      <PersonSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false)
          void queryClient.invalidateQueries({ queryKey: ['people'] })
        }}
      />
      <PersonDrawer
        person={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ['people'] })
          void queryClient.invalidateQueries({ queryKey: ['invites'] })
        }}
        onRemove={selected ? () => confirmRemove(selected) : undefined}
        removing={remove.isPending}
      />
    </div>
  )
}

function PersonSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  const create = useMutation({
    mutationFn: (body: CreatePersonBody) =>
      api<Person>({ method: 'POST', path: '/admin/enter-first/people', body }),
    onSuccess: () => {
      toast.success('Person added')
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setNotes('')
      onSaved()
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not add person'),
  })

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add person</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          <Field label="First name">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Last name">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button
            disabled={
              !firstName.trim() ||
              !lastName.trim() ||
              !email.trim() ||
              create.isPending
            }
            onClick={() =>
              create.mutate({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                phone: phone.trim() || undefined,
                notes: notes.trim() || undefined,
              })
            }
          >
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PersonDrawer({
  person,
  onClose,
  onChanged,
  onRemove,
  removing,
}: {
  person: Person | null
  onClose: () => void
  onChanged: () => void
  onRemove?: () => void
  removing: boolean
}) {
  const save = useMutation({
    mutationFn: (body: UpdatePersonBody) =>
      api<Person>({
        method: 'PATCH',
        path: `/admin/enter-first/people/${person!.id}`,
        body,
      }),
    onSuccess: () => {
      toast.success('Person saved')
      onChanged()
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not save'),
  })

  return (
    <Sheet open={Boolean(person)} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {person ? `${person.firstName} ${person.lastName}` : 'Person'}
          </SheetTitle>
        </SheetHeader>
        {person ? (
          <PersonEditForm
            key={person.id}
            person={person}
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

function PersonEditForm({
  person,
  onSave,
  saving,
  onRemove,
  removing,
}: {
  person: Person
  onSave: (body: UpdatePersonBody) => void
  saving: boolean
  onRemove?: () => void
  removing: boolean
}) {
  const [firstName, setFirstName] = useState(person.firstName)
  const [lastName, setLastName] = useState(person.lastName)
  const [email, setEmail] = useState(person.email)
  const [phone, setPhone] = useState(person.phone ?? '')
  const [notes, setNotes] = useState(person.notes ?? '')

  return (
    <div className="space-y-3 px-4 pb-6">
      <Field label="First name">
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </Field>
      <Field label="Last name">
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Phone">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Can action="update" subject="enter_first">
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={saving}
            onClick={() =>
              onSave({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                phone: phone.trim() || undefined,
                notes: notes.trim() || undefined,
              })
            }
          >
            Save
          </Button>
          <Link
            to="/compliance/invites"
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-surface"
          >
            Create invite
          </Link>
          {onRemove ? (
            <Button variant="outline" disabled={removing} onClick={onRemove}>
              Remove person
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
