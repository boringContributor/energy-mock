import { ENTITIES, ENTITY_ORDER, generateDataset, type Scenario } from '@energy-mock/core'
import { Link2, Moon, Sun, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ColumnPicker } from '@/components/column-picker'
import { DataGrid } from '@/components/data-grid'
import { GraphBackdrop } from '@/components/graph-backdrop'
import { Settings } from '@/components/settings'
import { Toolbar } from '@/components/toolbar'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/use-theme'
import { randomSeed, readState, writeState, type AppState } from '@/lib/state'
import { cn } from '@/lib/utils'

const fmt = new Intl.NumberFormat('en-US')
const eyebrow = 'font-mono text-[11px] tracking-[0.2em] uppercase'

const FACTS = [
  ['Linked, not random', 'Every contract belongs to a contact and a billing account, every reading to a meter register, and every bill to the readings it charges for. Foreign keys always resolve.'],
  ['Valid identifiers', 'MaLo IDs with the BDEW check digit, 33-character MeLo IDs, BDEW and DVGW market partner codes, DIN 43863-5 meter numbers, OBIS codes and IBANs on real German bank codes.'],
  ['Prices that add up', 'Supplier, grid and statutory price components per year. Invoices charge the metered consumption, split at 1 January, plus 19% VAT; installments are recalculated after each annual bill.'],
  ['Reproducible and private', 'The seed and every setting live in the URL, so a link always rebuilds the same dataset. Generation runs in your browser; nothing is uploaded.'],
] as const

export function App() {
  const { theme, toggle } = useTheme()
  const [state, setState] = useState<AppState>(() => readState(window.location.search))

  useEffect(() => {
    window.history.replaceState(null, '', `?${writeState(state)}`)
  }, [state])

  // Generation is synchronous (up to ~0.6 s at the maximum size), so wait for input to pause.
  const [scenario, setScenario] = useState(state.scenario)
  useEffect(() => {
    const t = setTimeout(() => setScenario(state.scenario), 150)
    return () => clearTimeout(t)
  }, [state.scenario])
  const generating = scenario !== state.scenario

  const { dataset, ms } = useMemo(() => {
    const started = performance.now()
    const dataset = generateDataset(scenario)
    return { dataset, ms: performance.now() - started }
  }, [scenario])

  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }))
  const updateScenario = (patch: Partial<Scenario>) => setState((s) => ({ ...s, scenario: { ...s.scenario, ...patch } }))

  const entity = ENTITIES[state.tab]
  const fields = entity.fields as { key: string; label: string }[]
  const columns = state.columns[state.tab].flatMap((key) => fields.filter((f) => f.key === key))
  const rows = dataset[state.tab]

  const copyLink = () =>
    navigator.clipboard.writeText(window.location.href).then(
      () => toast.success('Link copied', { description: 'It rebuilds exactly this dataset.' }),
      () => toast.error('Your browser blocked clipboard access'),
    )

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-dvh">
        <div className="relative isolate">
          <GraphBackdrop className="absolute inset-0 -z-10 hidden size-full xl:block" />
          <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8">
            <a href="/" className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="size-4" strokeWidth={2.5} />
              </span>
              <span className="font-mono text-sm font-semibold tracking-tight">energy-mock</span>
            </a>
            <nav className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild className="font-mono text-[11px] tracking-[0.14em] uppercase">
                <a href="#about">About the data</a>
              </Button>
              <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                {theme === 'dark' ? <Sun /> : <Moon />}
              </Button>
            </nav>
          </header>
          <section className="mx-auto max-w-3xl px-4 pt-10 pb-14 text-center sm:pt-16">
            <p className={cn(eyebrow, 'text-brand')}>German energy market · Mock data</p>
            <h1 className="mt-5 text-5xl font-semibold tracking-[-0.045em] text-balance sm:text-7xl">Energy Mock Data</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-balance text-muted-foreground">
              Customers, contracts, tariffs, meters, readings and bills for power and gas, all linked to each other, with valid MaLo, MeLo and IBAN check digits.
            </p>
          </section>
        </div>

        <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-8">
          <Settings scenario={state.scenario} onChange={updateScenario} />

          <section className="mt-10 space-y-5">
            {/* Desktop: tabs wrap instead of scrolling. Phones: a select. */}
            <Tabs value={state.tab} onValueChange={(tab) => update({ tab: tab as AppState['tab'] })} className="hidden sm:block">
              <TabsList className="flex h-auto w-full flex-wrap justify-center gap-1 bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto">
                {ENTITY_ORDER.map((key) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="h-9 flex-none gap-2 rounded-lg px-3 text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs dark:data-[state=active]:bg-card"
                  >
                    {ENTITIES[key].label}
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{fmt.format(dataset[key].length)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Select value={state.tab} onValueChange={(tab) => update({ tab: tab as AppState['tab'] })}>
              <SelectTrigger className="w-full bg-card sm:hidden" aria-label="Table">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_ORDER.map((key) => (
                  <SelectItem key={key} value={key}>
                    {ENTITIES[key].label}
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">{fmt.format(dataset[key].length)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ColumnPicker entity={state.tab} selected={state.columns[state.tab]} onChange={(keys) => update({ columns: { ...state.columns, [state.tab]: keys } })} />

            <Toolbar
              dataset={dataset}
              columns={state.columns}
              tab={state.tab}
              seed={state.scenario.seed}
              format={state.format}
              delimiter={state.delimiter}
              onFormatChange={(format) => update({ format })}
              onDelimiterChange={(delimiter) => update({ delimiter })}
              onRegenerate={() => updateScenario({ seed: randomSeed() })}
            />

            <DataGrid
              key={state.tab}
              rows={rows}
              columns={columns}
              className={cn('h-[min(600px,70dvh)] transition-opacity', generating && 'opacity-50')}
            />

            <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase" aria-live="polite">
              <span className="rounded-md border bg-card px-2.5 py-1">
                <span className="text-brand">{fmt.format(rows.length)}</span> rows
              </span>
              <span className="rounded-md border bg-card px-2.5 py-1">
                <span className="text-brand">{columns.length}</span> columns
              </span>
              <span className="rounded-md border bg-card px-2.5 py-1">{generating ? 'Generating…' : `${Math.max(1, Math.round(ms))} ms`}</span>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-dashed border-brand/40 bg-brand-soft/50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={cn(eyebrow, 'text-brand')}>Shareable link</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Seed and settings are written to the URL as you change them. Anyone with the link gets the same rows.</p>
              </div>
              <Button variant="outline" onClick={copyLink} className="shrink-0 font-mono text-[11px] tracking-[0.12em] uppercase">
                <Link2 /> Copy link
              </Button>
            </div>
          </section>

          <section id="about" className="mt-28 scroll-mt-8 border-t pt-14">
            <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
              <div>
                <p className={cn(eyebrow, 'text-brand')}>About the data</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">One customer, end to end</h2>
                <p className="mt-4 font-mono text-xs leading-6 text-muted-foreground">
                  contact → billing account → billing events
                  <br />
                  contact → contract → meter → counter → reading
                  <br />
                  product → price components
                </p>
              </div>
              <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {FACTS.map(([title, body]) => (
                  <div key={title}>
                    <dt className="font-medium">{title}</dt>
                    <dd className="mt-2 text-sm leading-6 text-muted-foreground">{body}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="mt-14 max-w-3xl text-xs leading-5 text-muted-foreground">
              All people and companies are fictional. Emails use reserved example domains, phone numbers come from ranges the Bundesnetzagentur keeps free
              for film and TV, and grid operators are made-up “Demo GmbH” companies. IBANs combine real bank codes with random account numbers. Taxes and
              levies follow published rates; supplier prices, grid fees and load profiles are realistic approximations, not quotes.
            </p>
          </section>
        </main>

        <footer className="border-t">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase sm:px-8">
            <span>energy-mock.sauerer.dev</span>
            <span>Runs in your browser · No tracking</span>
          </div>
        </footer>
      </div>
      <Toaster theme={theme} position="bottom-center" />
    </TooltipProvider>
  )
}
