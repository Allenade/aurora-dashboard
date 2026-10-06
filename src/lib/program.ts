import { ApiError } from '@/services/api/api.error'

/** Program folder shown in the dashboard. The API may send this on each enrollment. */
export const CORE_PROGRAM = 'Core 3.0'

export function programName(row: { program?: unknown }) {
  if (typeof row.program !== 'string') return null
  const name = row.program.trim()
  return name.length > 0 ? name : null
}

/**
 * Keep people in this program.
 * A missing program means the API still only has course, so the row stays.
 * A different program name is left out of this folder.
 */
export function belongsToProgram(row: { program?: unknown }, program = CORE_PROGRAM) {
  const name = programName(row)
  if (!name) return true
  return name === program
}

export function peopleInProgram<T extends { program?: unknown }>(
  rows: T[],
  program = CORE_PROGRAM,
) {
  return rows.filter((row) => belongsToProgram(row, program))
}

/** Label used on exports. Untagged rows still belong to the open folder. */
export function programLabel(row: { program?: unknown }, program = CORE_PROGRAM) {
  return programName(row) ?? program
}

export function isUnsupportedProgramQuery(error: unknown) {
  return (
    error instanceof ApiError && (error.statusCode === 400 || error.statusCode === 422)
  )
}

/**
 * Asks the list API for this program. If that query is rejected, retries once
 * without it and remembers the rejection for later pages.
 */
export async function pageWithProgram<T>(
  load: (program: string | undefined) => Promise<T>,
  support: { current: boolean | null },
  program = CORE_PROGRAM,
): Promise<T> {
  if (support.current !== false) {
    try {
      const result = await load(program)
      support.current = true
      return result
    } catch (error) {
      if (!isUnsupportedProgramQuery(error)) throw error
      support.current = false
    }
  }
  return load(undefined)
}
