export type CsvValue = string | number | boolean | null | undefined

function cell(value: CsvValue, delimiter: string): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return text.includes('"') || text.includes(delimiter) || /[\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** RFC 4180 CSV with CRLF line endings; header row uses the column keys. */
export function toCsv(rows: readonly object[], columns: readonly string[], delimiter = ','): string {
  const lines = [columns.map((c) => cell(c, delimiter)).join(delimiter)]
  for (const row of rows) {
    const record = row as Record<string, CsvValue>
    lines.push(columns.map((c) => cell(record[c], delimiter)).join(delimiter))
  }
  return lines.join('\r\n') + '\r\n'
}
