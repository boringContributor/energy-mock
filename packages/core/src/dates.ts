export const DAY_MS = 86_400_000

export function utc(year: number, month0: number, day = 1): number {
  return Date.UTC(year, month0, day)
}

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addMonths(ms: number, months: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate())
}

/** Months since year 0, so month arithmetic stays integer. */
export function monthIndex(ms: number): number {
  const d = new Date(ms)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

export function monthStart(index: number): number {
  return Date.UTC(Math.floor(index / 12), index % 12, 1)
}

export function daysInMonth(index: number): number {
  return (monthStart(index + 1) - monthStart(index)) / DAY_MS
}

/** "YYYY-MM" → first day of that month (UTC). */
export function parseMonth(value: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(value)
  if (!m) throw new Error(`Invalid month "${value}", expected YYYY-MM`)
  return utc(Number(m[1]), Number(m[2]) - 1)
}

export function formatMonth(ms: number): string {
  return isoDate(ms).slice(0, 7)
}
