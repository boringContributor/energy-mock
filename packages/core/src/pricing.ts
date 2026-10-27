import type { City, MarketPartner } from './geo'
import { stableUnit, stableUuid } from './random'
import type { CustomerType, MeterType, PriceComponent, PriceComponentKey, PriceScope, Product, Sector } from './types'

export type ContractKind = 'household_power' | 'commercial_power' | 'heat_pump' | 'household_gas' | 'commercial_gas'

export const VAT_RATE = 19

const round = (n: number, digits: number) => Math.round((n + Number.EPSILON) * 10 ** digits) / 10 ** digits

interface ProductSpec extends Omit<Product, 'id' | 'customer_type'> {
  kind: ContractKind
  /** Net supplier energy price in ct/kWh for the reference year 2025; HT/NT for dual tariffs. */
  energy: number | { ht: number; nt: number }
  /** Net supplier base price in EUR/year for 2025. */
  base: number
}

const PRODUCTS: ProductSpec[] = [
  { kind: 'household_power', product_number: 'STR-100', name: 'Strom Basis', sector: 'power', tariff_type: 'single', pricing_model: 'variable', price_guarantee_months: null, minimum_term_months: 0, green_energy: false, description: 'Variable power tariff, cancellable monthly', energy: 12.5, base: 102 },
  { kind: 'household_power', product_number: 'STR-110', name: 'Ökostrom Plus', sector: 'power', tariff_type: 'single', pricing_model: 'variable', price_guarantee_months: null, minimum_term_months: 0, green_energy: true, description: '100% renewable power with guarantees of origin', energy: 13.2, base: 108 },
  { kind: 'household_power', product_number: 'STR-120', name: 'Strom Fix 24', sector: 'power', tariff_type: 'single', pricing_model: 'fixed', price_guarantee_months: 24, minimum_term_months: 24, green_energy: false, description: 'Energy price guaranteed for 24 months (taxes and levies excluded)', energy: 11.8, base: 96 },
  { kind: 'household_power', product_number: 'STR-130', name: 'Strom Dynamisch', sector: 'power', tariff_type: 'single', pricing_model: 'dynamic', price_guarantee_months: null, minimum_term_months: 0, green_energy: true, description: 'Dynamic tariff (§41a EnWG): hourly day-ahead price plus markup. Energy price is the indicative annual average', energy: 9.5, base: 60 },
  { kind: 'heat_pump', product_number: 'STR-200', name: 'Wärmepumpe Duo', sector: 'power', tariff_type: 'dual', pricing_model: 'variable', price_guarantee_months: null, minimum_term_months: 12, green_energy: true, description: 'Heat pump tariff with HT/NT, controllable device under §14a EnWG', energy: { ht: 10.8, nt: 8.6 }, base: 72 },
  { kind: 'commercial_power', product_number: 'STR-300', name: 'Gewerbestrom Fix', sector: 'power', tariff_type: 'single', pricing_model: 'fixed', price_guarantee_months: 12, minimum_term_months: 12, green_energy: false, description: 'Business power with 12-month price guarantee', energy: 11.5, base: 144 },
  { kind: 'commercial_power', product_number: 'STR-310', name: 'Gewerbestrom Öko', sector: 'power', tariff_type: 'single', pricing_model: 'variable', price_guarantee_months: null, minimum_term_months: 12, green_energy: true, description: 'Renewable business power', energy: 12.2, base: 144 },
  { kind: 'household_gas', product_number: 'GAS-100', name: 'Erdgas Basis', sector: 'gas', tariff_type: 'single', pricing_model: 'variable', price_guarantee_months: null, minimum_term_months: 0, green_energy: false, description: 'Variable natural gas tariff', energy: 5.6, base: 108 },
  { kind: 'household_gas', product_number: 'GAS-110', name: 'Gas Fix 24', sector: 'gas', tariff_type: 'single', pricing_model: 'fixed', price_guarantee_months: 24, minimum_term_months: 24, green_energy: false, description: 'Energy price guaranteed for 24 months (taxes, levies and CO₂ price excluded)', energy: 5.2, base: 96 },
  { kind: 'household_gas', product_number: 'GAS-120', name: 'Ökogas Klima', sector: 'gas', tariff_type: 'single', pricing_model: 'variable', price_guarantee_months: null, minimum_term_months: 0, green_energy: true, description: 'Natural gas with 10% biomethane, CO₂ offset', energy: 6.1, base: 108 },
  { kind: 'commercial_gas', product_number: 'GAS-300', name: 'Gewerbegas Fix', sector: 'gas', tariff_type: 'single', pricing_model: 'fixed', price_guarantee_months: 12, minimum_term_months: 12, green_energy: false, description: 'Business gas with 12-month price guarantee', energy: 4.9, base: 168 },
]

/** Wholesale-driven change of supplier energy prices relative to 2025. */
const SUPPLIER_YEAR_FACTOR: Record<number, number> = { 2022: 1.45, 2023: 1.3, 2024: 1.12, 2025: 1, 2026: 0.96 }

/**
 * Statutory taxes and levies, net ct/kWh. Indicative published values; years outside the table
 * use the nearest year. CO₂ price: BEHG certificate price × 0.201 kg CO₂/kWh.
 */
const STATUTORY: Record<Sector, Partial<Record<PriceComponentKey, Record<number, number>>>> = {
  power: {
    electricity_tax: { 2024: 2.05 },
    kwkg_levy: { 2023: 0.357, 2024: 0.275, 2025: 0.277, 2026: 0.446 },
    par19_levy: { 2023: 0.417, 2024: 0.643, 2025: 1.558, 2026: 1.559 },
    offshore_levy: { 2023: 0.591, 2024: 0.656, 2025: 0.816, 2026: 0.941 },
  },
  gas: {
    energy_tax: { 2024: 0.55 },
    co2_price: { 2023: 0.603, 2024: 0.905, 2025: 1.106, 2026: 1.206 },
  },
}

export const COMPONENT_LABELS: Record<PriceComponentKey, string> = {
  energy_price: 'Arbeitspreis Energie',
  base_price: 'Grundpreis Vertrieb',
  grid_energy: 'Netzentgelt Arbeitspreis',
  grid_base: 'Netzentgelt Grundpreis',
  metering: 'Messstellenbetrieb',
  concession_fee: 'Konzessionsabgabe',
  grid_rebate_14a: 'Netzentgeltreduzierung §14a EnWG (Modul 1)',
  electricity_tax: 'Stromsteuer',
  kwkg_levy: 'KWKG-Umlage',
  par19_levy: 'Aufschlag für besondere Netznutzung',
  offshore_levy: 'Offshore-Netzumlage',
  energy_tax: 'Energiesteuer',
  co2_price: 'CO₂-Preis (BEHG)',
}

function nearest(table: Record<number, number>, year: number): number {
  const years = Object.keys(table).map(Number)
  const best = years.reduce((a, b) => (Math.abs(b - year) < Math.abs(a - year) ? b : a))
  return table[best]!
}

interface Lookup {
  productId?: string | null
  gridCode?: string | null
  variant?: string | null
}

/** Price components plus a lookup by component, scope keys and calendar year. */
export class PriceBook {
  readonly products: Product[] = []
  readonly rows: PriceComponent[] = []
  private readonly index = new Map<string, PriceComponent>()
  private readonly grids = new Set<string>()
  private readonly kindProducts = new Map<ContractKind, Product[]>()
  private readonly firstYear: number
  private readonly lastYear: number

  constructor(
    private readonly seed: string,
    private readonly years: number[],
  ) {
    this.firstYear = years[0]!
    this.lastYear = years[years.length - 1]!
    for (const spec of PRODUCTS) this.addProduct(spec)
    for (const sector of ['power', 'gas'] as const) {
      for (const [component, table] of Object.entries(STATUTORY[sector]) as [PriceComponentKey, Record<number, number>][]) {
        for (const year of years) this.add('statutory', component, sector, year, nearest(table, year), 'ct/kWh', {})
      }
    }
  }

  productsFor(kind: ContractKind): Product[] {
    return this.kindProducts.get(kind)!
  }

  get(component: PriceComponentKey, lookup: Lookup, year: number): number {
    const y = Math.min(Math.max(year, this.firstYear), this.lastYear)
    const row = this.index.get(this.key(component, lookup, y))
    if (!row) throw new Error(`No price for ${component} ${JSON.stringify(lookup)} ${y}`)
    return row.net_amount
  }

  /** Adds the grid area's fees the first time a contract in that area needs them. */
  ensureGrid(city: City, sector: Sector, operator: MarketPartner): void {
    const gridKey = `${sector}:${operator.code}`
    if (this.grids.has(gridKey)) return
    this.grids.add(gridKey)
    const u = (name: string) => stableUnit(`${this.seed}:${gridKey}:${name}`)
    const grid = { gridCode: operator.code, gridName: operator.name }
    const power = sector === 'power'
    const energy = power ? 5.5 + 4 * u('energy') : 1.1 + 1.3 * u('energy')
    const base = power ? 30 + 60 * u('base') : 25 + 60 * u('base')
    for (const year of this.years) {
      // Grid fees are re-set every January.
      const drift = 1 + (u(`drift:${year}`) - 0.5) * 0.12
      this.add('grid', 'grid_energy', sector, year, energy * drift, 'ct/kWh', grid)
      this.add('grid', 'grid_base', sector, year, base * drift, 'EUR/year', grid)
      if (power) {
        // Statutory price caps (MsbG) are gross amounts.
        this.add('grid', 'metering', sector, year, 20 / 1.19, 'EUR/year', { ...grid, variant: 'mme' })
        this.add('grid', 'metering', sector, year, 30 / 1.19, 'EUR/year', { ...grid, variant: 'imsys' })
        this.add('grid', 'metering', sector, year, 12 + 14 * u('ferraris'), 'EUR/year', { ...grid, variant: 'ferraris' })
        // Konzessionsabgabeverordnung: tariff customers by municipality size, special contracts, off-peak.
        this.add('grid', 'concession_fee', sector, year, city.large ? 2.39 : 1.99, 'ct/kWh', { ...grid, variant: 'private' })
        this.add('grid', 'concession_fee', sector, year, 0.11, 'ct/kWh', { ...grid, variant: 'commercial' })
        this.add('grid', 'concession_fee', sector, year, 0.61, 'ct/kWh', { ...grid, variant: 'nt' })
        this.add('grid', 'grid_rebate_14a', sector, year, -(110 + 80 * u('rebate')), 'EUR/year', { ...grid, variant: 'heat_pump' })
      } else {
        this.add('grid', 'metering', sector, year, 9 + 12 * u('gas-meter'), 'EUR/year', { ...grid, variant: 'diaphragm_gas' })
        this.add('grid', 'concession_fee', sector, year, city.large ? 0.66 : 0.33, 'ct/kWh', { ...grid, variant: 'private' })
        this.add('grid', 'concession_fee', sector, year, 0.03, 'ct/kWh', { ...grid, variant: 'commercial' })
      }
    }
  }

  private addProduct(spec: ProductSpec): void {
    const { kind, energy, base, ...fields } = spec
    const product: Product = {
      id: stableUuid(`${this.seed}:product:${spec.product_number}`),
      ...fields,
      customer_type: kind === 'commercial_power' || kind === 'commercial_gas' ? 'commercial' : 'private',
    }
    this.products.push(product)
    const list = this.kindProducts.get(kind)
    if (list) list.push(product)
    else this.kindProducts.set(kind, [product])

    const factor = 0.94 + 0.12 * stableUnit(`${this.seed}:${spec.product_number}`)
    for (const year of this.years) {
      const yearFactor = nearest(SUPPLIER_YEAR_FACTOR, year)
      const scope = { productId: product.id }
      if (typeof energy === 'number') {
        this.add('product', 'energy_price', spec.sector, year, energy * factor * yearFactor, 'ct/kWh', scope)
      } else {
        this.add('product', 'energy_price', spec.sector, year, energy.ht * factor * yearFactor, 'ct/kWh', { ...scope, variant: 'ht' })
        this.add('product', 'energy_price', spec.sector, year, energy.nt * factor * yearFactor, 'ct/kWh', { ...scope, variant: 'nt' })
      }
      this.add('product', 'base_price', spec.sector, year, base * factor, 'EUR/year', scope)
    }
  }

  private key(component: PriceComponentKey, lookup: Lookup, year: number): string {
    return [component, lookup.productId ?? '', lookup.gridCode ?? '', lookup.variant ?? '', year].join('|')
  }

  private add(
    scope: PriceScope,
    component: PriceComponentKey,
    sector: Sector,
    year: number,
    net: number,
    unit: PriceComponent['unit'],
    lookup: Lookup & { gridName?: string },
  ): void {
    const digits = unit === 'ct/kWh' ? 3 : 2
    const netAmount = round(net, digits)
    const key = this.key(component, { ...lookup, gridCode: lookup.gridCode ?? (scope === 'statutory' ? sector : null) }, year)
    const row: PriceComponent = {
      id: stableUuid(`${this.seed}:price:${key}`),
      scope,
      component,
      label: COMPONENT_LABELS[component],
      sector,
      product_id: lookup.productId ?? null,
      grid_operator_code: lookup.gridCode ?? null,
      grid_operator_name: lookup.gridName ?? null,
      variant: lookup.variant ?? null,
      unit,
      net_amount: netAmount,
      vat_rate: VAT_RATE,
      gross_amount: round(netAmount * (1 + VAT_RATE / 100), digits),
      valid_from: `${year}-01-01`,
      valid_to: `${year}-12-31`,
    }
    this.rows.push(row)
    this.index.set(key, row)
  }

  statutory(sector: Sector, year: number): number {
    return Object.keys(STATUTORY[sector]).reduce((sum, c) => sum + this.get(c as PriceComponentKey, { gridCode: sector }, year), 0)
  }
}

export interface TariffContext {
  productId: string
  gridCode: string
  sector: Sector
  customerType: CustomerType
  meterType: MeterType
  heatPump: boolean
}

/** Net ct/kWh for one tariff zone: supplier energy + grid + concession + taxes and levies. */
export function energyRate(book: PriceBook, t: TariffContext, zone: 'single' | 'ht' | 'nt', year: number): number {
  return (
    book.get('energy_price', { productId: t.productId, variant: zone === 'single' ? null : zone }, year) +
    book.get('grid_energy', { gridCode: t.gridCode }, year) +
    book.get('concession_fee', { gridCode: t.gridCode, variant: zone === 'nt' ? 'nt' : t.customerType }, year) +
    book.statutory(t.sector, year)
  )
}

/** Net EUR/year of fixed charges: supplier base price, grid base price, metering, §14a rebate. */
export function baseCharge(book: PriceBook, t: TariffContext, year: number): number {
  return (
    book.get('base_price', { productId: t.productId }, year) +
    book.get('grid_base', { gridCode: t.gridCode }, year) +
    book.get('metering', { gridCode: t.gridCode, variant: t.meterType }, year) +
    (t.heatPump ? book.get('grid_rebate_14a', { gridCode: t.gridCode, variant: 'heat_pump' }, year) : 0)
  )
}
