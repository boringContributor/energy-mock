import { ENTITIES, ENTITY_ORDER, toCsv, toFlatJson, toNestedJson, toZip, type ColumnSelection, type Dataset, type EntityKey } from '@energy-mock/core'
import { ChevronDown, Copy, Download, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { download } from '@/lib/files'
import type { Delimiter, Format } from '@/lib/state'

interface Props {
  dataset: Dataset
  columns: ColumnSelection
  tab: EntityKey
  seed: string
  format: Format
  delimiter: Delimiter
  onFormatChange: (f: Format) => void
  onDelimiterChange: (d: Delimiter) => void
  onRegenerate: () => void
}

export function Toolbar({ dataset, columns, tab, seed, format, delimiter, onFormatChange, onDelimiterChange, onRegenerate }: Props) {
  const base = `energy-mock-${seed.replace(/[^a-z0-9_-]+/gi, '_') || 'data'}`
  const label = ENTITIES[tab].label
  const tableText = () =>
    format === 'csv' ? toCsv(dataset[tab], columns[tab], delimiter) : JSON.stringify(toFlatJson(dataset, columns)[tab], null, 2)
  const json = (value: unknown) => JSON.stringify(value, null, 2)

  const downloadTable = () =>
    format === 'csv'
      ? download(`${base}-${tab}.csv`, tableText(), 'text/csv;charset=utf-8')
      : download(`${base}-${tab}.json`, tableText(), 'application/json')

  const copy = () =>
    navigator.clipboard.writeText(tableText()).then(
      () => toast.success(`${label} copied as ${format.toUpperCase()}`),
      () => toast.error('Your browser blocked clipboard access'),
    )

  const mono = 'font-mono text-[11px] tracking-[0.12em] uppercase'

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button variant="outline" className={mono} onClick={onRegenerate}>
        <RefreshCw /> Regenerate
      </Button>
      <div className="mx-2 hidden h-6 w-px bg-border sm:block" />
      <span className={`${mono} text-muted-foreground`}>Export</span>
      <ToggleGroup type="single" variant="outline" value={format} onValueChange={(v) => v && onFormatChange(v as Format)} className="bg-card">
        <ToggleGroupItem value="csv" className={`${mono} px-3 data-[state=on]:bg-brand-soft data-[state=on]:text-brand`}>
          CSV
        </ToggleGroupItem>
        <ToggleGroupItem value="json" className={`${mono} px-3 data-[state=on]:bg-brand-soft data-[state=on]:text-brand`}>
          JSON
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex">
        <Button className={`${mono} rounded-r-none`} onClick={downloadTable}>
          <Download /> Download {label}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="rounded-l-none border-l border-primary-foreground/20 px-2.5" aria-label="More export options">
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Everything</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => download(`${base}.zip`, toZip(Object.fromEntries(ENTITY_ORDER.map((e) => [`${e}.csv`, toCsv(dataset[e], columns[e], delimiter)]))), 'application/zip')}
            >
              All tables · CSV in a ZIP
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => download(`${base}.json`, json(toFlatJson(dataset, columns)), 'application/json')}>
              All tables · JSON
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => download(`${base}-nested.json`, json(toNestedJson(dataset, columns)), 'application/json')}>
              <div>
                Nested JSON
                <div className="text-xs text-muted-foreground">Contact → contracts → meters → readings</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">CSV delimiter</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={delimiter} onValueChange={(v) => onDelimiterChange(v as Delimiter)}>
              <DropdownMenuRadioItem value=",">Comma ( , )</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value=";">Semicolon ( ; ) for German Excel</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button variant="outline" className={mono} onClick={copy}>
        <Copy /> Copy
      </Button>
    </div>
  )
}
