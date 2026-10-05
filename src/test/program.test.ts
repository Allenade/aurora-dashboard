import { describe, expect, it } from 'vitest'
import {
  belongsToProgram,
  CORE_PROGRAM,
  isUnsupportedProgramQuery,
  pageWithProgram,
  peopleInProgram,
  programLabel,
  programName,
} from '@/lib/program'
import { ApiError } from '@/services/api/api.error'

describe('program folder', () => {
  it('reads a program name and ignores blanks', () => {
    expect(programName({ program: ' Core 3.0 ' })).toBe(CORE_PROGRAM)
    expect(programName({})).toBeNull()
    expect(programName({ program: null })).toBeNull()
    expect(programName({ program: '  ' })).toBeNull()
    expect(programName({ program: 3 })).toBeNull()
  })

  it('keeps untagged rows and drops a different program', () => {
    const rows = [
      { id: 'a' },
      { id: 'b', program: null },
      { id: 'c', program: CORE_PROGRAM },
      { id: 'd', program: 'Other' },
    ]
    expect(rows.filter((row) => belongsToProgram(row)).map((row) => row.id)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(peopleInProgram(rows).map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(programLabel({})).toBe(CORE_PROGRAM)
    expect(programLabel({ program: 'Other' })).toBe('Other')
  })
})

describe('program query', () => {
  it('sends the program when the API accepts it', async () => {
    const support = { current: null as boolean | null }
    const seen: Array<string | undefined> = []
    const result = await pageWithProgram(async (program) => {
      seen.push(program)
      return 'ok'
    }, support)
    expect(result).toBe('ok')
    expect(seen).toEqual([CORE_PROGRAM])
    expect(support.current).toBe(true)
  })

  it('retries without the program when the API rejects that query', async () => {
    const support = { current: null as boolean | null }
    const seen: Array<string | undefined> = []
    const result = await pageWithProgram(async (program) => {
      seen.push(program)
      if (program) {
        throw new ApiError({
          statusCode: 400,
          error: 'Bad Request',
          message: 'property program should not exist',
        })
      }
      return ['course-only']
    }, support)
    expect(result).toEqual(['course-only'])
    expect(seen).toEqual([CORE_PROGRAM, undefined])
    expect(support.current).toBe(false)

    seen.length = 0
    await pageWithProgram(async (program) => {
      seen.push(program)
      return ['again']
    }, support)
    expect(seen).toEqual([undefined])
  })

  it('does not hide other API failures', async () => {
    const support = { current: null as boolean | null }
    await expect(
      pageWithProgram(async () => {
        throw new ApiError({ statusCode: 500, error: 'Server Error', message: 'down' })
      }, support),
    ).rejects.toThrow('down')
    expect(support.current).toBeNull()
    expect(
      isUnsupportedProgramQuery(
        new ApiError({ statusCode: 422, error: 'Unprocessable', message: 'no' }),
      ),
    ).toBe(true)
  })
})
