import { ENTITIES, ENTITY_ORDER, relatedEntities, toCsv, toJoinedTable, type ColumnSelection, type Dataset, type EntityKey } from '@energy-mock/core'
import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { download } from '@/lib/files'
import type { Delimiter, Format } from '@/lib/state'
import { FieldLabel } from './field-label'

const fmt = new Intl.NumberFormat('en-US')
/** Entities that point at something; contacts and products have no parents to join. */
const BASES = ENTITY_ORDER.filter((e) => relatedEntities(e).length > 0)

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataset: Dataset
  columns: ColumnSelection
  initialBase: EntityKey
  seed: string
  format: Format
  delimiter: Delimiter
}

export function CombinedExport({ open, onOpenChange, dataset, columns, initialBase, seed, format: initialFormat, delimiter }: Props) {
  const startBase = BASES.includes(initialBase) ? initialBase : 'contract'
  const [base, setBase] = useState<EntityKey>(startBase)
  const [include, setInclude] = useState<EntityKey[]>(relatedEntities(startBase).slice(0, 1))
  const [format, setFormat] = useState<Format>(initialFormat)
  const related = relatedEntities(base)

  const joined = useMemo(() => (open ? toJoinedTable(dataset, base, include, columns) : null), [open, dataset, base, include, columns])

  const changeBase = (next: EntityKey) => {
    setBase(next)
    setInclude(relatedEntities(next).slice(0, 1))
  }
  const toggle = (entity: EntityKey, on: boolean) =>
    // Keep the related-entity order (nearest first) so column order is predictable.
    setInclude((current) => related.filter((e) => (e === entity ? on : current.includes(e))))

  const save = () => {
    if (!joined) return
    const name = `energy-mock-${seed.replace(/[^a-z0-9_-]+/gi, '_') || 'data'}-${[base, ...include].join('-')}`
    if (format === 'csv') download(`${name}.csv`, toCsv(joined.rows, joined.columns, delimiter), 'text/csv;charset=utf-8')
    else download(`${name}.json`, JSON.stringify(joined.nested, null, 2), 'application/json')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Combined file</DialogTitle>
          <DialogDescription>
            One row per record, with the columns of the records it belongs to next to it. Each table uses the columns you picked for it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <FieldLabel className="mb-2 block">One row per</FieldLabel>
            <Select value={base} onValueChange={(v) => changeBase(v as EntityKey)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASES.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ENTITIES[e].label}
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">{fmt.format(dataset[e].length)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel className="mb-2 block">Add columns from</FieldLabel>
            <div className="divide-y rounded-lg border">
              {related.map((e) => {
                const id = `include-${e}`
                return (
                  <label key={e} htmlFor={id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                    <Checkbox id={id} checked={include.includes(e)} onCheckedChange={(on) => toggle(e, on === true)} />
                    <span className="flex-1 text-sm">{ENTITIES[e].label}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{columns[e].length} columns</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <FieldLabel>Format</FieldLabel>
            <ToggleGroup type="single" variant="outline" size="sm" value={format} onValueChange={(v) => v && setFormat(v as Format)}>
              <ToggleGroupItem value="csv" className="px-3 font-mono text-[11px] tracking-[0.12em] uppercase">
                CSV
              </ToggleGroupItem>
              <ToggleGroupItem value="json" className="px-3 font-mono text-[11px] tracking-[0.12em] uppercase">
                JSON
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {joined && (
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                <span className="text-brand">{fmt.format(joined.rows.length)}</span> rows ×{' '}
                <span className="text-brand">{joined.columns.length}</span> columns
              </p>
              <p className="mt-1.5 line-clamp-2 font-mono text-xs break-all text-muted-foreground">
                {format === 'csv' ? joined.columns.join(delimiter) : `[{ …${base} fields, ${include.map((e) => `${e}: { … }`).join(', ') || 'no related records'} }]`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!joined || joined.columns.length === 0}>
            <Download /> Download {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
