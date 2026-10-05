import { describe, expect, it } from 'vitest'
import {
  filterRegistrants,
  registrantExportColumns,
  trackChoices,
  type RegistrantRow,
} from '@/lib/registrant-filters'
import { exportMatrix, toExcelXml, toPdfBytes } from '@/lib/table-export'

function row(
  patch: Partial<RegistrantRow> & Pick<RegistrantRow, 'firstName'>,
): RegistrantRow {
  return {
    firstName: patch.firstName,
    lastName: patch.lastName ?? 'Okoye',
    email: patch.email ?? `${patch.firstName.toLowerCase()}@example.com`,
    phone: patch.phone ?? '08030000000',
    tracks: patch.tracks ?? ['core-robotics'],
    isMinor: patch.isMinor === undefined ? false : patch.isMinor,
    dateOfBirth: patch.dateOfBirth === undefined ? '2000-01-01' : patch.dateOfBirth,
    amount: patch.amount ?? 45000,
    currency: patch.currency ?? 'NGN',
    paymentStatus: patch.paymentStatus ?? 'success',
    paystackReference: patch.paystackReference ?? 'EF-1',
    createdAt: patch.createdAt ?? '2026-10-05T10:00:00.000Z',
  }
}

const ada = row({
  firstName: 'Ada',
  tracks: ['core-robotics'],
  isMinor: true,
  dateOfBirth: '2012-04-01',
  createdAt: '2026-10-04T23:30:00.000Z',
})
const grace = row({
  firstName: 'Grace',
  tracks: ['ai-lab'],
  isMinor: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  amount: 60000,
})
const tunde = row({
  firstName: 'Tunde',
  tracks: ['core-robotics'],
  isMinor: null,
  dateOfBirth: null,
  createdAt: '2026-10-05T23:30:00.000Z',
})

describe('filterRegistrants', () => {
  it('filters by course, age, and Lagos date', () => {
    const filters = {
      track: 'core-robotics',
      age: 'minor' as const,
      from: '2026-10-05',
      to: '2026-10-05',
    }
    const matched = filterRegistrants([ada, grace, tunde], filters)
    expect(matched.map((item) => item.firstName)).toEqual(['Ada'])
  })

  it('keeps adults and unknown ages apart', () => {
    expect(
      filterRegistrants([ada, grace, tunde], {
        track: '',
        age: 'adult',
        from: '',
        to: '',
      }),
    ).toEqual([grace])
    expect(
      filterRegistrants([ada, grace, tunde], {
        track: '',
        age: 'unknown',
        from: '',
        to: '',
      }).map((item) => item.firstName),
    ).toEqual(['Tunde'])
  })

  it('uses the course name when one is known', () => {
    const choices = trackChoices(
      [{ slug: 'core-robotics', name: 'Core Robotics' }],
      [ada, grace],
    )
    expect(choices).toEqual([
      ['ai-lab', 'ai-lab'],
      ['core-robotics', 'Core Robotics'],
    ])
  })
})

describe('filtered export', () => {
  it('puts only the filtered rows in Excel and PDF', () => {
    const filtered = filterRegistrants([ada, grace], {
      track: 'core-robotics',
      age: 'all',
      from: '',
      to: '',
    })
    const names = new Map([['core-robotics', 'Core Robotics']])
    const matrix = exportMatrix(
      registrantExportColumns((slug) => names.get(slug) ?? slug),
      filtered,
    )
    expect(matrix.rows).toHaveLength(1)
    const excel = toExcelXml('Payments', matrix)
    const pdf = new TextDecoder().decode(toPdfBytes('Payments', matrix))
    expect(excel).toContain('Ada')
    expect(excel).toContain('Core Robotics')
    expect(excel).toContain('Under 18')
    expect(excel).not.toContain('Grace')
    expect(pdf).toContain('Ada')
    expect(pdf).not.toContain('Grace')
  })

  it('escapes spreadsheet text', () => {
    const excel = toExcelXml('A & B', {
      headers: ['Name'],
      rows: [['Tom <script>']],
    })
    expect(excel).toContain('Tom &lt;script&gt;')
    expect(excel).toContain('A &amp; B')
    expect(excel).not.toContain('<script>')
  })
})
