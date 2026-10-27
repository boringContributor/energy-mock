import { ENTITIES, defaultColumns, type EntityKey } from '@energy-mock/core'
import { Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FieldLabel } from './field-label'

interface FieldInfo {
  key: string
  label: string
  group: string
  description?: string
}

export function ColumnPicker({ entity, selected, onChange }: { entity: EntityKey; selected: string[]; onChange: (keys: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const fields = ENTITIES[entity].fields as FieldInfo[]
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const chosen = new Set(selected)
  // Registry order, so exports keep a stable column order whatever the click order.
  const setChosen = (next: Set<string>) => onChange(fields.filter((f) => next.has(f.key)).map((f) => f.key))
  const toggle = (key: string) => {
    const next = new Set(chosen)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setChosen(next)
  }
  const isDefault = selected.join(',') === defaultColumns()[entity].join(',')

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <FieldLabel>Columns</FieldLabel>
        <div className="flex items-center gap-3 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {!isDefault && (
            <button type="button" className="text-brand hover:underline" onClick={() => onChange(defaultColumns()[entity])}>
              Reset
            </button>
          )}
          <span>
            <span className="text-brand">{selected.length}</span> / {fields.length} selected
          </span>
        </div>
      </div>
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border bg-card/80 p-2 shadow-xs">
        {selected.map((key) => (
          <span
            key={key}
            title={byKey.get(key)?.description}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-brand/25 bg-brand-soft pr-1 pl-2.5 font-mono text-[11px] tracking-wide text-brand uppercase"
          >
            {byKey.get(key)?.label}
            <button type="button" aria-label={`Remove ${byKey.get(key)?.label}`} onClick={() => toggle(key)} className="rounded p-0.5 opacity-60 hover:bg-brand/10 hover:opacity-100">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              <Plus /> Add column
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search columns…" />
              <CommandList className="max-h-80">
                <CommandEmpty>No column found.</CommandEmpty>
                {[...Map.groupBy(fields, (f) => f.group)].map(([group, items]) => (
                  <CommandGroup key={group} heading={group}>
                    {items.map((f) => (
                      <CommandItem key={f.key} value={`${f.label} ${f.key}`} onSelect={() => toggle(f.key)} className="items-start">
                        <Check className={chosen.has(f.key) ? 'mt-0.5 opacity-100' : 'mt-0.5 opacity-0'} />
                        <div className="min-w-0">
                          <div>{f.label}</div>
                          {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
              <div className="flex justify-between border-t p-1">
                <Button variant="ghost" size="sm" onClick={() => setChosen(new Set(fields.map((f) => f.key)))}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onChange([])}>
                  Clear
                </Button>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
