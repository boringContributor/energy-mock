import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface GridColumn {
  key: string
  label: string
}

type Sort = { key: string; dir: 1 | -1 } | null

const ROW_HEIGHT = 36
// Geist Mono advance width is 0.6em: 12.5px cells, 11px uppercase headers with letter spacing.
const CELL_CHAR = 7.5
const HEAD_CHAR = 7.9
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

/** UUIDs are shortened in the preview only; 8 characters are enough to follow a relation. */
function display(value: unknown): string {
  const t = text(value)
  return UUID.test(t) ? `${t.slice(0, 8)}…` : t
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'de')
}

export function DataGrid({ rows, columns, className }: { rows: readonly object[]; columns: GridColumn[]; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sort, setSort] = useState<Sort>(null)

  const sorted = useMemo(() => {
    if (!sort || !columns.some((c) => c.key === sort.key)) return rows
    return [...rows].sort((a, b) => compare((a as Record<string, unknown>)[sort.key], (b as Record<string, unknown>)[sort.key]) * sort.dir)
  }, [rows, sort, columns])

  const template = useMemo(() => {
    const sample = rows.slice(0, 400) as Record<string, unknown>[]
    const indexWidth = Math.max(3, String(rows.length).length) * CELL_CHAR + 28
    const widths = columns.map((c) => {
      const longest = sample.reduce((w, r) => Math.max(w, display(r[c.key]).length), 0)
      return Math.ceil(Math.min(Math.max(longest * CELL_CHAR, c.label.length * HEAD_CHAR + 16) + 32, 380))
    })
    return [indexWidth, ...widths].map((w) => `${w}px`).join(' ')
  }, [rows, columns])

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  })

  const empty = columns.length === 0 ? 'Add a column to see data.' : rows.length === 0 ? 'No rows for this scenario.' : null
  const toggleSort = (key: string) => setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null))

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-xs', className)}>
      {empty ? (
        <div className="grid h-full place-items-center p-12 text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div ref={scrollRef} className="h-full overflow-auto font-mono" role="table" aria-rowcount={sorted.length + 1}>
          <div className="min-w-max">
            <div role="row" className="sticky top-0 z-10 grid border-b bg-card/95 backdrop-blur" style={{ gridTemplateColumns: template }}>
              <div role="columnheader" className="flex h-10 items-center px-4 text-[11px] text-muted-foreground/70">
                #
              </div>
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="columnheader"
                    aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                    onClick={() => toggleSort(c.key)}
                    title={`${c.key} · click to sort`}
                    className={cn(
                      'flex h-10 items-center gap-1 px-4 text-left text-[11px] tracking-[0.12em] uppercase transition-colors hover:text-foreground',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <span className="truncate">{c.label}</span>
                    {active && (sort.dir === 1 ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />)}
                  </button>
                )
              })}
            </div>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((item) => {
                const row = sorted[item.index] as Record<string, unknown>
                return (
                  <div
                    key={item.key}
                    role="row"
                    className={cn('absolute inset-x-0 grid text-[12.5px] hover:bg-brand-soft/60', item.index % 2 === 1 && 'bg-muted/40')}
                    style={{ gridTemplateColumns: template, height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                  >
                    <div role="cell" className="flex items-center px-4 text-muted-foreground/60 tabular-nums">
                      {item.index + 1}
                    </div>
                    {columns.map((c) => {
                      const value = row[c.key]
                      return (
                        <div
                          key={c.key}
                          role="cell"
                          title={text(value)}
                          className={cn('flex items-center truncate px-4', typeof value === 'number' && 'justify-end tabular-nums')}
                        >
                          {value === null || value === undefined ? <span className="text-muted-foreground/40">—</span> : <span className="truncate">{display(value)}</span>}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
