import { describe, expect, it } from 'vitest'
import {
  courseLinkError,
  draftsFromLinks,
  isHttpsLink,
  moveLink,
  prepareCourseLinks,
} from '@/lib/course-links'

describe('course links', () => {
  it('accepts a full https link and rejects anything else', () => {
    expect(isHttpsLink('https://docs.google.com/document/d/abc')).toBe(true)
    expect(isHttpsLink(' https://youtube.com/watch?v=abc ')).toBe(true)
    expect(isHttpsLink('HTTPS://docs.google.com/path')).toBe(true)
    expect(isHttpsLink('http://docs.google.com/document/d/abc')).toBe(false)
    expect(isHttpsLink('docs.google.com')).toBe(false)
    expect(isHttpsLink('https://')).toBe(false)
    expect(isHttpsLink('https://localhost/plan')).toBe(false)
    expect(isHttpsLink('')).toBe(false)
  })

  it('asks for a name and a full https link, and ignores a blank row', () => {
    expect(courseLinkError({ label: '', url: '' })).toBeNull()
    expect(courseLinkError({ label: '  ', url: '  ' })).toBeNull()
    expect(courseLinkError({ label: '', url: 'https://youtube.com/watch?v=abc' })).toBe(
      'Add a name for this button.',
    )
    expect(courseLinkError({ label: 'Intro video', url: 'http://youtube.com/watch' })).toBe(
      'Use a full https:// link.',
    )
    expect(
      courseLinkError({
        label: ' Course structure ',
        url: ' https://docs.google.com/document/d/abc ',
      }),
    ).toBeNull()
  })

  it('sends the remaining links in order and drops blank rows', () => {
    const prepared = prepareCourseLinks([
      { key: 'a', label: ' Course structure ', url: ' https://docs.google.com/d/abc ' },
      { key: 'b', label: '', url: '' },
      { key: 'c', label: 'Intro video', url: 'https://youtube.com/watch?v=abc' },
    ])
    expect(prepared).toEqual({
      ok: true,
      links: [
        { label: 'Course structure', url: 'https://docs.google.com/d/abc' },
        { label: 'Intro video', url: 'https://youtube.com/watch?v=abc' },
      ],
    })
  })

  it('keeps every problem so a bad row is not saved', () => {
    const prepared = prepareCourseLinks([
      { key: 'a', label: '', url: 'https://docs.google.com/d/abc' },
      { key: 'b', label: 'Intro video', url: 'youtube.com/watch' },
    ])
    expect(prepared).toEqual({
      ok: false,
      errors: {
        a: 'Add a name for this button.',
        b: 'Use a full https:// link.',
      },
    })
  })

  it('moves a link up or down and leaves the ends alone', () => {
    const rows = ['structure', 'video', 'slides']
    expect(moveLink(rows, 2, -1)).toEqual(['structure', 'slides', 'video'])
    expect(moveLink(rows, 0, 1)).toEqual(['video', 'structure', 'slides'])
    expect(moveLink(rows, 0, -1)).toEqual(rows)
    expect(moveLink(rows, 2, 1)).toEqual(rows)
  })

  it('copies saved links into editable rows', () => {
    const drafts = draftsFromLinks([
      { label: 'Course structure', url: 'https://docs.google.com/d/abc' },
    ])
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.label).toBe('Course structure')
    expect(drafts[0]?.url).toBe('https://docs.google.com/d/abc')
    expect(draftsFromLinks(undefined)).toEqual([])
  })
})
