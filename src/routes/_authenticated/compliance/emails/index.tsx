import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactNode, type RefObject, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { Can } from '@/components/ability'
import { EmptyState, PageHeader, QueryBody } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  blockId,
  blocksToHtml,
  blocksToText,
  htmlToBlocks,
  missingImageAlt,
  previewPlaceholders,
  type EmailBlock,
} from '@/lib/blocks'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import { UNREACHABLE_MESSAGE } from '@/services/api/api.error'
import {
  PLACEHOLDERS,
  type AudiencePreview,
  type CampaignStatus,
  type EmailAudience,
  type EmailAttachment,
  type EmailCampaign,
  type EmailKind,
  type EmailMessage,
  type EmailTemplate,
  type MessageStatus,
  type Suppression,
} from '@/queries/emails/interfaces/email.dto'
import { cn } from 'cn'

export const Route = createFileRoute('/_authenticated/compliance/emails/')({
  component: EmailsPage,
})

type Step = 'who' | 'write' | 'check'

const STEPS: Array<{ id: Step; n: string; label: string }> = [
  { id: 'who', n: '1', label: 'Who gets it' },
  { id: 'write', n: '2', label: 'Write the message' },
  { id: 'check', n: '3', label: 'Check and send' },
]

const INSERTS: Array<{ label: string; token: (typeof PLACEHOLDERS)[number] }> = [
  { label: 'First name', token: '{{firstName}}' },
  { label: 'Last name', token: '{{lastName}}' },
  { label: 'Course', token: '{{track}}' },
  { label: 'Amount', token: '{{amount}}' },
  { label: 'Reference', token: '{{reference}}' },
  { label: 'Cutoff date', token: '{{cutoffDate}}' },
  { label: 'Payment link', token: '{{payLink}}' },
  { label: 'Unsubscribe link', token: '{{unsubscribeUrl}}' },
]

const BLOCK_MENU: Array<{ type: EmailBlock['type']; label: string; hint: string }> = [
  { type: 'heading', label: 'Heading', hint: 'A short title' },
  { type: 'text', label: 'Text', hint: 'A paragraph' },
  { type: 'image', label: 'Picture', hint: 'Upload a file or paste a link' },
  { type: 'button', label: 'Button', hint: 'One clear link' },
  { type: 'divider', label: 'Line', hint: 'A break between sections' },
  { type: 'columns', label: 'Two columns', hint: 'Two short side-by-side notes' },
]

const STATUS_LABEL: Record<CampaignStatus, string> = {
  queued: 'Waiting to send',
  sending: 'Sending',
  paused: 'Paused',
  completed: 'Sent',
  cancelled: 'Cancelled',
  failed: 'Failed',
}

const MESSAGE_LABEL: Record<MessageStatus, string> = {
  queued: 'Waiting',
  sending: 'Sending',
  delivered: 'Delivered',
  opened: 'Opened',
  bounced: 'Bounced',
  failed: 'Failed',
  complained: 'Complaint',
}

const REASON_LABEL: Record<Suppression['reason'], string> = {
  hard_bounce: 'The address bounced',
  complaint: 'Marked as spam',
  unsubscribe: 'Unsubscribed',
}

type Caret = {
  start: number
  end: number
  value: string
  apply: (next: string) => void
}

function EmailsPage() {
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const campaigns = useQuery({
    queryKey: queryKeys.emails.campaigns,
    queryFn: () => api<EmailCampaign[]>({ method: 'GET', path: '/admin/emails/campaigns' }),
  })
  const suppressions = useQuery({
    queryKey: queryKeys.emails.suppressions,
    queryFn: () => api<Suppression[]>({ method: 'GET', path: '/admin/emails/suppressions' }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="EMAIL"
        title="Emails"
        description="Write a message, check who will receive it, then send."
        actions={
          writing ? (
            <Button variant="outline" onClick={() => setWriting(false)}>
              Back to sent emails
            </Button>
          ) : (
            <Can action="create" subject="email">
              <Button onClick={() => setWriting(true)}>Write an email</Button>
            </Can>
          )
        }
      />
      {writing ? (
        <Composer
          onDone={(id) => {
            setWriting(false)
            setCampaignId(id)
          }}
          onCancel={() => setWriting(false)}
        />
      ) : (
        <>
          <QueryBody loading={campaigns.isLoading} error={campaigns.error}>
            {campaigns.data && campaigns.data.length > 0 ? (
              <ul className="space-y-2">
                {campaigns.data.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setCampaignId((current) => (current === row.id ? null : row.id))}
                      className={cn(
                        'w-full rounded-lg border bg-card px-4 py-3 text-left transition-colors',
                        campaignId === row.id ? 'border-primary' : 'border-border hover:border-primary/40',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{row.name}</span>
                        <Badge variant="outline">{kindLabel(row.kind)}</Badge>
                        <StatusBadge status={row.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{row.subject}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {audienceSentence(row.audience)} · {row.sentCount.toLocaleString('en-NG')} of{' '}
                        {row.totalRecipients.toLocaleString('en-NG')} sent
                        {row.failedCount > 0
                          ? ` · ${row.failedCount.toLocaleString('en-NG')} failed`
                          : ''}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${row.totalRecipients ? Math.min(100, (row.sentCount / row.totalRecipients) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </button>
                    {campaignId === row.id ? <CampaignProgress id={row.id} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No emails sent yet"
                body="Write one when you are ready. You can send a test to yourself first."
              />
            )}
          </QueryBody>
          <BlockedAddresses
            loading={suppressions.isLoading}
            error={suppressions.error}
            rows={suppressions.data ?? []}
          />
        </>
      )}
    </div>
  )
}

function Composer({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const client = useQueryClient()
  const caret = useRef<Caret | null>(null)
  const [step, setStep] = useState<Step>('who')
  const [kind, setKind] = useState<EmailKind>('transactional')
  const [name, setName] = useState('Payment reminder')
  const [subject, setSubject] = useState('Your {{track}} payment')
  const [audienceKind, setAudienceKind] = useState<EmailAudience['kind']>('filter')
  const [emails, setEmails] = useState('')
  const [pendingHours, setPendingHours] = useState('24')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<EmailAttachment[]>([])
  const [attaching, setAttaching] = useState(false)
  const [blocks, setBlocks] = useState<EmailBlock[]>(starterBlocks())
  const [testTo, setTestTo] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const audience = buildAudience(audienceKind, emails, pendingHours)
  const html = blocksToHtml(blocks)
  const text = blocksToText(blocks)
  const altGaps = missingImageAlt(blocks)
  const warnings = [
    altGaps.length ? 'Add a short description to every picture before you send.' : null,
    kind === 'marketing' && !html.includes('{{unsubscribeUrl}}')
      ? 'Promotions should include an unsubscribe link. Use Insert and choose Unsubscribe link.'
      : null,
  ].filter((item): item is string => Boolean(item))

  const templates = useQuery({
    queryKey: queryKeys.emails.templates,
    queryFn: () => api<EmailTemplate[]>({ method: 'GET', path: '/admin/emails/templates' }),
  })
  const preview = useQuery({
    queryKey: ['emails', 'audience-preview', kind, JSON.stringify(audience)],
    queryFn: () =>
      api<AudiencePreview>({
        method: 'POST',
        path: '/admin/emails/audience/preview',
        body: { audience, kind },
      }),
    enabled: step === 'check',
  })

  const test = useMutation({
    mutationFn: () =>
      api({
        method: 'POST',
        path: '/admin/emails/test-send',
        body: { to: testTo, subject, html, text },
      }),
    onSuccess: () => toast.success('Test email accepted'),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Test failed'),
  })
  const send = useMutation({
    mutationFn: () =>
      api<EmailCampaign>({
        method: 'POST',
        path: '/admin/emails/campaigns',
        body: {
          name,
          subject,
          html,
          text,
          kind,
          audience,
          templateId: templateId ?? undefined,
          attachments,
        },
      }),
    onSuccess: async (created) => {
      toast.success('Email queued')
      setConfirm(false)
      await client.invalidateQueries({ queryKey: queryKeys.emails.campaigns })
      onDone(created.id)
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Send failed'),
  })

  function insert(token: string) {
    const current = caret.current
    if (!current) {
      setSubject((value) => {
        const next = value.trim() ? `${value} ${token}` : token
        caret.current = {
          start: next.length,
          end: next.length,
          value: next,
          apply: setSubject,
        }
        return next
      })
      return
    }
    const next = current.value.slice(0, current.start) + token + current.value.slice(current.end)
    const pos = current.start + token.length
    current.apply(next)
    caret.current = { ...current, value: next, start: pos, end: pos }
  }

  function go(next: Step) {
    if (next === 'write' || next === 'check') {
      if (!name.trim()) {
        setNotice('Add a campaign name so you can find this email later.')
        setStep('who')
        return
      }
      if (audienceKind === 'explicit' && audience.kind === 'explicit' && !(audience.emails?.length)) {
        setNotice('Add at least one email address, or choose a different group.')
        setStep('who')
        return
      }
    }
    if (next === 'check' && !subject.trim()) {
      setNotice('Add a subject. That is the line people see in their inbox.')
      setStep('write')
      return
    }
    setNotice(null)
    setStep(next)
  }

  function applyTemplate(template: EmailTemplate) {
    const nextBlocks = htmlToBlocks(template.html)
    setName(template.name)
    setSubject(template.subject)
    setKind(template.kind)
    setTemplateId(template.id)
    setBlocks(nextBlocks.length ? nextBlocks : starterBlocks())
    toast.success(`Started from ${template.name}`)
  }

  const count = preview.data?.count
  const summary = count === undefined ? 'Checking who will receive this' : `This will go to ${count.toLocaleString('en-NG')} ${count === 1 ? 'person' : 'people'}`

  return (
    <>
      <section className="rounded-lg border border-border bg-card p-4">
        <ol className="mb-5 grid gap-2 sm:grid-cols-3">
          {STEPS.map((item) => {
            const active = item.id === step
            const done = STEPS.findIndex((row) => row.id === step) > STEPS.findIndex((row) => row.id === item.id)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left',
                    active ? 'border-primary bg-primary/10' : 'border-border',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs',
                      active || done ? 'bg-primary text-primary-foreground' : 'bg-raised text-muted-foreground',
                    )}
                  >
                    {item.n}
                  </span>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
        {notice ? <p className="mb-3 text-sm text-warn">{notice}</p> : null}

        {step === 'who' ? (
          <div className="space-y-5">
            <Field label="Campaign name" hint="Only your team sees this. People receiving the email do not.">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">What kind of email?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice
                  selected={kind === 'transactional'}
                  title="Important update"
                  hint="Always sent. Use this for payments, receipts, and account news."
                  onClick={() => setKind('transactional')}
                />
                <Choice
                  selected={kind === 'marketing'}
                  title="Promotion"
                  hint="Skips people who opted out of marketing."
                  onClick={() => setKind('marketing')}
                />
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Who should get this?</legend>
              <div className="grid gap-2">
                <Choice
                  selected={audienceKind === 'all'}
                  title="Everyone"
                  hint="Every student on the list for this kind of email."
                  onClick={() => setAudienceKind('all')}
                />
                <Choice
                  selected={audienceKind === 'filter'}
                  title="People who haven't paid yet"
                  hint="Only students whose payment is still waiting."
                  onClick={() => setAudienceKind('filter')}
                />
                <Choice
                  selected={audienceKind === 'explicit'}
                  title="Specific people"
                  hint="Type the addresses yourself."
                  onClick={() => setAudienceKind('explicit')}
                />
              </div>
              {audienceKind === 'filter' ? (
                <Field label="For how many hours?" hint="Count students who have been waiting at least this long.">
                  <Input
                    inputMode="numeric"
                    value={pendingHours}
                    onChange={(event) => setPendingHours(event.target.value.replace(/[^\d]/g, ''))}
                  />
                </Field>
              ) : null}
              {audienceKind === 'explicit' ? (
                <Field label="Email addresses" hint="One address per line. Commas also work.">
                  <Textarea
                    value={emails}
                    onChange={(event) => setEmails(event.target.value)}
                    placeholder="name@domain.com"
                  />
                </Field>
              ) : null}
            </fieldset>
          </div>
        ) : null}

        {step === 'write' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-sm text-muted-foreground">Start from the draft below, or use a saved template.</p>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                    Start from a template
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-56">
                    {templates.isLoading ? (
                      <DropdownMenuItem disabled>Loading templates</DropdownMenuItem>
                    ) : (templates.data ?? []).length === 0 ? (
                      <DropdownMenuItem disabled>No saved templates</DropdownMenuItem>
                    ) : (
                      (templates.data ?? []).map((template) => (
                        <DropdownMenuItem key={template.id} onClick={() => applyTemplate(template)}>
                          {template.name}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Field label="Subject" hint="The line people see before they open the email.">
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} {...bindField(caret, setSubject)} />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <InsertMenu onInsert={insert} />
                <span className="text-xs text-muted-foreground">Inserts where your cursor is.</span>
              </div>
              <div className="space-y-2">
                {blocks.map((block, index) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    index={index}
                    caret={caret}
                    onChange={(next) =>
                      setBlocks((rows) => rows.map((row) => (row.id === next.id ? next : row)))
                    }
                    onRemove={() => setBlocks((rows) => rows.filter((row) => row.id !== block.id))}
                  />
                ))}
              </div>
              <AddBlockMenu onAdd={(type) => setBlocks((rows) => [...rows, emptyBlock(type)])} />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="email-attachment"
                    type="file"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (!file) return
                      void uploadAttachment(file, setAttaching, (next) =>
                        setAttachments((rows) => [...rows, next]),
                      )
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={attaching}
                    render={<label htmlFor="email-attachment" />}
                  >
                    {attaching ? 'Uploading' : 'Attach file'}
                  </Button>
                  <span className="text-xs text-muted-foreground">Optional. It is sent with the email.</span>
                </div>
                {attachments.length ? (
                  <ul className="space-y-1">
                    {attachments.map((file) => (
                      <li key={file.url} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{file.filename}</span>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setAttachments((rows) => rows.filter((row) => row.url !== file.url))
                          }
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Live preview</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Labels such as [First name] are filled in for each person when the email sends.
              </p>
              <div
                className="min-h-48 rounded-md border border-border bg-black p-4 text-sm [&_a]:text-primary [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_hr]:my-3 [&_hr]:border-border [&_img]:my-2 [&_img]:max-h-48 [&_img]:max-w-full [&_p]:mb-2 [&_table]:w-full [&_td]:align-top [&_td]:pr-3"
                dangerouslySetInnerHTML={{ __html: previewPlaceholders(html) }}
              />
            </div>
          </div>
        ) : null}

        {step === 'check' ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3">
              <p className="text-base font-medium">{preview.isLoading ? 'Checking who will receive this' : summary}</p>
              <p className="mt-1 text-muted-foreground">
                {kindLabel(kind)}. {audienceSentence(audience)}. Subject: {subject || 'No subject yet'}
              </p>
            </div>
            <QueryBody loading={preview.isLoading} error={preview.error}>
              {preview.data ? (
                <ul className="space-y-1 text-muted-foreground">
                  <li>{preview.data.matched.toLocaleString('en-NG')} people matched this group.</li>
                  <li>
                    {kind === 'marketing'
                      ? `${preview.data.excluded.marketingOptOut.toLocaleString('en-NG')} people opted out of promotions and will be skipped.`
                      : 'Important updates are sent even when someone opted out of promotions.'}
                  </li>
                  <li>
                    {preview.data.excluded.suppressed.toLocaleString('en-NG')} blocked addresses will be skipped.
                  </li>
                  <li>
                    {(preview.data.excluded.duplicate ?? 0).toLocaleString('en-NG')} duplicate addresses were counted once.
                  </li>
                </ul>
              ) : null}
            </QueryBody>
            {warnings.map((warning) => (
              <p key={warning} className="text-warn">
                {warning}
              </p>
            ))}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Send a test" hint="A copy goes to this address only. The real list is not emailed.">
                <Input
                  value={testTo}
                  onChange={(event) => setTestTo(event.target.value)}
                  placeholder="name@domain.com"
                />
              </Field>
              <Button variant="outline" onClick={() => test.mutate()} disabled={!testTo || test.isPending}>
                Send test
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {step !== 'who' ? (
            <Button variant="outline" onClick={() => go(previous(step))}>
              Back
            </Button>
          ) : null}
          {step !== 'check' ? (
            <Button onClick={() => go(forward(step))}>Continue</Button>
          ) : (
            <Button onClick={() => setConfirm(true)} disabled={altGaps.length > 0 || preview.isLoading || !preview.data}>
              Review and send
            </Button>
          )}
        </div>
      </section>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this email?</DialogTitle>
            <DialogDescription>{summary}.</DialogDescription>
          </DialogHeader>
          <p>
            {kindLabel(kind)} to {audienceSentence(audience).toLowerCase()}. The subject is "{subject}".
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Not yet
            </Button>
            <Button onClick={() => send.mutate()} disabled={send.isPending || count === 0}>
              {count === 0 ? 'Nobody to send to' : 'Send now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CampaignProgress({ id }: { id: string }) {
  const client = useQueryClient()
  const campaign = useQuery({
    queryKey: queryKeys.emails.campaign(id),
    queryFn: () =>
      api<EmailCampaign & { messages: EmailMessage[] }>({
        method: 'GET',
        path: `/admin/emails/campaigns/${id}`,
      }),
    refetchInterval: (query) => (query.state.data?.status === 'sending' ? 2000 : false),
  })
  const [retryNote, setRetryNote] = useState<string | null>(null)
  const act = useMutation({
    mutationFn: (action: 'pause' | 'resume' | 'cancel' | 'retry-failed') => {
      if (action === 'retry-failed') {
        return api<{ retried: number }>({
          method: 'POST',
          path: `/admin/emails/campaigns/${id}/retry-failed`,
        })
      }
      return api({ method: 'POST', path: `/admin/emails/campaigns/${id}/${action}` })
    },
    onSuccess: async (data, action) => {
      if (action === 'retry-failed' && data && typeof data === 'object' && 'retried' in data) {
        const note = `Retrying ${data.retried}`
        setRetryNote(note)
        toast.success(note)
      }
      await client.invalidateQueries({ queryKey: queryKeys.emails.campaign(id) })
      await client.invalidateQueries({ queryKey: queryKeys.emails.campaigns })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Action failed'),
  })
  const row = campaign.data
  const waiting = row ? Math.max(0, row.totalRecipients - row.sentCount - row.failedCount) : 0
  return (
    <div className="mt-2 rounded-lg border border-border bg-black px-4 py-3">
      <QueryBody loading={campaign.isLoading} error={campaign.error}>
        {row ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium">{row.name}</h2>
              <StatusBadge status={row.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Sent" value={row.sentCount} />
              <Stat label="Still waiting" value={waiting} />
              <Stat label="Failed" value={row.failedCount} />
              <Stat label="People" value={row.totalRecipients} />
            </div>
            <Can action="update" subject="email">
              <div className="mt-3 flex flex-wrap gap-2">
                {row.status === 'sending' || row.status === 'queued' ? (
                  <Button size="sm" variant="outline" onClick={() => act.mutate('pause')} disabled={act.isPending}>
                    Pause
                  </Button>
                ) : null}
                {row.status === 'paused' ? (
                  <Button size="sm" variant="outline" onClick={() => act.mutate('resume')} disabled={act.isPending}>
                    Resume
                  </Button>
                ) : null}
                {row.status !== 'completed' && row.status !== 'cancelled' ? (
                  <Button size="sm" variant="outline" onClick={() => act.mutate('cancel')} disabled={act.isPending}>
                    Cancel
                  </Button>
                ) : null}
                {row.failedCount > 0 ? (
                  <Button size="sm" variant="outline" onClick={() => act.mutate('retry-failed')} disabled={act.isPending}>
                    Retry failed
                  </Button>
                ) : null}
              </div>
              {retryNote ? <p className="mt-2 text-sm text-primary">{retryNote}</p> : null}
            </Can>
            <ul className="mt-4 max-h-56 divide-y divide-border overflow-auto">
              {row.messages.slice(0, 12).map((message) => (
                <li key={message.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span>
                    <span className="font-medium">{message.toName}</span>
                    <span className="mt-0.5 block font-mono text-muted-foreground">{message.toEmail}</span>
                  </span>
                  <Badge variant={message.status === 'failed' || message.status === 'bounced' ? 'destructive' : 'outline'}>
                    {MESSAGE_LABEL[message.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </QueryBody>
    </div>
  )
}

function BlockedAddresses({
  loading,
  error,
  rows,
}: {
  loading: boolean
  error: Error | null
  rows: Suppression[]
}) {
  return (
    <details className="rounded-lg border border-border bg-card px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">Blocked addresses</summary>
      <p className="mt-2 text-sm text-muted-foreground">
        These addresses are skipped on every send. They bounced, were marked as spam, or the person unsubscribed.
      </p>
      <div className="mt-3">
        <QueryBody loading={loading} error={error}>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked addresses.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-mono text-xs">{row.email}</span>
                  <span className="text-muted-foreground">{REASON_LABEL[row.reason]}</span>
                </li>
              ))}
            </ul>
          )}
        </QueryBody>
      </div>
    </details>
  )
}

function BlockCard({
  block,
  index,
  caret,
  onChange,
  onRemove,
}: {
  block: EmailBlock
  index: number
  caret: RefObject<Caret | null>
  onChange: (block: EmailBlock) => void
  onRemove: () => void
}) {
  const label = BLOCK_MENU.find((item) => item.type === block.type)?.label ?? 'Block'
  return (
    <div className="rounded-lg border border-border bg-black p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {index + 1}. {label}
        </p>
        <Button variant="ghost" size="xs" onClick={onRemove}>
          Remove
        </Button>
      </div>
      <BlockFields block={block} caret={caret} onChange={onChange} />
    </div>
  )
}

function BlockFields({
  block,
  caret,
  onChange,
}: {
  block: EmailBlock
  caret: RefObject<Caret | null>
  onChange: (block: EmailBlock) => void
}) {
  const [uploading, setUploading] = useState(false)
  if (block.type === 'divider') {
    return <p className="text-xs text-muted-foreground">A thin line between sections.</p>
  }
  if (block.type === 'image') {
    const local = block.url.startsWith('data:') || block.url.startsWith('blob:')
    return (
      <div className="space-y-2">
        {block.url ? (
          <img src={block.url} alt={block.alt || ''} className="max-h-36 rounded-md border border-border" />
        ) : null}
        <Field label="Picture link" hint="Paste a link, or upload a picture from your computer.">
          <Input
            placeholder={local ? 'Picture loaded from your computer' : 'https://'}
            value={local ? '' : block.url}
            onChange={(event) => onChange({ ...block, url: event.target.value })}
          />
        </Field>
        <div>
          <input
            id={`image-${block.id}`}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              void uploadImage(file, setUploading, (url) => onChange({ ...block, url }))
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            render={<label htmlFor={`image-${block.id}`} />}
          >
            {uploading ? 'Uploading' : 'Upload from your computer'}
          </Button>
        </div>
        <Field label="Picture description" hint="Required. Say what the picture shows, for people who cannot see it.">
          <Input value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} />
        </Field>
      </div>
    )
  }
  if (block.type === 'button') {
    return (
      <div className="space-y-2">
        <Field label="Button label">
          <Input
            value={block.label}
            onChange={(event) => onChange({ ...block, label: event.target.value })}
            {...bindField(caret, (label) => onChange({ ...block, label }))}
          />
        </Field>
        <Field label="Button link" hint="Use Insert and choose Payment link if this should open their payment page.">
          <Input
            value={block.href}
            onChange={(event) => onChange({ ...block, href: event.target.value })}
            {...bindField(caret, (href) => onChange({ ...block, href }))}
          />
        </Field>
      </div>
    )
  }
  if (block.type === 'columns') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Left side">
          <Textarea
            value={block.left}
            onChange={(event) => onChange({ ...block, left: event.target.value })}
            {...bindField(caret, (left) => onChange({ ...block, left }))}
          />
        </Field>
        <Field label="Right side">
          <Textarea
            value={block.right}
            onChange={(event) => onChange({ ...block, right: event.target.value })}
            {...bindField(caret, (right) => onChange({ ...block, right }))}
          />
        </Field>
      </div>
    )
  }
  return (
    <Textarea
      value={block.text}
      onChange={(event) => onChange({ ...block, text: event.target.value })}
      {...bindField(caret, (text) => onChange({ ...block, text }))}
    />
  )
}

function AddBlockMenu({ onAdd }: { onAdd: (type: EmailBlock['type']) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>Add a section</DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-64">
        {BLOCK_MENU.map((item) => (
          <DropdownMenuItem key={item.type} onClick={() => onAdd(item.type)}>
            <span>
              <span className="block">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function InsertMenu({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>Insert</DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-48">
        {INSERTS.map((item) => (
          <DropdownMenuItem key={item.token} onClick={() => onInsert(item.token)}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Choice({
  selected,
  title,
  hint,
  onClick,
}: {
  selected: boolean
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-3 text-left',
        selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
    </button>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      {children}
    </label>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value.toLocaleString('en-NG')}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const variant = status === 'failed' ? 'destructive' : status === 'sending' || status === 'completed' ? 'default' : 'outline'
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>
}

function bindField(caret: RefObject<Caret | null>, apply: (next: string) => void) {
  const remember = (event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const el = event.currentTarget
    caret.current = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
      value: el.value,
      apply,
    }
  }
  return {
    onFocus: remember,
    onClick: remember,
    onKeyUp: remember,
    onSelect: remember,
    onBlur: remember,
  }
}

function starterBlocks(): EmailBlock[] {
  return [
    { id: blockId(), type: 'heading', text: 'Hello {{firstName}}' },
    {
      id: blockId(),
      type: 'text',
      text: 'Your {{track}} payment of {{amount}} is still open. Reference {{reference}}.',
    },
    { id: blockId(), type: 'button', label: 'Pay now', href: '{{payLink}}' },
  ]
}

function emptyBlock(type: EmailBlock['type']): EmailBlock {
  const id = blockId()
  if (type === 'heading') return { id, type, text: '' }
  if (type === 'text') return { id, type, text: '' }
  if (type === 'image') return { id, type, url: '', alt: '' }
  if (type === 'button') return { id, type, label: 'Open', href: '{{payLink}}' }
  if (type === 'divider') return { id, type }
  return { id, type, left: '', right: '' }
}

function buildAudience(kind: EmailAudience['kind'], emails: string, pendingHours: string): EmailAudience {
  if (kind === 'all') return { kind: 'all' }
  if (kind === 'explicit') {
    return {
      kind: 'explicit',
      emails: emails
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    }
  }
  return {
    kind: 'filter',
    paymentStatuses: ['pending'],
    pendingHours: Number(pendingHours) || 24,
  }
}

function kindLabel(kind: EmailKind) {
  return kind === 'marketing' ? 'Promotion' : 'Important update'
}

function audienceSentence(audience: EmailAudience) {
  if (audience.kind === 'all') return 'Everyone'
  if (audience.kind === 'explicit') {
    const count = audience.emails?.length ?? 0
    return count === 1 ? '1 specific person' : `${count.toLocaleString('en-NG')} specific people`
  }
  const hours = audience.pendingHours ?? 24
  return `People who haven't paid yet (for ${hours} hours)`
}

function forward(step: Step): Step {
  if (step === 'who') return 'write'
  return 'check'
}

function previous(step: Step): Step {
  if (step === 'check') return 'write'
  return 'who'
}

async function uploadImage(
  file: File,
  setUploading: (value: boolean) => void,
  onUrl: (url: string) => void,
) {
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Pictures must be 5 MB or smaller.')
    return
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    toast.error('Use a JPEG, PNG, WebP, or GIF picture.')
    return
  }
  setUploading(true)
  try {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch('/api/bff/admin/emails/images', {
      method: 'POST',
      body: form,
      credentials: 'include',
    })
    const payload = (await response.json().catch(() => null)) as
      | { publicUrl?: string; message?: string }
      | null
    if (!response.ok || !payload?.publicUrl) {
      toast.error(payload?.message || 'Upload failed')
      return
    }
    onUrl(payload.publicUrl)
  } catch {
    toast.error(UNREACHABLE_MESSAGE)
  } finally {
    setUploading(false)
  }
}

async function uploadAttachment(
  file: File,
  setUploading: (value: boolean) => void,
  onFile: (file: EmailAttachment) => void,
) {
  if (file.size > 10 * 1024 * 1024) {
    toast.error('Attachments must be 10 MB or smaller.')
    return
  }
  setUploading(true)
  try {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch('/api/bff/admin/emails/attachments', {
      method: 'POST',
      body: form,
      credentials: 'include',
    })
    const payload = (await response.json().catch(() => null)) as
      | { publicUrl?: string; message?: string }
      | null
    if (!response.ok || !payload?.publicUrl) {
      toast.error(payload?.message || 'Upload failed')
      return
    }
    onFile({
      filename: file.name,
      url: payload.publicUrl,
      contentType: file.type || 'application/octet-stream',
    })
  } catch {
    toast.error(UNREACHABLE_MESSAGE)
  } finally {
    setUploading(false)
  }
}
