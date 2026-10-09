import { describe, expect, it } from 'vitest'
import {
  addChip,
  allPaidChip,
  audienceLabel,
  chipsFromSelectors,
  addPeopleLabel,
  courseChip,
  customAgeChip,
  draftName,
  htmlToText,
  invalidAddressNote,
  isEmailAddress,
  outsideChip,
  peopleLine,
  presetAgeChips,
  splitAddressPaste,
  sendQuestion,
  storedHtml,
  studentChip,
} from '@/lib/email-compose'
import { paymentEmailView } from '@/lib/payment-email'

const courses = new Map([['11111111-1111-4111-8111-111111111111', 'Robotics']])

describe('email compose', () => {
  it('maps chips to the recipient selectors', () => {
    const courseId = '11111111-1111-4111-8111-111111111111'
    const chips = [
      allPaidChip(),
      courseChip(courseId, 'Robotics'),
      ...presetAgeChips(),
      customAgeChip('13', '15'),
      customAgeChip('21', ''),
      customAgeChip('', '12'),
      studentChip('22222222-2222-4222-8222-222222222222', 'Ada Okoye'),
    ]
    expect(chips.map((chip) => chip?.selector)).toEqual([
      'allPaid',
      `course:${courseId}`,
      'ageGroup:13-17',
      'ageGroup:18+',
      'ageGroup:min=13,max=15',
      'ageGroup:21+',
      'ageGroup:max=12',
      'student:22222222-2222-4222-8222-222222222222',
    ])
    expect(customAgeChip('18', '13')).toBeNull()
    expect(addChip([allPaidChip()], allPaidChip())).toHaveLength(1)
    expect(courseChip(courseId, 'Robotics', 12).label).toBe('Robotics (all 12)')
    expect(addPeopleLabel(1)).toBe('Add 1 person')
    expect(addPeopleLabel(12)).toBe('Add 12 people')
  })

  it('describes who an email went to', () => {
    expect(
      audienceLabel(
        ['allPaid', 'course:11111111-1111-4111-8111-111111111111'],
        courses,
      ),
    ).toBe('All paid students, Robotics')
    expect(
      audienceLabel(['student:ada@example.com', 'student:not-an-email'], courses),
    ).toBe('ada@example.com, One student')
    expect(chipsFromSelectors(['ageGroup:13-17'], courses)[0]?.label).toBe('Ages 13–17')
    expect(
      draftName(
        [studentChip('id', 'Ada Okoye'), courseChip('id', 'Robotics')],
        'Hello',
      ),
    ).toBe('Ada Okoye, Robotics')
    expect(peopleLine(48)).toBe('This will go to 48 people')
    expect(peopleLine(1)).toBe('This will go to 1 person')
    expect(peopleLine(13, 1)).toBe(
      'This will go to 13 people, including 1 who is not a student',
    )
    expect(peopleLine(13, 2)).toBe(
      'This will go to 13 people, including 2 who are not students',
    )
    expect(sendQuestion(48)).toBe('Send to 48 people?')
    expect(outsideChip('Tee@Gmail.com')).toEqual({
      selector: 'email:tee@gmail.com',
      label: 'Tee@Gmail.com',
    })
    expect(isEmailAddress('tee@gmail.com')).toBe(true)
    expect(isEmailAddress('tee@gmail')).toBe(false)
    expect(isEmailAddress('not an email')).toBe(false)
    expect(splitAddressPaste('a@x.com, b@y.com')).toEqual(['a@x.com', 'b@y.com'])
    expect(splitAddressPaste('Ada Okoye')).toBeNull()
    expect(invalidAddressNote(['nope'])).toBe('nope is not an email address.')
    expect(chipsFromSelectors(['email:tee@gmail.com'], courses)[0]?.label).toBe(
      'tee@gmail.com',
    )
  })

  it('keeps message text and clears an empty message', () => {
    expect(
      htmlToText('<p>Hello <strong>there</strong></p><ul><li>One</li></ul>'),
    ).toContain('Hello there')
    expect(storedHtml('<p>Join here</p>')).toBe('<p>Join here</p>')
    expect(storedHtml('<p><br></p>')).toBeNull()
    expect(storedHtml('')).toBeNull()
  })
})

describe('payment email column', () => {
  it('shows sent, sending, failed, and not sent', () => {
    expect(
      paymentEmailView({
        emailStatus: 'sent',
        emailSentAt: '2026-10-08T09:00:00.000Z',
        emailError: null,
      }).text,
    ).toContain('Sent')
    expect(
      paymentEmailView({ emailStatus: 'sending', emailSentAt: null, emailError: null }),
    ).toEqual({
      tone: 'sending',
      text: 'Sending',
    })
    expect(
      paymentEmailView({ emailStatus: 'pending', emailSentAt: null, emailError: null })
        .text,
    ).toBe('Sending')
    expect(
      paymentEmailView({
        emailStatus: 'failed',
        emailSentAt: null,
        emailError: 'Mailbox full',
      }),
    ).toEqual({ tone: 'failed', text: 'Failed', reason: 'Mailbox full' })
    expect(
      paymentEmailView({ emailStatus: null, emailSentAt: null, emailError: null }),
    ).toEqual({
      tone: 'none',
      text: 'Not sent',
    })
  })
})
