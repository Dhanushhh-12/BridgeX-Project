import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { EmptyState } from './EmptyState'
import { LoadingIndicator } from './LoadingIndicator'

export type SortDirection = 'asc' | 'desc'

export interface TableColumn<T> {
  key: string
  header: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  widthClass?: string
  render: (row: T) => ReactNode
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string
  caption?: string
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  sortKey?: string
  sortDirection?: SortDirection
  onSortChange?: (key: string) => void
  className?: string
}

const ALIGN_CLASSES = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export function Table<T>({
  columns,
  data,
  rowKey,
  caption,
  isLoading = false,
  emptyTitle = 'No records available',
  emptyDescription = 'Adjust your filters or load project records to view rows here.',
  sortKey,
  sortDirection = 'asc',
  onSortChange,
  className,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className={cn('rounded-sm border border-border-neutral bg-surface', className)}>
        <LoadingIndicator label="Loading table records..." />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className={cn('rounded-sm border border-border-neutral bg-surface', className)}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-sm border border-border-neutral bg-surface',
        className,
      )}
    >
      <table className="w-full min-w-[540px] border-collapse text-sm text-charcoal bx-tabular">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border-neutral bg-sand/75 text-editorial-blue">
            {columns.map((col) => {
              const isSorted = sortKey === col.key
              const alignClass = ALIGN_CLASSES[col.align ?? 'left']

              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    col.sortable
                      ? isSorted
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                  className={cn(
                    'px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap',
                    alignClass,
                    col.widthClass,
                  )}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(col.key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xs hover:text-coral-hover',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-editorial-blue',
                        col.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      <span>{col.header}</span>
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-sage" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-neutral">
          {data.map((row, idx) => (
            <tr
              key={rowKey(row, idx)}
              className="transition-colors duration-100 hover:bg-ivory/70"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 align-middle text-sm text-charcoal',
                    ALIGN_CLASSES[col.align ?? 'left'],
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
