import { CITIES, LIMITS, type Scenario } from '@energy-mock/core'
import { Shuffle } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { randomSeed } from '@/lib/state'
import { FieldLabel } from './field-label'

const REGIONS = [
  { value: 'all', label: 'All of Germany', cities: '' },
  ...'0123456789'.split('').map((digit) => ({
    value: digit,
    label: `PLZ ${digit}xxxx`,
    cities: CITIES.filter((c) => c.postalCode.startsWith(digit))
      .map((c) => c.city)
      .join(', '),
  })),
]

function Field({ label, children, className }: { label: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} className="mb-2 block">
        {label}
      </FieldLabel>
      {children(id)}
    </div>
  )
}

/** Commits only valid integers, so clearing the field while typing does not reset the data. */
function NumberInput({ id, value, min, max, onCommit }: { id: string; value: number; min: number; max: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      className="font-mono tabular-nums"
      onChange={(e) => {
        setDraft(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && Number.isInteger(n) && n >= min && n <= max) onCommit(n)
      }}
      onBlur={() => setDraft(String(value))}
    />
  )
}

function Segmented<T extends string>({ id, value, options, onChange }: { id: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <ToggleGroup
      id={id}
      type="single"
      variant="outline"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className="w-full bg-card"
    >
      {options.map(([v, label]) => (
        <ToggleGroupItem key={v} value={v} className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function Settings({ scenario, onChange }: { scenario: Scenario; onChange: (patch: Partial<Scenario>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-5 rounded-xl border bg-card/80 p-5 shadow-xs backdrop-blur-sm md:grid-cols-4 lg:grid-cols-12">
      <Field label="Customers" className="lg:col-span-2">
        {(id) => <NumberInput id={id} value={scenario.customers} min={LIMITS.customers.min} max={LIMITS.customers.max} onCommit={(customers) => onChange({ customers })} />}
      </Field>
      <Field label="Sector" className="lg:col-span-3">
        {(id) => (
          <Segmented id={id} value={scenario.sectors} onChange={(sectors) => onChange({ sectors })} options={[['power', 'Power'], ['gas', 'Gas'], ['power_gas', 'Both']]} />
        )}
      </Field>
      <Field label="Customers are" className="lg:col-span-4">
        {(id) => (
          <Segmented
            id={id}
            value={scenario.customerMix}
            onChange={(customerMix) => onChange({ customerMix })}
            options={[['private', 'Private'], ['commercial', 'Business'], ['mixed', 'Mixed']]}
          />
        )}
      </Field>
      <Field label="Region" className="lg:col-span-3">
        {(id) => (
          <Select value={scenario.region} onValueChange={(region) => onChange({ region })}>
            <SelectTrigger id={id} className="w-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  <span>{r.label}</span>
                  {r.cities && <span className="text-muted-foreground">{r.cities}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <Field label="Months of history" className="lg:col-span-2">
        {(id) => <NumberInput id={id} value={scenario.months} min={LIMITS.months.min} max={LIMITS.months.max} onCommit={(months) => onChange({ months })} />}
      </Field>
      <Field label="Until" className="lg:col-span-3">
        {(id) => (
          <Input id={id} type="month" value={scenario.until} className="font-mono" onChange={(e) => e.target.value && onChange({ until: e.target.value })} />
        )}
      </Field>
      <Field label="Meter readings" className="lg:col-span-4">
        {(id) => (
          <Segmented
            id={id}
            value={scenario.frequency}
            onChange={(frequency) => onChange({ frequency })}
            options={[['yearly', 'Yearly'], ['quarterly', 'Quarterly'], ['monthly', 'Monthly']]}
          />
        )}
      </Field>
      <Field label="Seed" className="lg:col-span-3">
        {(id) => (
          <div className="flex gap-2">
            <Input id={id} value={scenario.seed} spellCheck={false} className="font-mono" onChange={(e) => onChange({ seed: e.target.value.slice(0, 64) })} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="New random seed" onClick={() => onChange({ seed: randomSeed() })}>
                  <Shuffle />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New random seed</TooltipContent>
            </Tooltip>
          </div>
        )}
      </Field>
    </div>
  )
}
