import type { Faker } from '@faker-js/faker'
import { DAY_MS, addMonths, isoDate, monthIndex, monthStart, parseMonth, utc } from './dates'
import { COMPETITIVE_METERING_OPERATOR, DRAMA_PHONE_PREFIXES, citiesInRegion, gridOperator, type City } from './geo'
import { generateBankAccount } from './banks'
import { generateBillingEvents, type BillingPoint, type Zone, type ZoneKwh } from './billing'
import { generateMaloId, generateMeloId, generateMeterNumber } from './ids'
import { PriceBook, type ContractKind } from './pricing'
import { EnergySeries, type ProfileKey } from './profiles'
import { createFaker, hashSeed } from './random'
import type { Scenario } from './scenario'
import type {
  BillingAccount,
  Contact,
  Contract,
  CustomerType,
  Dataset,
  EndReason,
  Meter,
  MeterCounter,
  Product,
  MeterType,
  ReadingReason,
  ReadingSource,
  Sector,
  StartReason,
} from './types'

interface Context {
  scenario: Scenario
  windowStart: number
  windowEnd: number
  cities: City[]
  book: PriceBook
}

interface KindSpec {
  sector: Sector
  profile: ProfileKey
  loadProfile: string
  annualKwh: (f: Faker) => number
}

const round10 = (n: number) => Math.round(n / 10) * 10
const logUniform = (f: Faker, min: number, max: number) => Math.exp(f.number.float({ min: Math.log(min), max: Math.log(max) }))

const KINDS: Record<ContractKind, KindSpec> = {
  household_power: {
    sector: 'power',
    profile: 'H25',
    loadProfile: 'H25',
    // Household size drives consumption: 1, 2, 3, 4+ persons.
    annualKwh: (f) => {
      const [min, max] = f.helpers.weightedArrayElement([
        { weight: 40, value: [1400, 2200] },
        { weight: 33, value: [2300, 3300] },
        { weight: 13, value: [3300, 4300] },
        { weight: 14, value: [4300, 6000] },
      ])
      return round10(f.number.int({ min, max }))
    },
  },
  commercial_power: {
    sector: 'power',
    profile: 'G25',
    loadProfile: 'G25',
    annualKwh: (f) => round10(logUniform(f, 8_000, 90_000)),
  },
  heat_pump: {
    sector: 'power',
    profile: 'HEAT_PUMP',
    loadProfile: 'TLP_WP',
    annualKwh: (f) => round10(f.number.int({ min: 2_500, max: 7_000 })),
  },
  household_gas: {
    sector: 'gas',
    profile: 'GAS_HOUSEHOLD',
    loadProfile: 'HEF',
    annualKwh: (f) => round10(f.number.int({ min: 8_000, max: 28_000 })),
  },
  commercial_gas: {
    sector: 'gas',
    profile: 'GAS_COMMERCIAL',
    loadProfile: 'GHA',
    annualKwh: (f) => round10(logUniform(f, 40_000, 250_000)),
  },
}

/** Calibration validity (Eichfrist) in years per meter type. */
const CALIBRATION_YEARS: Record<MeterType, number> = { ferraris: 16, mme: 8, imsys: 8, diaphragm_gas: 8 }

export function generateDataset(scenario: Scenario): Dataset {
  const windowEnd = parseMonth(scenario.until)
  const windowStart = addMonths(windowEnd, -scenario.months)
  const years: number[] = []
  for (let y = new Date(windowStart).getUTCFullYear(); y <= new Date(windowEnd).getUTCFullYear(); y++) years.push(y)
  const book = new PriceBook(scenario.seed, years)
  const ctx: Context = { scenario, windowEnd, windowStart, cities: citiesInRegion(scenario.region), book }
  const dataset: Dataset = {
    contact: [],
    billing_account: [],
    contract: [],
    product: book.products,
    price_component: [],
    meter: [],
    meter_counter: [],
    meter_reading: [],
    billing_event: [],
  }
  const f = createFaker()
  for (let i = 0; i < scenario.customers; i++) {
    // Each customer draws from its own seed, so changing the customer count keeps the
    // existing customers identical and only appends or drops rows.
    f.seed(hashSeed(`${scenario.seed}:${i}`))
    generateCustomer(f, i, ctx, dataset)
  }
  // Grid fees are added as customers land in new grid areas; list them after products and statutory rows.
  const scopeOrder = { product: 0, statutory: 1, grid: 2 }
  dataset.price_component = book.rows.toSorted((a, b) => scopeOrder[a.scope] - scopeOrder[b.scope])
  return dataset
}

function randomDay(f: Faker, from: number, to: number): number {
  const days = Math.max(0, Math.floor((to - from) / DAY_MS))
  return from + f.number.int({ min: 0, max: days }) * DAY_MS
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '')
}

function generateCustomer(f: Faker, i: number, ctx: Context, out: Dataset): void {
  const { scenario, windowEnd } = ctx
  const customerType: CustomerType =
    scenario.customerMix === 'mixed' ? (f.datatype.boolean({ probability: 0.2 }) ? 'commercial' : 'private') : scenario.customerMix
  const commercial = customerType === 'commercial'
  const city = f.helpers.arrayElement(ctx.cities)
  const address = { street: f.location.street(), house_number: f.location.buildingNumber() }
  const sex = f.helpers.arrayElement(['female', 'male'] as const)
  const firstName = f.person.firstName(sex)
  const lastName = f.person.lastName()
  const companyName = commercial ? f.company.name() : null

  const contact: Contact = {
    id: f.string.uuid(),
    customer_number: String(10_000_001 + i),
    customer_type: customerType,
    salutation: sex === 'female' ? 'Frau' : 'Herr',
    title: f.datatype.boolean({ probability: 0.06 }) ? f.helpers.arrayElement(['Dr.', 'Prof. Dr.']) : null,
    first_name: firstName,
    last_name: lastName,
    company_name: companyName,
    vat_id: commercial ? `DE${f.string.numeric({ length: 9, allowLeadingZeros: false })}` : null,
    birth_date: commercial ? null : isoDate(f.date.birthdate({ mode: 'age', min: 19, max: 88, refDate: windowEnd }).getTime()),
    // Reserved example domains (RFC 2606), so mock data can never email a real person.
    email: companyName
      ? `${f.helpers.arrayElement(['info', 'buchhaltung', 'energie'])}@${slug(companyName)}.example`
      : `${slug(firstName)}.${slug(lastName)}${f.datatype.boolean({ probability: 0.3 }) ? f.number.int({ min: 1, max: 99 }) : ''}@${f.helpers.arrayElement(['example.com', 'example.org', 'example.net'])}`,
    phone: `${f.helpers.arrayElement(DRAMA_PHONE_PREFIXES)} ${f.string.numeric(3)}`,
    ...address,
    postal_code: city.postalCode,
    city: city.city,
    state: city.state,
  }
  out.contact.push(contact)

  const kinds: ContractKind[] = []
  const sectors: Sector[] =
    scenario.sectors === 'power_gas'
      ? f.helpers.weightedArrayElement<Sector[]>([
          { weight: 55, value: ['power'] },
          { weight: 35, value: ['power', 'gas'] },
          { weight: 10, value: ['gas'] },
        ])
      : [scenario.sectors]
  if (sectors.includes('power')) kinds.push(commercial ? 'commercial_power' : 'household_power')
  if (sectors.includes('gas')) kinds.push(commercial ? 'commercial_gas' : 'household_gas')
  if (!commercial && sectors.includes('power') && f.datatype.boolean({ probability: 0.1 })) kinds.push('heat_pump')
  const hasPv = !commercial && sectors.includes('power') && f.datatype.boolean({ probability: 0.15 })

  const contracts = kinds.map((kind, k) => generateContract(f, kind, i * 4 + k, contact, ctx))
  const earliestStart = Math.min(...contracts.map((c) => Date.parse(c.start_date)))

  const sepa = f.datatype.boolean({ probability: 0.8 })
  const otherBillingAddress = f.datatype.boolean({ probability: 0.08 })
  const billingCity = otherBillingAddress ? f.helpers.arrayElement(ctx.cities) : city
  const billingAccountNumber = String(200_000_000_001 + i)
  const bank = generateBankAccount(f)
  const billingAccount: BillingAccount = {
    id: f.string.uuid(),
    billing_account_number: billingAccountNumber,
    contact_id: contact.id,
    payment_method: sepa ? ('sepa_direct_debit' as const) : ('bank_transfer' as const),
    account_holder: companyName ?? `${firstName} ${lastName}`,
    iban: bank.iban,
    bic: bank.bic,
    bank_name: bank.name,
    payment_day: f.helpers.arrayElement([1, 1, 1, 1, 5, 10, 15, 15, 15, 20, 25, 28]),
    mandate_reference: sepa ? `MREF-${billingAccountNumber}` : null,
    mandate_signed_at: sepa ? isoDate(randomDay(f, earliestStart - 30 * DAY_MS, earliestStart)) : null,
    paperless_billing: f.datatype.boolean({ probability: 0.6 }),
    billing_street: otherBillingAddress ? f.location.street() : address.street,
    billing_house_number: otherBillingAddress ? f.location.buildingNumber() : address.house_number,
    billing_postal_code: billingCity.postalCode,
    billing_city: billingCity.city,
  }
  out.billing_account.push(billingAccount)

  contracts.forEach((contract, k) => {
    contract.billing_account_id = billingAccount.id
    out.contract.push(contract)
    generateMetering(f, kinds[k]!, contract, billingAccount, city, hasPv && kinds[k] === 'household_power', ctx, out)
  })
}

function generateContract(f: Faker, kind: ContractKind, sequence: number, contact: Contact, ctx: Context): Contract {
  const { windowStart, windowEnd } = ctx
  const spec = KINDS[kind]
  const product = f.helpers.arrayElement(ctx.book.productsFor(kind))
  const startedInWindow = f.datatype.boolean({ probability: 0.2 })
  const start = startedInWindow
    ? randomDay(f, windowStart, Math.max(windowStart, windowEnd - 30 * DAY_MS))
    : randomDay(f, addMonths(windowStart, -120), windowStart - DAY_MS)
  const startReason = f.helpers.weightedArrayElement<StartReason>([
    { weight: 55, value: 'supplier_change' },
    { weight: 40, value: 'move_in' },
    { weight: 5, value: 'new_connection' },
  ])

  let status = f.helpers.weightedArrayElement<Contract['status']>([
    { weight: 85, value: 'active' },
    { weight: 5, value: 'terminated' },
    { weight: 10, value: 'ended' },
  ])
  let end: number | null = null
  if (status === 'ended') {
    const earliestEnd = Math.max(start + 60 * DAY_MS, windowStart + DAY_MS)
    if (earliestEnd >= windowEnd) status = 'active'
    else end = randomDay(f, earliestEnd, windowEnd)
  } else if (status === 'terminated') {
    end = randomDay(f, windowEnd + 15 * DAY_MS, windowEnd + 120 * DAY_MS)
  }
  const endReason =
    end === null
      ? null
      : f.helpers.weightedArrayElement<EndReason>([
          { weight: 55, value: 'supplier_change' },
          { weight: 35, value: 'move_out' },
          { weight: 10, value: 'cancellation' },
        ])

  return {
    id: f.string.uuid(),
    contract_number: `V${String(30_000_000 + sequence)}`,
    contact_id: contact.id,
    billing_account_id: '',
    sector: spec.sector,
    status,
    product_id: product.id,
    product_name: product.name,
    tariff_type: kind === 'heat_pump' ? 'dual' : 'single',
    start_date: isoDate(start),
    start_reason: startReason,
    end_date: end === null ? null : isoDate(end),
    end_reason: endReason,
    notice_period_months: contact.customer_type === 'commercial' ? 3 : 1,
    annual_consumption_forecast_kwh: spec.annualKwh(f),
    // Set by the billing run once prices and readings are known.
    installment_amount: 0,
    delivery_street: contact.street,
    delivery_house_number: contact.house_number,
    delivery_postal_code: contact.postal_code,
    delivery_city: contact.city,
  }
}

interface CounterPlan {
  counter: MeterCounter
  series: EnergySeries
  /** kWh → register unit */
  toUnit: (kwh: number) => number
}

function generateMetering(
  f: Faker,
  kind: ContractKind,
  contract: Contract,
  account: BillingAccount,
  city: City,
  withPv: boolean,
  ctx: Context,
  out: Dataset,
): void {
  const { scenario, windowStart, windowEnd, book } = ctx
  const spec = KINDS[kind]
  const product = book.products.find((p) => p.id === contract.product_id) as Product
  const commercial = kind === 'commercial_power' || kind === 'commercial_gas'
  const start = Date.parse(contract.start_date)
  const end = contract.end_date === null ? null : Date.parse(contract.end_date)
  const firstReading = Math.max(start, windowStart)
  const lastReading = end === null ? windowEnd : Math.min(end, windowEnd)

  // Meters are replaced when their calibration expires, so none is older than 8 years.
  const oldestInstall = addMonths(windowEnd, -96)
  const installed =
    contract.start_reason === 'new_connection' && start >= oldestInstall
      ? start
      : randomDay(f, Math.min(oldestInstall, firstReading), firstReading)

  let meterType: MeterType
  if (spec.sector === 'gas') meterType = 'diaphragm_gas'
  else if (kind === 'heat_pump' || withPv || product.pricing_model === 'dynamic' || contract.annual_consumption_forecast_kwh > 6000)
    meterType = 'imsys'
  else
    meterType = f.helpers.weightedArrayElement<MeterType>([
      { weight: 60, value: 'mme' },
      { weight: 20, value: 'imsys' },
      { weight: 20, value: 'ferraris' },
    ])

  const grid = gridOperator(city, spec.sector)
  book.ensureGrid(city, spec.sector, grid)
  const meteringOperator = meterType === 'imsys' && f.datatype.boolean({ probability: 0.25 }) ? COMPETITIVE_METERING_OPERATOR : grid
  const installYear = new Date(installed).getUTCFullYear()
  const meter: Meter = {
    id: f.string.uuid(),
    contract_id: contract.id,
    meter_number: generateMeterNumber(f, spec.sector),
    ma_lo_id: generateMaloId(f),
    me_lo_id: generateMeloId(f, grid.operatorNumber, city.postalCode),
    sector: spec.sector,
    meter_type: meterType,
    metering_procedure: 'SLP',
    load_profile: spec.loadProfile,
    controllable_device_14a: kind === 'heat_pump',
    grid_operator_name: grid.name,
    grid_operator_code: grid.code,
    metering_operator_name: meteringOperator.name,
    metering_operator_code: meteringOperator.code,
    installed_at: isoDate(installed),
    // Calibration validity ends on 31 December of its final year.
    calibration_valid_until: isoDate(utc(installYear + CALIBRATION_YEARS[meterType], 11, 31)),
  }
  out.meter.push(meter)

  const actualAnnual = contract.annual_consumption_forecast_kwh * f.number.float({ min: 0.88, max: 1.12 })
  const fromMonth = monthIndex(installed)
  const toMonth = monthIndex(windowEnd)
  const noise = () => f.number.float({ min: 0.9, max: 1.1 })
  const plans: CounterPlan[] = []
  const addCounter = (
    fields: Pick<MeterCounter, 'obis_code' | 'direction' | 'tariff_zone' | 'ma_lo_id'>,
    annualKwh: number,
    profile: ProfileKey,
  ) => {
    const gas = spec.sector === 'gas'
    const calorific = gas ? f.number.float({ min: 10.6, max: 11.6, fractionDigits: 3 }) : null
    const zNumber = gas ? f.number.float({ min: 0.92, max: 0.97, fractionDigits: 4 }) : null
    const counter: MeterCounter = {
      id: f.string.uuid(),
      meter_id: meter.id,
      ...fields,
      unit: gas ? 'm³' : 'kWh',
      pre_decimal_digits: gas ? (commercial ? 6 : 5) : commercial ? 8 : 6,
      calorific_value_kwh_m3: calorific,
      z_number: zNumber,
      // The forecast is what the supplier expects; the series below uses the actual consumption.
      forecast_annual_kwh: round10(annualKwh * (fields.direction === 'feed_in' ? 1 : contract.annual_consumption_forecast_kwh / actualAnnual)),
    }
    out.meter_counter.push(counter)
    const factor = calorific !== null && zNumber !== null ? calorific * zNumber : 1
    plans.push({ counter, series: new EnergySeries(fromMonth, toMonth, annualKwh, profile, noise), toUnit: (kwh) => kwh / factor })
  }

  const obisTotal = spec.sector === 'gas' ? '7-0:3.0.0' : '1-0:1.8.0'
  if (kind === 'heat_pump') {
    addCounter({ obis_code: '1-0:1.8.1', direction: 'consumption', tariff_zone: 'ht', ma_lo_id: meter.ma_lo_id }, actualAnnual * 0.6, spec.profile)
    addCounter({ obis_code: '1-0:1.8.2', direction: 'consumption', tariff_zone: 'nt', ma_lo_id: meter.ma_lo_id }, actualAnnual * 0.4, spec.profile)
  } else {
    addCounter({ obis_code: obisTotal, direction: 'consumption', tariff_zone: 'single', ma_lo_id: meter.ma_lo_id }, actualAnnual, spec.profile)
  }
  if (withPv) {
    // Feed-in is its own market location. ~950 kWh per kWp, ~70% exported.
    const kwp = f.number.float({ min: 4, max: 12, fractionDigits: 1 })
    addCounter(
      { obis_code: '1-0:2.8.0', direction: 'feed_in', tariff_zone: 'single', ma_lo_id: generateMaloId(f) },
      round10(kwp * 950 * 0.7),
      'PV_FEED_IN',
    )
  }

  const startsInWindow = start >= windowStart
  const endsInWindow = end !== null && end <= windowEnd
  const events = readingSchedule(f, contract, firstReading, lastReading, startsInWindow, endsInWindow, scenario.frequency)
  const remote = meterType === 'imsys'
  const previous = new Map<string, number>()
  const points: BillingPoint[] = []
  for (const event of events) {
    let source: ReadingSource
    if (event.reason !== 'periodic') source = f.helpers.arrayElement(['customer', 'grid_operator'] as const)
    else if (remote) source = 'metering_operator'
    else if (scenario.frequency === 'monthly')
      source = f.helpers.weightedArrayElement<ReadingSource>([
        { weight: 85, value: 'customer' },
        { weight: 15, value: 'estimated' },
      ])
    else
      source = f.helpers.weightedArrayElement<ReadingSource>([
        { weight: 45, value: 'grid_operator' },
        { weight: 40, value: 'customer' },
        { weight: 15, value: 'estimated' },
      ])

    const kwh: ZoneKwh = {}
    for (const { counter, series, toUnit } of plans) {
      const value = Math.floor(toUnit(series.at(event.date)))
      if (counter.direction === 'consumption') {
        const factor = counter.calorific_value_kwh_m3 !== null && counter.z_number !== null ? counter.calorific_value_kwh_m3 * counter.z_number : 1
        kwh[counter.tariff_zone as Zone] = value * factor
      }
      const prev = previous.get(counter.id)
      const consumption = prev === undefined ? null : value - prev
      previous.set(counter.id, value)
      out.meter_reading.push({
        id: f.string.uuid(),
        meter_id: meter.id,
        counter_id: counter.id,
        obis_code: counter.obis_code,
        reading_date: isoDate(event.date),
        value,
        unit: counter.unit,
        reason: event.reason,
        source,
        consumption,
        consumption_kwh:
          consumption === null
            ? null
            : counter.calorific_value_kwh_m3 !== null && counter.z_number !== null
              ? Math.round(consumption * counter.calorific_value_kwh_m3 * counter.z_number)
              : consumption,
      })
    }
    if (event.billing) points.push({ date: event.date, kind: event.kind, kwh })
  }

  const forecast = contract.annual_consumption_forecast_kwh
  const billingEvents = generateBillingEvents({
    f,
    contract,
    account,
    book,
    points,
    windowStart,
    windowEnd,
    forecast: kind === 'heat_pump' ? { ht: forecast * 0.6, nt: forecast * 0.4 } : { single: forecast },
    tariff: {
      productId: product.id,
      gridCode: grid.code,
      sector: spec.sector,
      customerType: commercial ? 'commercial' : 'private',
      meterType,
      heatPump: kind === 'heat_pump',
    },
  })
  out.billing_event.push(...billingEvents)
}

interface ReadingEvent {
  date: number
  reason: ReadingReason
  kind: BillingPoint['kind']
  /** Annual billing (Turnus) or a contract start/end reading. */
  billing: boolean
}

function readingSchedule(
  f: Faker,
  contract: Contract,
  first: number,
  last: number,
  startsInWindow: boolean,
  endsInWindow: boolean,
  frequency: Scenario['frequency'],
): ReadingEvent[] {
  const events: ReadingEvent[] = []
  if (startsInWindow) events.push({ date: first, reason: contract.start_reason, kind: 'start', billing: true })

  const periodic: number[] = []
  let billingMonth: number | null = null
  if (frequency === 'yearly') {
    // Each contract has its own annual reading date (Turnusablesung).
    const month = f.number.int({ min: 0, max: 11 })
    const day = f.number.int({ min: 1, max: 28 })
    for (let y = new Date(first).getUTCFullYear(); y <= new Date(last).getUTCFullYear(); y++) periodic.push(utc(y, month, day))
  } else {
    const step = frequency === 'monthly' ? 1 : 3
    // Billing stays annual: one of the regular readings each year is the Turnus reading.
    billingMonth = f.number.int({ min: 0, max: 11 / step }) * step
    for (let m = monthIndex(first); m <= monthIndex(last); m++) if (m % step === 0) periodic.push(monthStart(m))
  }
  for (const date of periodic) {
    const afterStart = date > first || (date === first && !startsInWindow)
    if (afterStart && (date < last || (date === last && !endsInWindow))) events.push({ date, reason: 'periodic', kind: 'periodic', billing: billingMonth === null || new Date(date).getUTCMonth() === billingMonth })
  }

  if (endsInWindow) {
    const reason: ReadingReason =
      contract.end_reason === 'move_out' ? 'move_out' : contract.end_reason === 'supplier_change' ? 'supplier_change' : 'contract_end'
    events.push({ date: last, reason, kind: 'end', billing: true })
  }
  return events
}
