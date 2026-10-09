import { useEffect, useState } from 'react'

export type Chip = {
  selector: string
  label: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string) {
  return UUID_RE.test(value)
}

export function allPaidChip(): Chip {
  return { selector: 'allPaid', label: 'All paid students' }
}

export function courseChip(id: string, name: string, count?: number): Chip {
  const label =
    count == null ? name : `${name} (all ${count.toLocaleString('en-NG')})`
  return { selector: `course:${id}`, label }
}

export function addPeopleLabel(count: number) {
  const n = count.toLocaleString('en-NG')
  return count === 1 ? 'Add 1 person' : `Add ${n} people`
}

export function ageChip(spec: string, label: string): Chip {
  return { selector: `ageGroup:${spec}`, label }
}

export function studentChip(enrollmentId: string, name: string): Chip {
  return { selector: `student:${enrollmentId}`, label: name || 'One student' }
}

export function outsideChip(email: string): Chip {
  const trimmed = email.trim()
  return { selector: `email:${trimmed.toLowerCase()}`, label: trimmed }
}

export function isOutsideSelector(selector: string) {
  return selector.startsWith('email:')
}

/** A normal mailbox address. Spaces and a missing domain are not addresses. */
export function isEmailAddress(value: string) {
  const email = value.trim()
  if (email.length < 3 || email.length > 254) return false
  if (email.includes('..')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

/** Paste of several addresses. A single name or one address stays in the field. */
export function splitAddressPaste(raw: string) {
  if (!raw.includes('@')) return null
  const parts = raw
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 1 ? parts : null
}

/** Comma or semicolon finishes the address being typed. */
export function takeCommittedAddresses(value: string) {
  if (!/[,;]/.test(value)) return null
  const parts = value.split(/[,;]/)
  const rest = parts.pop() ?? ''
  return {
    ready: parts.map((part) => part.trim()).filter(Boolean),
    rest,
  }
}

export function invalidAddressNote(invalid: string[]) {
  if (invalid.length === 0) return null
  if (invalid.length === 1) return `${invalid[0]} is not an email address.`
  return `These are not email addresses: ${invalid.join(', ')}.`
}

export function presetAgeChips(): Chip[] {
  return [ageChip('13-17', 'Ages 13–17'), ageChip('18+', 'Ages 18+')]
}

/** From age and to age. Either one can be left blank. */
export function customAgeChip(fromRaw: string, toRaw: string): Chip | null {
  const from = parseAge(fromRaw)
  const to = parseAge(toRaw)
  if (fromRaw.trim() && from == null) return null
  if (toRaw.trim() && to == null) return null
  if (from == null && to == null) return null
  if (from != null && to != null) {
    if (from > to) return null
    return ageChip(`min=${from},max=${to}`, `Ages ${from}–${to}`)
  }
  if (from != null) return ageChip(`${from}+`, `Ages ${from}+`)
  return ageChip(`max=${to}`, `Up to age ${to}`)
}

function parseAge(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (value > 130) return null
  return value
}

export function selectorLabel(selector: string, courseNames: Map<string, string>) {
  if (selector === 'allPaid') return 'All paid students'
  if (selector.startsWith('course:')) {
    const id = selector.slice('course:'.length)
    return courseNames.get(id) || 'A course'
  }
  if (selector.startsWith('ageGroup:'))
    return ageGroupLabel(selector.slice('ageGroup:'.length))
  if (selector.startsWith('student:')) {
    const value = selector.slice('student:'.length)
    if (value.includes('@')) return value
    return 'One student'
  }
  if (selector.startsWith('email:')) {
    const address = selector.slice('email:'.length).trim()
    return address || 'An email address'
  }
  return 'Someone'
}

export function ageGroupLabel(spec: string) {
  const body = spec.trim().toLowerCase().replace(/\s+/g, '')
  const range = /^(\d+)-(\d+)$/.exec(body)
  if (range) return `Ages ${range[1]}–${range[2]}`
  const plus = /^(\d+)\+$/.exec(body)
  if (plus) return `Ages ${plus[1]}+`
  const minMax = /^min[:=](\d+)(?:,max[:=](\d+))?$/.exec(body)
  if (minMax) {
    if (minMax[2] != null) return `Ages ${minMax[1]}–${minMax[2]}`
    return `Ages ${minMax[1]}+`
  }
  const maxMin = /^max[:=](\d+)(?:,min[:=](\d+))?$/.exec(body)
  if (maxMin) {
    if (maxMin[2] != null) return `Ages ${maxMin[2]}–${maxMin[1]}`
    return `Up to age ${maxMin[1]}`
  }
  const exact = /^(\d+)$/.exec(body)
  if (exact) return `Age ${exact[1]}`
  return 'An age group'
}

export function audienceLabel(selectors: string[], courseNames: Map<string, string>) {
  const parts: string[] = []
  let students = 0
  for (const selector of selectors) {
    if (selector.startsWith('student:')) {
      const value = selector.slice('student:'.length)
      if (value.includes('@')) parts.push(value)
      else students += 1
      continue
    }
    parts.push(selectorLabel(selector, courseNames))
  }
  if (students === 1) parts.push('One student')
  else if (students > 1) parts.push(`${students} students`)
  return parts.filter(Boolean).join(', ') || 'No one yet'
}

export function chipsFromSelectors(
  selectors: string[],
  courseNames: Map<string, string>,
): Chip[] {
  return selectors.filter(Boolean).map((selector) => ({
    selector,
    label: selectorLabel(selector, courseNames),
  }))
}

export function addChip(chips: Chip[], next: Chip) {
  if (chips.some((chip) => chip.selector === next.selector)) return chips
  return [...chips, next]
}

export function draftName(chips: Chip[], subject: string) {
  const label = chips
    .map((chip) => chip.label)
    .filter(Boolean)
    .join(', ')
  return (label || subject || 'Email').slice(0, 160)
}

export function peopleLine(count: number, notInSystem = 0) {
  const n = count.toLocaleString('en-NG')
  const base = count === 1 ? 'This will go to 1 person' : `This will go to ${n} people`
  if (notInSystem < 1) return base
  if (notInSystem === 1) return `${base}, including 1 who is not a student`
  return `${base}, including ${notInSystem.toLocaleString('en-NG')} who are not students`
}

export function outsideCountLine(notInSystem: number) {
  if (notInSystem === 1) return '1 is not a student.'
  if (notInSystem > 1)
    return `${notInSystem.toLocaleString('en-NG')} are not students.`
  return null
}

export function sendQuestion(count: number) {
  const n = count.toLocaleString('en-NG')
  return count === 1 ? 'Send to 1 person?' : `Send to ${n} people?`
}

export function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

export function storedHtml(html: string) {
  return htmlToText(html) ? html : null
}

export function snippetFrom(html: string, text?: string | null) {
  const plain = (text?.trim() || htmlToText(html)).replace(/\s+/g, ' ').trim()
  if (!plain) return ''
  return plain.length > 90 ? `${plain.slice(0, 90)}…` : plain
}

export function recipientOutcome(status: string): 'sent' | 'failed' | 'sending' {
  if (status === 'failed' || status === 'bounced' || status === 'complained')
    return 'failed'
  if (status === 'queued' || status === 'sending') return 'sending'
  return 'sent'
}

export function isLiveCourseStatus(status: string) {
  return status !== 'draft' && status !== 'archived'
}

export function useDebounced(value: string, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function toLocalDateTimeInput(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function countNote(sent: number, failed: number) {
  return {
    sentLabel: `${sent.toLocaleString('en-NG')} sent`,
    failedLabel: failed > 0 ? `${failed.toLocaleString('en-NG')} failed` : null,
  }
}

export function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
