import { Button } from '@/components/ui/button'
import {
  downloadBlob,
  exportMatrix,
  toExcelXml,
  toPdfBytes,
  type ExportColumn,
} from '@/lib/table-export'

export function ExportButtons<T>({
  filename,
  title,
  columns,
  rows,
}: {
  filename: string
  title: string
  columns: ExportColumn<T>[]
  rows: T[]
}) {
  const empty = rows.length === 0
  const count = `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={empty}
        title={empty ? 'Nothing to export' : `Download ${count} as Excel`}
        onClick={() => {
          const xml = toExcelXml(title, exportMatrix(columns, rows))
          downloadBlob(
            `${filename}.xls`,
            new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }),
          )
        }}
      >
        Excel
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={empty}
        title={empty ? 'Nothing to export' : `Download ${count} as PDF`}
        onClick={() => {
          const bytes = toPdfBytes(title, exportMatrix(columns, rows))
          downloadBlob(
            `${filename}.pdf`,
            new Blob([bytes], { type: 'application/pdf' }),
          )
        }}
      >
        PDF
      </Button>
    </>
  )
}
