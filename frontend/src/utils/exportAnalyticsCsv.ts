/**
 * Safe client-side CSV export utility for displayed analytics records.
 * Sanitizes formula prefixes (=, +, -, @, tab, CR) to prevent spreadsheet CSV injection.
 */

export interface CsvExportRow {
  section: string
  dataSource: string
  itemLabel: string
  metricName: string
  value: string | number
  notes: string
}

function escapeCsvCell(raw: string | number): string {
  const str = String(raw ?? '')
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export function buildAnalyticsCsvContent(rows: CsvExportRow[]): string {
  const header = ['Section', 'Data Source', 'Item', 'Metric', 'Value', 'Notes']
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        escapeCsvCell(row.section),
        escapeCsvCell(row.dataSource),
        escapeCsvCell(row.itemLabel),
        escapeCsvCell(row.metricName),
        escapeCsvCell(row.value),
        escapeCsvCell(row.notes),
      ].join(','),
    ),
  ]
  return lines.join('\r\n')
}

export function downloadAnalyticsCsv(rows: CsvExportRow[], filename: string): void {
  const csv = buildAnalyticsCsvContent(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
