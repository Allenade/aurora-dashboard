import type { ReactNode } from 'react'
import { flexRender } from '@tanstack/react-table/flex-render'
import {
  getCoreRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy'

export type Column<T> = {
  id?: string
  accessorKey?: string
  header: string
  cell?: (ctx: { row: { original: T } }) => ReactNode
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRow,
  empty,
}: {
  columns: Column<T>[]
  data: T[]
  onRow?: (row: T) => void
  empty?: string
}) {
  const table = useLegacyTable({
    data,
    columns: columns as LegacyColumnDef<T>[],
    getCoreRowModel: getCoreRowModel(),
  })

  if (!data.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {empty ?? 'Nothing to show'}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead className="bg-surface text-xs tracking-wide text-muted-foreground">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} className="px-3 py-2 font-medium">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={
                onRow
                  ? 'cursor-pointer border-t border-border hover:bg-raised'
                  : 'border-t border-border'
              }
              onClick={onRow ? () => onRow(row.original as T) : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
