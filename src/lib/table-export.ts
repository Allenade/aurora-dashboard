export type ExportColumn<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
}

export type ExportMatrix = {
  headers: string[]
  rows: string[][]
}

export function exportMatrix<T>(columns: ExportColumn<T>[], rows: T[]): ExportMatrix {
  return {
    headers: columns.map((column) => column.header),
    rows: rows.map((row) =>
      columns.map((column) => {
        const value = column.value(row)
        if (value == null) return ''
        return String(value)
      }),
    ),
  }
}

export function toExcelXml(title: string, matrix: ExportMatrix) {
  const name = xmlEscape(sheetName(title))
  const header = matrix.headers.map((cell) => stringCell(cell)).join('')
  const body = matrix.rows
    .map((row) => `<Row>${row.map((cell) => stringCell(cell)).join('')}</Row>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${name}">
<Table>
<Row>${header}</Row>
${body}
</Table>
</Worksheet>
</Workbook>`
}

export function toPdfBytes(title: string, matrix: ExportMatrix) {
  const pages = layoutPdf(title, matrix)
  return buildPdf(pages)
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function stringCell(value: string) {
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`
}

function xmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function sheetName(title: string) {
  const clean = title.replace(/[:\\/?*[\]]/g, ' ').trim() || 'Export'
  return clean.slice(0, 31)
}

const PAGE_WIDTH = 842
const PAGE_HEIGHT = 595
const MARGIN = 28
const FONT_SIZE = 8
const LINE = 11
const CELL_CHARS = 22

function layoutPdf(title: string, matrix: ExportMatrix) {
  const pages: string[][] = [[]]
  let y = PAGE_HEIGHT - MARGIN
  const push = (line: string, bold = false) => {
    if (y < MARGIN + LINE) {
      pages.push([])
      y = PAGE_HEIGHT - MARGIN
    }
    pages[pages.length - 1].push(textOp(MARGIN, y, line, bold))
    y -= LINE
  }

  push(pdfSafe(title), true)
  push(`${matrix.rows.length} ${matrix.rows.length === 1 ? 'row' : 'rows'}`)
  y -= 4
  const header = matrix.headers.map((cell) => fit(cell)).join(' | ')
  push(header, true)

  if (matrix.rows.length === 0) {
    push('No rows')
    return pages.map((lines) => lines.join('\n'))
  }

  for (const row of matrix.rows) {
    const wrapped = row.map((cell) => wrap(pdfSafe(cell), CELL_CHARS))
    const height = Math.max(1, ...wrapped.map((lines) => lines.length))
    for (let line = 0; line < height; line += 1) {
      const text = wrapped
        .map((lines) => (lines[line] ?? '').padEnd(CELL_CHARS, ' '))
        .join(' | ')
      push(text.trimEnd())
    }
  }
  return pages.map((lines) => lines.join('\n'))
}

function wrap(value: string, width: number) {
  if (!value) return ['']
  const lines: string[] = []
  let rest = value
  while (rest.length > width && lines.length < 2) {
    lines.push(rest.slice(0, width))
    rest = rest.slice(width)
  }
  if (rest.length > width) lines.push(`${rest.slice(0, width - 3)}...`)
  else lines.push(rest)
  return lines.slice(0, 3)
}

function fit(value: string) {
  const safe = pdfSafe(value)
  if (safe.length <= CELL_CHARS) return safe
  return `${safe.slice(0, CELL_CHARS - 3)}...`
}

function textOp(x: number, y: number, text: string, bold: boolean) {
  const font = bold ? 'F2' : 'F1'
  return `BT /${font} ${FONT_SIZE} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(text)}) Tj ET`
}

function pdfSafe(value: string) {
  return value
    .replaceAll('₦', 'NGN ')
    .replace(/[^\x20-\x7E]/g, '?')
    .replaceAll('endstream', 'end-stream')
}

function pdfEscape(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

function buildPdf(contents: string[]) {
  const pageCount = contents.length
  const fontRegular = 3 + pageCount * 2
  const fontBold = fontRegular + 1
  const objects: string[] = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  const kids = contents.map((_, index) => `${3 + index * 2} 0 R`).join(' ')
  objects[2] = `<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`
  contents.forEach((content, index) => {
    const pageId = 3 + index * 2
    const streamId = pageId + 1
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${streamId} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >>`
    objects[streamId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  })
  objects[fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'
  objects[fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>'

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length}\n`
  pdf += '0000000000 65535 f \n'
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(pdf)
}
