import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAbility } from '@/components/ability'
import { ComposeDialog } from '@/components/email-compose-dialog'
import { EmptyState, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { allows } from '@/lib/ability'
import {
  audienceLabel,
  countNote,
  deleteForeverPrompt,
  hideSelectedLabel,
  recipientOutcome,
  snippetFrom,
  useDebounced,
} from '@/lib/email-compose'
import { formatWat } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import type { AdminCourse } from '@/queries/courses/interfaces/course.dto'
import type {
  EmailDraft,
  SentEmail,
  SentEmailDetail,
} from '@/queries/emails/interfaces/email.dto'
import { cn } from 'cn'

export const Route = createFileRoute('/_authenticated/compliance/emails/')({
  component: EmailsPage,
})

type Folder = 'sent' | 'drafts' | 'scheduled' | 'hidden'

type MailRow = {
  id: string
  who: string
  subject: string
  snippet: string
  at: string
  sentCount: number
  failedCount: number
  kind: Folder
}

const EMPTY_COPY: Record<Folder, { title: string; body: string }> = {
  sent: {
    title: 'Nothing sent yet',
    body: 'Press Compose when you want to write to students.',
  },
  drafts: {
    title: 'No drafts',
    body: 'A draft stays here until you send it.',
  },
  scheduled: {
    title: 'Nothing is scheduled',
    body: 'You can pick a date and time while you write an email.',
  },
  hidden: {
    title: 'Nothing is hidden',
    body: 'Hidden emails stay out of Sent until you unhide them.',
  },
}

function EmailsPage() {
  const ability = useAbility()
  const client = useQueryClient()
  const canWrite =
    allows(ability, 'create', 'email') || allows(ability, 'update', 'email')
  const canUpdate = allows(ability, 'update', 'email')
  const [folder, setFolder] = useState<Folder>('sent')
  const [search, setSearch] = useState('')
  const [compose, setCompose] = useState<EmailDraft | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [openHidden, setOpenHidden] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const debouncedSearch = useDebounced(search, 200)
  const sent = useQuery({
    queryKey: queryKeys.emails.sent,
    queryFn: () => api<SentEmail[]>({ method: 'GET', path: '/admin/emails/sent' }),
  })
  const hidden = useQuery({
    queryKey: queryKeys.emails.hidden,
    queryFn: () =>
      api<SentEmail[]>({
        method: 'GET',
        path: '/admin/emails/sent',
        query: { hidden: true },
      }),
  })
  const drafts = useQuery({
    queryKey: queryKeys.emails.drafts,
    queryFn: () => api<EmailDraft[]>({ method: 'GET', path: '/admin/emails/drafts' }),
  })
  const courses = useQuery({
    queryKey: queryKeys.courses.all,
    queryFn: () => api<AdminCourse[]>({ method: 'GET', path: '/admin/courses' }),
  })
  const courseNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const course of courses.data ?? []) names.set(course.id, course.name)
    return names
  }, [courses.data])
  const sentRows = asList(sent.data).map((row) => sentMail(row, 'sent'))
  const hiddenRows = asList(hidden.data).map((row) => sentMail(row, 'hidden'))
  const draftRows = asList(drafts.data)
    .filter((row) => row.status !== 'scheduled')
    .map((row) => draftMail(row, courseNames, 'drafts'))
  const scheduledRows = asList(drafts.data)
    .filter((row) => row.status === 'scheduled')
    .map((row) => draftMail(row, courseNames, 'scheduled'))
  const rows =
    folder === 'sent'
      ? sentRows
      : folder === 'hidden'
        ? hiddenRows
        : folder === 'drafts'
          ? draftRows
          : scheduledRows
  const query = debouncedSearch.trim().toLowerCase()
  const visible = rows.filter((row) => {
    if (!query) return true
    return `${row.who} ${row.subject} ${row.snippet}`.toLowerCase().includes(query)
  })
  const loading =
    folder === 'sent' ? sent.isLoading : folder === 'hidden' ? hidden.isLoading : drafts.isLoading
  const error = folder === 'sent' ? sent.error : folder === 'hidden' ? hidden.error : drafts.error
  const editing = compose === 'new' ? null : compose

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Emails</h1>
      <p className="mt-1 mb-4 max-w-2xl text-sm text-muted-foreground">
        Write to students, keep a draft, or look back at what you already sent.
      </p>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <aside className="w-full shrink-0 md:sticky md:top-4 md:w-52">
          {canWrite ? (
            <Button
              type="button"
              className="h-11 w-full text-base"
              onClick={() => {
                setOpenId(null)
                setCompose('new')
              }}
            >
              ✚ Compose
            </Button>
          ) : null}
          <nav
            className="mt-3 flex gap-2 overflow-x-auto md:flex-col"
            aria-label="Email folders"
          >
            <FolderButton
              label="Sent"
              count={sent.data ? sentRows.length : null}
              active={folder === 'sent' && !openId}
              onClick={() => chooseFolder('sent')}
            />
            <FolderButton
              label="Drafts"
              count={drafts.data ? draftRows.length : null}
              active={folder === 'drafts' && !openId}
              onClick={() => chooseFolder('drafts')}
            />
            <FolderButton
              label="Scheduled"
              count={drafts.data ? scheduledRows.length : null}
              active={folder === 'scheduled' && !openId}
              onClick={() => chooseFolder('scheduled')}
            />
            <FolderButton
              label="Hidden"
              count={hidden.data ? hiddenRows.length : null}
              active={folder === 'hidden' && !openId}
              onClick={() => chooseFolder('hidden')}
            />
          </nav>
        </aside>
        <section className="min-w-0 flex-1">
          {openId ? (
            <SentDetail
              id={openId}
              courseNames={courseNames}
              canResend={canUpdate}
              canManage={canWrite}
              hidden={openHidden}
              acting={acting}
              onBack={() => setOpenId(null)}
              onHide={() => void hideEmails([openId])}
              onUnhide={() => void unhideEmails([openId])}
              onDelete={() => askDelete([openId])}
            />
          ) : (
            <>
              <Input
                aria-label="Search emails"
                placeholder="Search emails"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
                <QueryBody loading={loading} error={error}>
                  {rows.length === 0 ? (
                    <EmptyState
                      title={EMPTY_COPY[folder].title}
                      body={EMPTY_COPY[folder].body}
                    />
                  ) : visible.length === 0 ? (
                    <EmptyState
                      title="No emails match that search"
                      body="Try a name or a subject."
                    />
                  ) : (
                    <ul>
                      {visible.map((row) => (
                        <MailRowView
                          key={row.id}
                          row={row}
                          canManage={canWrite && (folder === 'sent' || folder === 'hidden')}
                          selected={selected.includes(row.id)}
                          acting={acting}
                          onToggle={() => toggleSelected(row.id)}
                          onOpen={() => openRow(row)}
                          onHide={() => void hideEmails([row.id])}
                          onUnhide={() => void unhideEmails([row.id])}
                          onDelete={() => askDelete([row.id])}
                        />
                      ))}
                    </ul>
                  )}
                  {canWrite && selected.length > 0 && folder === 'sent' ? (
                    <div className="flex justify-end border-t border-border px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={acting}
                        onClick={() => void hideEmails(selected)}
                      >
                        {hideSelectedLabel(selected.length)}
                      </Button>
                    </div>
                  ) : null}
                  {canWrite && selected.length > 0 && folder === 'hidden' ? (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-border px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={acting}
                        onClick={() => void unhideEmails(selected)}
                      >
                        Unhide selected
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={acting}
                        onClick={() => askDelete(selected)}
                      >
                        Delete selected
                      </Button>
                    </div>
                  ) : null}
                </QueryBody>
              </div>
            </>
          )}
        </section>
      </div>
      {compose ? (
        <ComposeDialog
          key={compose === 'new' ? 'new' : compose.id}
          draft={editing}
          courses={courses.data ?? []}
          canWrite={canWrite}
          onClose={() => setCompose(null)}
          onChanged={(next) => {
            setFolder(next)
            setOpenId(null)
          }}
        />
      ) : null}
      <Dialog
        open={deleteIds != null}
        onOpenChange={(open) => {
          if (!open && !acting) {
            setDeleteIds(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete email</DialogTitle>
            <DialogDescription>
              {deleteForeverPrompt(deleteIds?.length ?? 1)}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-warn">{deleteError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={acting}
              onClick={() => void confirmDelete()}
            >
              {acting ? 'Deleting' : 'Delete forever'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={acting}
              onClick={() => {
                setDeleteIds(null)
                setDeleteError(null)
              }}
            >
              Keep it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  function chooseFolder(next: Folder) {
    setFolder(next)
    setOpenId(null)
    setSelected([])
  }

  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function askDelete(ids: string[]) {
    setDeleteError(null)
    setDeleteIds(ids)
  }

  async function refreshSent() {
    await client.invalidateQueries({ queryKey: queryKeys.emails.sent })
    await client.invalidateQueries({ queryKey: queryKeys.emails.hidden })
  }

  function dropSelected(ids: string[]) {
    setSelected((current) => current.filter((id) => !ids.includes(id)))
    if (openId && ids.includes(openId)) setOpenId(null)
  }

  async function hideEmails(ids: string[]) {
    if (!ids.length || acting) return
    setActing(true)
    try {
      await api({ method: 'POST', path: '/admin/emails/sent/hide', body: { ids } })
      toast.success(ids.length === 1 ? 'Email hidden' : 'Emails hidden')
      await refreshSent()
      dropSelected(ids)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not hide the email')
    } finally {
      setActing(false)
    }
  }

  async function unhideEmails(ids: string[]) {
    if (!ids.length || acting) return
    setActing(true)
    try {
      await api({ method: 'POST', path: '/admin/emails/sent/unhide', body: { ids } })
      toast.success(ids.length === 1 ? 'Email back in Sent' : 'Emails back in Sent')
      await refreshSent()
      dropSelected(ids)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not unhide the email')
    } finally {
      setActing(false)
    }
  }

  async function confirmDelete() {
    const ids = deleteIds
    if (!ids?.length || acting) return
    setActing(true)
    setDeleteError(null)
    try {
      await api({ method: 'DELETE', path: '/admin/emails/sent', body: { ids } })
      toast.success(ids.length === 1 ? 'Email deleted' : 'Emails deleted')
      setDeleteIds(null)
      await refreshSent()
      dropSelected(ids)
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        setDeleteError(error.message)
        return
      }
      toast.error(error instanceof ApiError ? error.message : 'Could not delete the email')
    } finally {
      setActing(false)
    }
  }

  function openRow(row: MailRow) {
    if (row.kind === 'sent' || row.kind === 'hidden') {
      setOpenHidden(row.kind === 'hidden')
      setOpenId(row.id)
      return
    }
    const match = asList(drafts.data).find((item) => item.id === row.id)
    if (match) setCompose(match)
  }
}

function FolderButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number | null
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm md:w-full',
        active
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-primary/40',
      )}
    >
      <span>{label}</span>
      <span className="font-mono text-xs text-muted-foreground">
        {count == null ? '–' : count.toLocaleString('en-NG')}
      </span>
    </button>
  )
}

function sentMail(row: SentEmail, kind: 'sent' | 'hidden'): MailRow {
  return {
    id: row.id,
    who: row.name || 'Sent',
    subject: row.subject,
    snippet: '',
    at: row.createdAt,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    kind,
  }
}

function MailRowView({
  row,
  canManage,
  selected,
  acting,
  onToggle,
  onOpen,
  onHide,
  onUnhide,
  onDelete,
}: {
  row: MailRow
  canManage: boolean
  selected: boolean
  acting: boolean
  onToggle: () => void
  onOpen: () => void
  onHide: () => void
  onUnhide: () => void
  onDelete: () => void
}) {
  const manageable = canManage && (row.kind === 'sent' || row.kind === 'hidden')
  return (
    <li className="flex flex-col gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:flex-row sm:items-center">
      {manageable ? (
        <input
          type="checkbox"
          className="size-4 shrink-0 accent-primary"
          aria-label={`Select ${row.subject || row.who}`}
          checked={selected}
          disabled={acting}
          onChange={onToggle}
        />
      ) : null}
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col gap-1 text-left hover:text-primary sm:flex-row sm:items-baseline sm:gap-3"
        onClick={onOpen}
      >
        <span className="truncate font-medium sm:w-40 sm:shrink-0">{row.who}</span>
        <span className="min-w-0 flex-1 truncate">
          <span>{row.subject || '(No subject)'}</span>
          {row.snippet ? (
            <span className="text-muted-foreground"> — {row.snippet}</span>
          ) : null}
        </span>
        <RowNote row={row} />
        <span className="shrink-0 text-xs text-muted-foreground">{formatWat(row.at)}</span>
      </button>
      {manageable && row.kind === 'sent' ? (
        <Button type="button" size="sm" variant="outline" disabled={acting} onClick={onHide}>
          Hide
        </Button>
      ) : null}
      {manageable && row.kind === 'hidden' ? (
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" variant="outline" disabled={acting} onClick={onUnhide}>
            Unhide
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={acting} onClick={onDelete}>
            Delete
          </Button>
        </div>
      ) : null}
    </li>
  )
}

function RowNote({ row }: { row: MailRow }) {
  if (row.kind === 'drafts') {
    return <span className="shrink-0 text-xs text-muted-foreground">Draft</span>
  }
  if (row.kind === 'scheduled') {
    return <span className="shrink-0 text-xs text-muted-foreground">Scheduled</span>
  }
  const note = countNote(row.sentCount, row.failedCount)
  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {note.sentLabel}
      {note.failedLabel ? (
        <span className="text-danger/70"> · {note.failedLabel}</span>
      ) : null}
    </span>
  )
}

function SentDetail({
  id,
  courseNames,
  canResend,
  canManage,
  hidden,
  acting,
  onBack,
  onHide,
  onUnhide,
  onDelete,
}: {
  id: string
  courseNames: Map<string, string>
  canResend: boolean
  canManage: boolean
  hidden: boolean
  acting: boolean
  onBack: () => void
  onHide: () => void
  onUnhide: () => void
  onDelete: () => void
}) {
  const client = useQueryClient()
  const detail = useQuery({
    queryKey: queryKeys.emails.sentDetail(id),
    queryFn: () =>
      api<SentEmailDetail>({ method: 'GET', path: `/admin/emails/sent/${id}` }),
  })
  const resend = useMutation({
    mutationFn: () =>
      api<{ retried: number }>({
        method: 'POST',
        path: `/admin/emails/sent/${id}/resend-failed`,
      }),
    onSuccess: async (result) => {
      const count = result?.retried ?? 0
      toast.success(
        count === 1 ? 'Sending again to 1 person' : `Sending again to ${count} people`,
      )
      await client.invalidateQueries({ queryKey: queryKeys.emails.sentDetail(id) })
      await client.invalidateQueries({ queryKey: queryKeys.emails.sent })
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not send again'),
  })
  const row = detail.data
  const people = row?.recipients ?? []
  const failed = people.filter((person) => person.status === 'failed').length
  const who = row
    ? row.selectors?.length
      ? audienceLabel(row.selectors, courseNames)
      : row.name || 'Sent'
    : ''

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-sm text-primary hover:underline"
          onClick={onBack}
        >
          ← Back
        </button>
        {canManage ? (
          hidden ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={acting}
                onClick={onUnhide}
              >
                Unhide
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={acting}
                onClick={onDelete}
              >
                Delete
              </Button>
            </div>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={acting} onClick={onHide}>
              Hide
            </Button>
          )
        ) : null}
      </div>
      <QueryBody loading={detail.isLoading} error={detail.error}>
        {row ? (
          <article className="space-y-4">
            <header>
              <h2 className="text-lg font-semibold">{row.subject || '(No subject)'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                To: {who} ({row.totalRecipients.toLocaleString('en-NG')})
              </p>
              <p className="text-sm text-muted-foreground">
                {formatWat(row.createdAt)}
              </p>
            </header>
            {row.html ? (
              <div
                className="rounded-lg border border-border bg-black p-4 text-sm leading-relaxed [&_a]:text-primary [&_img]:my-2 [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: row.html }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                This email has no message.
              </p>
            )}
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Who got it</h3>
                {canResend && failed > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={resend.isPending}
                    onClick={() => resend.mutate()}
                  >
                    Resend to failed ({failed})
                  </Button>
                ) : null}
              </div>
              {people.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No one is on this email yet.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {people.map((person) => {
                    const outcome = recipientOutcome(person.status)
                    return (
                      <li
                        key={person.id}
                        className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">
                            {person.name || person.email}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {person.name ? person.email : null}
                            {person.inSystem === false
                              ? `${person.name ? ' · ' : ''}Not a student`
                              : null}
                          </span>
                        </span>
                        {outcome === 'failed' ? (
                          <span
                            className="text-danger"
                            title={person.lastError || 'The email did not send'}
                          >
                            ✗ Failed
                          </span>
                        ) : outcome === 'sending' ? (
                          <span className="text-muted-foreground">Sending</span>
                        ) : (
                          <span className="text-emerald-400">✓ Sent</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </article>
        ) : null}
      </QueryBody>
    </div>
  )
}

function draftMail(
  row: EmailDraft,
  courseNames: Map<string, string>,
  kind: 'drafts' | 'scheduled',
): MailRow {
  const fromSelectors = audienceLabel(row.selectors ?? [], courseNames)
  const who = row.name && row.name !== row.subject ? row.name : fromSelectors
  return {
    id: row.id,
    who,
    subject: row.subject,
    snippet: snippetFrom(row.html ?? '', row.text),
    at: kind === 'scheduled' ? row.scheduledAt || row.updatedAt : row.updatedAt,
    sentCount: 0,
    failedCount: 0,
    kind,
  }
}

function asList<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : []
}
