import { describe, expect, it } from 'vitest'
import { courseStatusLabel, editableCourseStatus } from '@/lib/course-status'

describe('course status labels', () => {
  it('shows Closed instead of past cutoff', () => {
    expect(courseStatusLabel('pastCutoff')).toBe('Closed')
    expect(courseStatusLabel('past_cutoff')).toBe('Closed')
    expect(courseStatusLabel('past-cutoff')).toBe('Closed')
    expect(courseStatusLabel('Past cutoff')).toBe('Closed')
    expect(courseStatusLabel('past cutoff')).toBe('Closed')
    expect(courseStatusLabel('closed')).toBe('Closed')
  })

  it('keeps the other course statuses in plain words', () => {
    expect(courseStatusLabel('draft')).toBe('Draft')
    expect(courseStatusLabel('open')).toBe('Open')
    expect(courseStatusLabel('archived')).toBe('Archived')
  })

  it('edits a past-cutoff course as closed', () => {
    expect(editableCourseStatus('pastCutoff')).toBe('closed')
    expect(editableCourseStatus('Past cutoff')).toBe('closed')
    expect(editableCourseStatus('open')).toBe('open')
    expect(editableCourseStatus('draft')).toBe('draft')
  })
})
