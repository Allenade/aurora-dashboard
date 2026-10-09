import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAbility } from '@/components/ability'
import { ComposeDialog } from '@/components/email-compose-dialog'
import { EmptyState, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { allows } from '@/lib/ability'
import {
  audienceLabel,
  countNote,
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

type Folder = 'sent' | 'drafts' | 'scheduled'

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
}

function EmailsPage() {
  const ability = useAbility()
  const canWrite =
    allows(ability, 'create', 'email') || allows(ability, 'update', 'email')
  const canUpdate = allows(ability, 'update', 'email')
  const [folder, setFolder] = useState<Folder>('sent')
  const [search, setSearch] = useState('')
  const [compose, setCompose] = useState<EmailDraft | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const debouncedSearch = useDebounced(search, 200)
  const sent = useQuery({
    queryKey: queryKeys.emails.sent,
    queryFn: () => api<SentEmail[]>({ method: 'GET', path: '/admin/emails/sent' }),
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
  const sentRows = asList(sent.data).map((row) => ({
    id: row.id,
    who: row.name || 'Sent',
    subject: row.subject,
    snippet: '',
    at: row.createdAt,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    kind: 'sent' as const,
  }))
  const draftRows = asList(drafts.data)
    .filter((row) => row.status !== 'scheduled')
    .map((row) => draftMail(row, courseNames, 'drafts'))
  const scheduledRows = asList(drafts.data)
    .filter((row) => row.status === 'scheduled')
    .map((row) => draftMail(row, courseNames, 'scheduled'))
  const rows =
    folder === 'sent' ? sentRows : folder === 'drafts' ? draftRows : scheduledRows
  const query = debouncedSearch.trim().toLowerCase()
  const visible = rows.filter((row) => {
    if (!query) return true
    return `${row.who} ${row.subject} ${row.snippet}`.toLowerCase().includes(query)
  })
  const loading = folder === 'sent' ? sent.isLoading : drafts.isLoading
  const error = folder === 'sent' ? sent.error : drafts.error
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
              onClick={() => {
                setFolder('sent')
                setOpenId(null)
              }}
            />
            <FolderButton
              label="Drafts"
              count={drafts.data ? draftRows.length : null}
              active={folder === 'drafts' && !openId}
              onClick={() => {
                setFolder('drafts')
                setOpenId(null)
              }}
            />
            <FolderButton
              label="Scheduled"
              count={drafts.data ? scheduledRows.length : null}
              active={folder === 'scheduled' && !openId}
              onClick={() => {
                setFolder('scheduled')
                setOpenId(null)
              }}
            />
          </nav>
        </aside>
        <section className="min-w-0 flex-1">
          {openId ? (
            <SentDetail
              id={openId}
              courseNames={courseNames}
              canResend={canUpdate}
              onBack={() => setOpenId(null)}
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
                        <li
                          key={row.id}
                          className="border-b border-border last:border-b-0"
                        >
                          <button
                            type="button"
                            className="flex w-full flex-col gap-1 px-3 py-3 text-left hover:bg-raised sm:flex-row sm:items-baseline sm:gap-3"
                            onClick={() => openRow(row)}
                          >
                            <span className="truncate font-medium sm:w-40 sm:shrink-0">
                              {row.who}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              <span>{row.subject || '(No subject)'}</span>
                              {row.snippet ? (
                                <span className="text-muted-foreground">
                                  {' '}
                                  — {row.snippet}
                                </span>
                              ) : null}
                            </span>
                            <RowNote row={row} />
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatWat(row.at)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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
    </div>
  )

  function openRow(row: MailRow) {
    if (row.kind === 'sent') {
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
  onBack,
}: {
  id: string
  courseNames: Map<string, string>
  canResend: boolean
  onBack: () => void
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
      <button
        type="button"
        className="mb-3 text-sm text-primary hover:underline"
        onClick={onBack}
      >
        ← Back
      </button>
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
