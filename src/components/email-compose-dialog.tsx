import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SimpleHtmlEditor } from '@/components/simple-html-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  addChip,
  addPeopleLabel,
  allPaidChip,
  audienceLabel,
  chipsFromSelectors,
  courseChip,
  customAgeChip,
  draftName,
  htmlToText,
  invalidAddressNote,
  isEmailAddress,
  isLiveCourseStatus,
  isOutsideSelector,
  isUuid,
  outsideChip,
  outsideCountLine,
  peopleLine,
  presetAgeChips,
  sendQuestion,
  splitAddressPaste,
  studentChip,
  takeCommittedAddresses,
  toLocalDateTimeInput,
  useDebounced,
  type Chip,
} from '@/lib/email-compose'
import { formatWat } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import type { AdminCourse } from '@/queries/courses/interfaces/course.dto'
import type {
  CourseStudent,
  CourseStudents,
  EmailDraft,
  RecipientPreview,
  SaveEmailDraftBody,
  StudentSearchItem,
} from '@/queries/emails/interfaces/email.dto'
import { cn } from 'cn'

type Folder = 'sent' | 'drafts' | 'scheduled'

export function ComposeDialog({
  draft,
  courses,
  canWrite,
  onClose,
  onChanged,
}: {
  draft: EmailDraft | null
  courses: AdminCourse[]
  canWrite: boolean
  onClose: () => void
  onChanged: (folder: Folder) => void
}) {
  const client = useQueryClient()
  const courseNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const course of courses) names.set(course.id, course.name)
    return names
  }, [courses])
  const starting = chipsFromSelectors(draft?.selectors ?? [], courseNames)
  const [subject, setSubject] = useState(draft?.subject ?? '')
  const [html, setHtml] = useState(draft?.html ?? '')
  const [chips, setChips] = useState<Chip[]>(starting)
  const [status, setStatus] = useState(draft?.status ?? 'draft')
  const [scheduledAt, setScheduledAt] = useState(draft?.scheduledAt ?? null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(Boolean(draft?.scheduledAt))
  const [when, setWhen] = useState(toLocalDateTimeInput(draft?.scheduledAt))
  const [cancelAsk, setCancelAsk] = useState(false)
  const [busy, setBusy] = useState<
    'save' | 'send' | 'test' | 'schedule' | 'delete' | null
  >(null)
  const [savedNote, setSavedNote] = useState<string | null>(draft ? 'Saved' : null)
  const idRef = useRef<string | null>(draft?.id ?? null)
  const subjectRef = useRef(subject)
  const htmlRef = useRef(html)
  const chipsRef = useRef(chips)
  const lock = useRef<Promise<EmailDraft | null> | null>(null)
  const initialSnap = JSON.stringify({
    subject: (draft?.subject ?? '').trim(),
    html: draft?.html ?? '',
    selectors: draft?.selectors ?? [],
    labels: starting.map((chip) => chip.label),
  })
  const savedSnap = useRef(initialSnap)
  subjectRef.current = subject
  htmlRef.current = html
  chipsRef.current = chips

  const selectorKey = JSON.stringify(chips.map((chip) => chip.selector))
  const debouncedSelectors = useDebounced(selectorKey, 400)
  const preview = useQuery({
    queryKey: ['emails', 'recipient-preview', debouncedSelectors],
    enabled: debouncedSelectors !== '[]',
    queryFn: () =>
      api<RecipientPreview>({
        method: 'POST',
        path: '/admin/emails/recipients/preview',
        body: { selectors: JSON.parse(debouncedSelectors) as string[] },
      }),
  })

  useEffect(() => {
    const sample = preview.data?.sample
    if (!sample?.length) return
    setChips((current) => {
      let changed = false
      const next = current.map((chip) => {
        if (!chip.selector.startsWith('student:') || chip.label !== 'One student')
          return chip
        const value = chip.selector.slice('student:'.length)
        const hit = sample.find(
          (person) =>
            person.enrollmentId === value ||
            person.email.toLowerCase() === value.toLowerCase(),
        )
        if (!hit) return chip
        changed = true
        return { ...chip, label: hit.name || hit.email }
      })
      return changed ? next : current
    })
  }, [preview.data])

  const snap = JSON.stringify({
    subject: subject.trim(),
    html,
    selectors: chips.map((chip) => chip.selector),
    labels: chips.map((chip) => chip.label),
  })

  async function persist() {
    if (lock.current) return lock.current
    const run = (async () => {
      const currentSubject = subjectRef.current.trim()
      if (!currentSubject) return null
      const currentHtml = htmlRef.current
      const currentChips = chipsRef.current
      const body: SaveEmailDraftBody = {
        name: draftName(currentChips, currentSubject),
        subject: currentSubject,
        html: currentHtml,
        text: htmlToText(currentHtml),
        selectors: currentChips.map((chip) => chip.selector),
        kind: 'transactional',
      }
      const id = idRef.current
      const saved = id
        ? await api<EmailDraft>({
            method: 'PATCH',
            path: `/admin/emails/drafts/${id}`,
            body,
          })
        : await api<EmailDraft>({ method: 'POST', path: '/admin/emails/drafts', body })
      idRef.current = saved.id
      setStatus(saved.status)
      setScheduledAt(saved.scheduledAt)
      savedSnap.current = JSON.stringify({
        subject: currentSubject,
        html: currentHtml,
        selectors: body.selectors,
        labels: currentChips.map((chip) => chip.label),
      })
      setSavedNote('Saved')
      return saved
    })()
    lock.current = run
    try {
      return await run
    } finally {
      if (lock.current === run) lock.current = null
    }
  }

  const persistRef = useRef(persist)
  persistRef.current = persist

  useEffect(() => {
    if (!canWrite || !subject.trim() || snap === savedSnap.current || busy) return
    const timer = setTimeout(() => {
      setSavedNote('Saving…')
      void persistRef.current().catch(() => setSavedNote(null))
    }, 1500)
    return () => clearTimeout(timer)
  }, [snap, subject, busy, canWrite])

  const count = preview.data?.count ?? 0
  const notInSystem = preview.data?.notInSystem ?? 0
  const checking =
    chips.length > 0 && (selectorKey !== debouncedSelectors || preview.isFetching)
  const title = !draft
    ? 'New email'
    : draft.status === 'scheduled'
      ? 'Scheduled email'
      : 'Draft'

  function refreshLists() {
    void client.invalidateQueries({ queryKey: queryKeys.emails.sent })
    void client.invalidateQueries({ queryKey: queryKeys.emails.drafts })
  }

  async function saveDraft() {
    if (!subject.trim()) {
      setNotice('Add a subject.')
      return
    }
    setBusy('save')
    setNotice(null)
    try {
      await persist()
      toast.success('Draft saved')
      refreshLists()
      onChanged('drafts')
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not save the draft',
      )
    } finally {
      setBusy(null)
    }
  }

  function askSend() {
    if (!subject.trim()) {
      setNotice('Add a subject.')
      return
    }
    if (!chips.length) {
      setNotice('Add who this should go to.')
      return
    }
    if (checking) {
      setNotice('Still checking who will get this.')
      return
    }
    if (!preview.data || count < 1) {
      setNotice('No one to send this to.')
      return
    }
    setNotice(null)
    setConfirming(true)
  }

  async function sendNow() {
    setBusy('send')
    setNotice(null)
    try {
      const saved = await persist()
      if (!saved) {
        setNotice('Add a subject.')
        return
      }
      await api({ method: 'POST', path: `/admin/emails/drafts/${saved.id}/send` })
      toast.success('Email sent')
      refreshLists()
      onChanged('sent')
      onClose()
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not send the email',
      )
    } finally {
      setBusy(null)
      setConfirming(false)
    }
  }

  async function sendTest() {
    if (!subject.trim()) {
      setNotice('Add a subject.')
      return
    }
    setBusy('test')
    setNotice(null)
    try {
      await api({
        method: 'POST',
        path: '/admin/emails/test-to-me',
        body: { subject: subject.trim(), html, text: htmlToText(html) },
      })
      toast.success('Test sent to you')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not send the test')
    } finally {
      setBusy(null)
    }
  }

  async function schedule() {
    if (!subject.trim()) {
      setNotice('Add a subject.')
      return
    }
    if (!chips.length) {
      setNotice('Add who this should go to.')
      return
    }
    const sendAt = new Date(when)
    if (!when || Number.isNaN(sendAt.getTime()) || sendAt.getTime() <= Date.now()) {
      setNotice('Pick a time in the future.')
      return
    }
    setBusy('schedule')
    setNotice(null)
    try {
      const saved = await persist()
      if (!saved) {
        setNotice('Add a subject.')
        return
      }
      const updated = await api<EmailDraft>({
        method: 'POST',
        path: `/admin/emails/drafts/${saved.id}/schedule`,
        body: { sendAt: sendAt.toISOString() },
      })
      setStatus(updated.status)
      setScheduledAt(updated.scheduledAt)
      toast.success('Email scheduled')
      refreshLists()
      onChanged('scheduled')
      onClose()
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not schedule the email',
      )
    } finally {
      setBusy(null)
    }
  }

  async function removeDraft() {
    setBusy('delete')
    try {
      if (idRef.current) {
        await api({ method: 'DELETE', path: `/admin/emails/drafts/${idRef.current}` })
        toast.success(status === 'scheduled' ? 'Schedule cancelled' : 'Draft deleted')
        refreshLists()
        onChanged(status === 'scheduled' ? 'scheduled' : 'drafts')
      }
      onClose()
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not delete the email',
      )
    } finally {
      setBusy(null)
    }
  }

  const whoLine = !chips.length
    ? 'Add who this should go to.'
    : checking
      ? 'Checking how many people…'
      : preview.isError
        ? 'Could not check how many people.'
        : peopleLine(count, notInSystem)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Choose who gets it, then write the message.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-border">
            <div className="flex flex-wrap items-center gap-2 px-2 py-2">
            <span className="text-sm text-muted-foreground">To</span>
            {chips.map((chip) => (
              <RecipientChip
                key={chip.selector}
                chip={chip}
                onRemove={
                  canWrite
                    ? () =>
                        setChips((current) =>
                          current.filter((item) => item.selector !== chip.selector),
                        )
                    : undefined
                }
              />
            ))}
            {canWrite ? (
              <AddMenu
                courses={courses}
                onAdd={(chip) => setChips((current) => addChip(current, chip))}
              />
            ) : (
              <span className="text-sm">
                {audienceLabel(
                  chips.map((chip) => chip.selector),
                  courseNames,
                )}
              </span>
            )}
            </div>
            {canWrite ? (
              <AddressField
                onAdd={(chip) => setChips((current) => addChip(current, chip))}
              />
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{whoLine}</p>
          {status === 'scheduled' && scheduledAt ? (
            <div className="rounded-lg border border-border bg-raised px-3 py-2 text-sm">
              <p>Scheduled for {formatWat(scheduledAt)}</p>
              {canWrite ? (
                cancelAsk ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span>Cancel this schedule? The email will be removed.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy != null}
                      onClick={() => void removeDraft()}
                    >
                      Cancel schedule
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCancelAsk(false)}
                    >
                      Keep it
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setCancelAsk(true)}
                  >
                    Cancel schedule
                  </Button>
                )
              ) : null}
            </div>
          ) : null}
          <Input
            aria-label="Subject"
            placeholder="Subject"
            value={subject}
            disabled={!canWrite}
            onChange={(event) => setSubject(event.target.value)}
          />
          <SimpleHtmlEditor
            label="Message"
            value={html}
            onChange={setHtml}
            placeholder="Write the message"
            readOnly={!canWrite}
          />
          {notice ? <p className="text-sm text-warn">{notice}</p> : null}
          {scheduleOpen && canWrite ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="block space-y-1 text-sm">
                <span>Send on</span>
                <Input
                  aria-label="Send on"
                  type="datetime-local"
                  value={when}
                  onChange={(event) => setWhen(event.target.value)}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={busy != null}
                onClick={() => void schedule()}
              >
                {busy === 'schedule' ? 'Scheduling' : 'Set schedule'}
              </Button>
            </div>
          ) : null}
          {canWrite ? (
            confirming ? (
              <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-3">
                <p className="text-sm font-medium">{sendQuestion(count)}</p>
                {outsideCountLine(notInSystem) ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {outsideCountLine(notInSystem)}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={busy != null}
                    onClick={() => void sendNow()}
                  >
                    {busy === 'send' ? 'Sending' : 'Send'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirming(false)}
                  >
                    Not yet
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" disabled={busy != null} onClick={askSend}>
                  Send
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy != null}
                  onClick={() => void sendTest()}
                >
                  {busy === 'test' ? 'Sending test' : 'Send test to me'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy != null}
                  onClick={() => void saveDraft()}
                >
                  {busy === 'save' ? 'Saving' : 'Save draft'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setScheduleOpen((open) => !open)}
                >
                  Schedule
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  aria-label={
                    status === 'scheduled' ? 'Cancel schedule' : 'Delete draft'
                  }
                  disabled={busy != null}
                  onClick={() => {
                    if (status === 'scheduled') {
                      setCancelAsk(true)
                      return
                    }
                    if (!idRef.current) {
                      onClose()
                      return
                    }
                    void removeDraft()
                  }}
                >
                  <TrashIcon />
                </Button>
                {savedNote ? (
                  <span className="text-xs text-muted-foreground">{savedNote}</span>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RecipientChip({ chip, onRemove }: { chip: Chip; onRemove?: () => void }) {
  const outside = isOutsideSelector(chip.selector)
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-raised px-2 py-1 text-xs">
      <span className="truncate">{chip.label}</span>
      {outside ? (
        <span className="shrink-0 text-muted-foreground">· Not a student</span>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Remove ${chip.label}`}
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
    </span>
  )
}

function AddressField({ onAdd }: { onAdd: (chip: Chip) => void }) {
  const [query, setQuery] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const debounced = useDebounced(query.trim(), 300)
  const students = useQuery({
    queryKey: ['emails', 'to-search', debounced],
    enabled: debounced.length >= 2,
    queryFn: () => searchStudents(debounced),
  })
  const found = Array.isArray(students.data) ? students.data : []
  const email = isEmailAddress(debounced) ? debounced : null
  const exact = email
    ? found.find((item) => item.email.trim().toLowerCase() === email.toLowerCase())
    : undefined
  const showOutside =
    email != null &&
    query.trim() === debounced &&
    !students.isFetching &&
    !exact

  async function addToken(raw: string, fromList = false) {
    const token = raw.trim()
    if (!token) return 'empty' as const
    if (!isEmailAddress(token)) {
      if (fromList || token.includes('@')) return 'invalid' as const
      const matches = await searchStudents(token)
      if (matches.length === 1) {
        const student = matches[0]
        if (student) onAdd(studentChip(student.enrollmentId, student.name))
        return 'added' as const
      }
      return matches.length > 1 ? ('pick' as const) : ('name' as const)
    }
    const matches = await searchStudents(token)
    const student = matches.find(
      (item) => item.email.trim().toLowerCase() === token.toLowerCase(),
    )
    onAdd(
      student ? studentChip(student.enrollmentId, student.name) : outsideChip(token),
    )
    return 'added' as const
  }

  function noteFor(result: 'invalid' | 'pick' | 'name', token: string) {
    if (result === 'pick') return 'Pick a student from the list.'
    if (result === 'name')
      return 'No student has that name. Type an email address to add them.'
    return invalidAddressNote([token])
  }

  async function addMany(parts: string[]) {
    const invalid: string[] = []
    for (const part of parts) {
      const result = await addToken(part, true)
      if (result === 'invalid') invalid.push(part.trim())
    }
    setNote(invalidAddressNote(invalid))
  }

  return (
    <div className="border-t border-border px-2 py-1.5">
      <input
        aria-label="Type a name or any email"
        placeholder="Type a name or any email…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={query}
        onChange={(event) => {
          const next = event.target.value
          const committed = takeCommittedAddresses(next)
          if (committed) {
            setQuery(committed.rest)
            void addMany(committed.ready)
            return
          }
          setQuery(next)
          setNote(null)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          const current = query
          void addToken(current).then((result) => {
            if (result === 'added' || result === 'empty') {
              setQuery('')
              setNote(null)
              return
            }
            setNote(noteFor(result, current.trim()))
          })
        }}
        onPaste={(event) => {
          const pasted = splitAddressPaste(event.clipboardData.getData('text'))
          if (!pasted) return
          event.preventDefault()
          setQuery('')
          void addMany(pasted)
        }}
      />
      {note ? <p className="pt-1 text-xs text-muted-foreground">{note}</p> : null}
      {debounced.length >= 2 && query.trim() === debounced ? (
        <div className="mt-1 space-y-0.5">
          {students.isFetching ? (
            <p className="px-1 py-1 text-sm text-muted-foreground">Looking…</p>
          ) : (
            <>
              {found.map((item) => (
                <button
                  key={item.enrollmentId}
                  type="button"
                  className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-accent"
                  onClick={() => {
                    onAdd(studentChip(item.enrollmentId, item.name))
                    setQuery('')
                    setNote(null)
                  }}
                >
                  <span className="block text-sm">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.email}
                  </span>
                </button>
              ))}
              {showOutside ? (
                <button
                  type="button"
                  className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onAdd(outsideChip(email))
                    setQuery('')
                    setNote(null)
                  }}
                >
                  Add {email} (not a student)
                </button>
              ) : null}
              {!students.isFetching && found.length === 0 && !showOutside ? (
                <p className="px-1 py-1 text-sm text-muted-foreground">
                  No students match that. An email address can still be added.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

async function searchStudents(q: string) {
  const result = await api<{ items: StudentSearchItem[] }>({
    method: 'GET',
    path: '/admin/emails/students/search',
    query: { q },
  })
  return Array.isArray(result.items) ? result.items : []
}

function AddMenu({
  courses,
  onAdd,
}: {
  courses: AdminCourse[]
  onAdd: (chip: Chip) => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [sub, setSub] = useState<'course' | 'age' | 'student' | null>(null)
  const [box, setBox] = useState<{ top: number; left: number } | null>(null)
  const [fromAge, setFromAge] = useState('')
  const [toAge, setToAge] = useState('')
  const [ageNote, setAgeNote] = useState<string | null>(null)
  const [studentQuery, setStudentQuery] = useState('')
  const [courseId, setCourseId] = useState<string | null>(null)
  const debouncedStudent = useDebounced(studentQuery, 300)
  const live = courses.filter(
    (course) => isLiveCourseStatus(course.status) && isUuid(course.id),
  )
  const counts = useQuery({
    queryKey: ['emails', 'menu-counts', live.map((course) => course.id).join(',')],
    enabled: open,
    queryFn: async () => {
      const allPaid = await countSelectors(['allPaid'])
      const courseCounts: Record<string, number | null> = {}
      await Promise.all(
        live.map(async (course) => {
          courseCounts[course.id] = await countSelectors([`course:${course.id}`])
        }),
      )
      return { allPaid, courseCounts }
    },
  })
  const students = useQuery({
    queryKey: ['emails', 'student-search', debouncedStudent],
    enabled: open && sub === 'student' && debouncedStudent.trim().length > 0,
    queryFn: () =>
      api<{ items: StudentSearchItem[] }>({
        method: 'GET',
        path: '/admin/emails/students/search',
        query: { q: debouncedStudent.trim() },
      }),
  })

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const picker = sub === 'course' && courseId != null
    const panels = 1 + (sub ? 1 : 0) + (picker ? 1 : 0)
    const width = panels * 300
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    setBox({ top: rect.bottom + 6, left })
  }

  useEffect(() => {
    if (!open) return
    place()
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target))
        return
      setOpen(false)
      setSub(null)
      setCourseId(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        setSub(null)
        setCourseId(null)
      }
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, sub, courseId])

  const pickerOpen = sub === 'course' && courseId != null
  const beside = box
    ? box.left + 280 + (sub ? 288 : 0) + (pickerOpen ? 336 : 0) < window.innerWidth
    : false
  const paidCount = counts.data?.allPaid
  const foundStudents = Array.isArray(students.data?.items) ? students.data.items : []

  function closeMenu() {
    setOpen(false)
    setSub(null)
    setCourseId(null)
  }

  function choose(chip: Chip) {
    onAdd(chip)
    closeMenu()
  }

  function openSub(next: 'course' | 'age' | 'student') {
    setSub(next)
    if (next !== 'course') setCourseId(null)
  }

  const pickedCourse = live.find((course) => course.id === courseId) ?? null

  const menu =
    open && box && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[80] flex items-start gap-1"
            style={{ top: box.top, left: box.left }}
          >
            {(beside || (sub == null && !pickerOpen)) && (
              <div className="w-[280px] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                <MenuButton onClick={() => choose(allPaidChip())}>
                  👥 All paid students
                  {paidCount == null ? '' : ` (${paidCount.toLocaleString('en-NG')})`}
                </MenuButton>
                <MenuButton active={sub === 'course'} onClick={() => openSub('course')}>
                  <span className="flex-1">📘 Students in a course</span>
                  <span aria-hidden>▸</span>
                </MenuButton>
                <MenuButton active={sub === 'age'} onClick={() => openSub('age')}>
                  <span className="flex-1">🎂 An age group</span>
                  <span aria-hidden>▸</span>
                </MenuButton>
                <MenuButton
                  active={sub === 'student'}
                  onClick={() => openSub('student')}
                >
                  <span className="flex-1">👤 One student…</span>
                  <span aria-hidden>▸</span>
                </MenuButton>
              </div>
            )}
            {sub && (beside || !pickerOpen) ? (
              <div className="max-h-80 w-[280px] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                {!beside ? (
                  <MenuButton onClick={() => setSub(null)}>← Back</MenuButton>
                ) : null}
                {sub === 'course' ? (
                  live.length === 0 ? (
                    <p className="px-2 py-2 text-sm text-muted-foreground">
                      No open courses right now.
                    </p>
                  ) : (
                    live.map((course) => {
                      const courseCount = counts.data?.courseCounts[course.id]
                      return (
                        <MenuButton
                          key={course.id}
                          active={course.id === courseId}
                          onClick={() => {
                            setCourseId(course.id)
                            setSub('course')
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">{course.name}</span>
                          <span className="text-muted-foreground">
                            {courseCount == null
                              ? ''
                              : courseCount.toLocaleString('en-NG')}
                          </span>
                        </MenuButton>
                      )
                    })
                  )
                ) : null}
                {sub === 'age' ? (
                  <div className="space-y-1">
                    {presetAgeChips().map((chip) => (
                      <MenuButton key={chip.selector} onClick={() => choose(chip)}>
                        {chip.label}
                      </MenuButton>
                    ))}
                    <div className="space-y-2 px-2 py-2">
                      <p className="text-xs text-muted-foreground">
                        Or a custom age range
                      </p>
                      <div className="flex gap-2">
                        <Input
                          aria-label="From age"
                          inputMode="numeric"
                          placeholder="From"
                          value={fromAge}
                          onChange={(event) =>
                            setFromAge(event.target.value.replace(/[^\d]/g, ''))
                          }
                        />
                        <Input
                          aria-label="To age"
                          inputMode="numeric"
                          placeholder="To"
                          value={toAge}
                          onChange={(event) =>
                            setToAge(event.target.value.replace(/[^\d]/g, ''))
                          }
                        />
                      </div>
                      {ageNote ? <p className="text-xs text-warn">{ageNote}</p> : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const chip = customAgeChip(fromAge, toAge)
                          if (!chip) {
                            setAgeNote(
                              'Enter a from age, a to age, or both. The from age cannot be higher.',
                            )
                            return
                          }
                          setAgeNote(null)
                          choose(chip)
                        }}
                      >
                        Add ages
                      </Button>
                    </div>
                  </div>
                ) : null}
                {sub === 'student' ? (
                  <div className="space-y-1 p-1">
                    <Input
                      aria-label="Search students"
                      placeholder="Name or email"
                      value={studentQuery}
                      onChange={(event) => setStudentQuery(event.target.value)}
                    />
                    {!studentQuery.trim() ? (
                      <p className="px-1 py-2 text-sm text-muted-foreground">
                        Type a name or email.
                      </p>
                    ) : students.isFetching ? (
                      <p className="px-1 py-2 text-sm text-muted-foreground">
                        Looking…
                      </p>
                    ) : foundStudents.length === 0 ? (
                      <p className="px-1 py-2 text-sm text-muted-foreground">
                        No students match that.
                      </p>
                    ) : (
                      foundStudents.map((item) => (
                        <button
                          key={item.enrollmentId}
                          type="button"
                          className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-accent"
                          onClick={() =>
                            onAdd(studentChip(item.enrollmentId, item.name))
                          }
                        >
                          <span className="block text-sm">{item.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {item.email}
                          </span>
                          {item.courses.length ? (
                            <span className="block text-xs text-muted-foreground">
                              {item.courses.join(', ')}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
            {pickerOpen && pickedCourse ? (
              <CoursePeople
                key={pickedCourse.id}
                course={pickedCourse}
                showBack={!beside}
                onBack={() => setCourseId(null)}
                onAddAll={(count) => {
                  onAdd(courseChip(pickedCourse.id, pickedCourse.name, count))
                  closeMenu()
                }}
                onAddPeople={(people) => {
                  for (const person of people) {
                    onAdd(studentChip(person.enrollmentId, person.name))
                  }
                  closeMenu()
                }}
              />
            ) : null}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((current) => !current)
          setSub(null)
          setCourseId(null)
          place()
        }}
      >
        + Add ▾
      </button>
      {menu}
    </>
  )
}

function CoursePeople({
  course,
  showBack,
  onBack,
  onAddAll,
  onAddPeople,
}: {
  course: AdminCourse
  showBack: boolean
  onBack: () => void
  onAddAll: (count: number) => void
  onAddPeople: (people: CourseStudent[]) => void
}) {
  const roster = useQuery({
    queryKey: ['emails', 'course-students', course.id],
    queryFn: () =>
      api<CourseStudents>({
        method: 'GET',
        path: `/admin/emails/courses/${course.id}/students`,
      }),
  })
  const [query, setQuery] = useState('')
  const [everyone, setEveryone] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const people = Array.isArray(roster.data?.items) ? roster.data.items : []
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? people.filter(
        (person) =>
          person.name.toLowerCase().includes(needle) ||
          person.email.toLowerCase().includes(needle),
      )
    : people
  const total = roster.data?.count ?? null
  const addCount = everyone ? (total ?? 0) : picked.size
  const everyoneLabel =
    total == null
      ? `Everyone in ${course.name}`
      : `Everyone in ${course.name} (${total.toLocaleString('en-NG')})`

  function togglePerson(id: string) {
    if (everyone) {
      setEveryone(false)
      setPicked(new Set([id]))
      return
    }
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex max-h-[28rem] w-[min(20rem,calc(100vw-1rem))] flex-col rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
      {showBack ? <MenuButton onClick={onBack}>← Courses</MenuButton> : null}
      <div className="p-2">
        <Input
          aria-label={`Search in ${course.name}`}
          placeholder={`Search in ${course.name}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <label className="mx-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={everyone}
          disabled={roster.isLoading || total == null}
          onChange={() => {
            setEveryone((current) => !current)
            setPicked(new Set())
          }}
        />
        <span>{everyoneLabel}</span>
      </label>
      <div className="mx-2 border-t border-border" />
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {roster.isLoading ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">Loading people…</p>
        ) : roster.isError ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            Could not load this course.
          </p>
        ) : people.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            No one has paid for this course yet.
          </p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">No one matches that.</p>
        ) : (
          visible.map((person) => (
            <label
              key={person.enrollmentId}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={!everyone && picked.has(person.enrollmentId)}
                onChange={() => togglePerson(person.enrollmentId)}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm">{person.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {person.email}
                </span>
              </span>
            </label>
          ))
        )}
      </div>
      <div className="border-t border-border p-2">
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={addCount < 1 || roster.isLoading || roster.isError}
          onClick={() => {
            if (everyone) {
              onAddAll(total ?? 0)
              return
            }
            onAddPeople(people.filter((person) => picked.has(person.enrollmentId)))
          }}
        >
          {addPeopleLabel(addCount)}
        </Button>
      </div>
    </div>
  )
}

function MenuButton({
  children,
  onClick,
  active,
}: {
  children: ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
        active && 'bg-accent',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7l1 12h6l1-12" />
    </svg>
  )
}

async function countSelectors(selectors: string[]) {
  try {
    const preview = await api<RecipientPreview>({
      method: 'POST',
      path: '/admin/emails/recipients/preview',
      body: { selectors },
    })
    return preview.count
  } catch {
    return null
  }
}
