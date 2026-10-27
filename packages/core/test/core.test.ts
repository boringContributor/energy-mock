import { describe, expect, it } from 'vitest'
import {
  BANKS,
  ENTITIES,
  ENTITY_ORDER,
  defaultColumns,
  generateDataset,
  isValidIban,
  isValidMaloId,
  isValidMarketPartnerId,
  isValidMeloId,
  maloCheckDigit,
  normalizeScenario,
  toCsv,
  toNestedJson,
  type Scenario,
} from '../src'

const NOW = new Date('2026-10-27T00:00:00Z')
const scenario = (patch: Partial<Scenario> = {}) => normalizeScenario({ seed: 'test', customers: 60, ...patch }, NOW)

describe('identifiers', () => {
  it('computes the BDEW MaLo check digit', () => {
    // Example ID from the BDEW identifier documentation.
    expect(maloCheckDigit('5123869678')).toBe(1)
    expect(isValidMaloId('51238696781')).toBe(true)
    expect(isValidMaloId('51238696782')).toBe(false)
  })

  it('generates only valid MaLo, MeLo and market partner IDs', () => {
    const ds = generateDataset(scenario())
    for (const m of ds.meter) {
      expect(isValidMaloId(m.ma_lo_id)).toBe(true)
      expect(isValidMeloId(m.me_lo_id)).toBe(true)
      expect(m.me_lo_id).toHaveLength(33)
      expect(isValidMarketPartnerId(m.grid_operator_code)).toBe(true)
      expect(m.grid_operator_code.startsWith(m.sector === 'power' ? '99' : '98')).toBe(true)
      expect(m.meter_number).toMatch(m.sector === 'power' ? /^1[A-Z]{3}\d{10}$/ : /^7[A-Z]{3}\d{10}$/)
    }
    for (const c of ds.meter_counter) expect(isValidMaloId(c.ma_lo_id)).toBe(true)
  })
})

describe('determinism', () => {
  it('produces identical data for the same scenario', () => {
    expect(generateDataset(scenario())).toEqual(generateDataset(scenario()))
  })

  it('keeps existing customers when the customer count grows', () => {
    const small = generateDataset(scenario({ customers: 10 }))
    const large = generateDataset(scenario({ customers: 20 }))
    expect(large.contact.slice(0, 10)).toEqual(small.contact)
    expect(large.meter_reading.slice(0, small.meter_reading.length)).toEqual(small.meter_reading)
  })

  it('changes with the seed', () => {
    expect(generateDataset(scenario({ seed: 'a' })).contact[0]).not.toEqual(generateDataset(scenario({ seed: 'b' })).contact[0])
  })
})

describe('relations', () => {
  it('has no dangling foreign keys', () => {
    const ds = generateDataset(scenario({ customers: 200 }))
    const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id))
    const contacts = ids(ds.contact)
    const billing = ids(ds.billing_account)
    const contracts = ids(ds.contract)
    const meters = ids(ds.meter)
    const counters = ids(ds.meter_counter)
    for (const r of ds.billing_account) expect(contacts.has(r.contact_id)).toBe(true)
    for (const r of ds.contract) {
      expect(contacts.has(r.contact_id)).toBe(true)
      expect(billing.has(r.billing_account_id)).toBe(true)
    }
    for (const r of ds.meter) expect(contracts.has(r.contract_id)).toBe(true)
    for (const r of ds.meter_counter) expect(meters.has(r.meter_id)).toBe(true)
    for (const r of ds.meter_reading) {
      expect(meters.has(r.meter_id)).toBe(true)
      expect(counters.has(r.counter_id)).toBe(true)
    }
  })

  it('uses unique business keys', () => {
    const ds = generateDataset(scenario({ customers: 500 }))
    const unique = (values: string[]) => new Set(values).size === values.length
    expect(unique(ds.contact.map((c) => c.customer_number))).toBe(true)
    expect(unique(ds.contract.map((c) => c.contract_number))).toBe(true)
    expect(unique(ds.meter.map((m) => m.ma_lo_id))).toBe(true)
    expect(unique(ds.meter.map((m) => m.meter_number))).toBe(true)
  })

  it('respects the sector and customer filters', () => {
    const gas = generateDataset(scenario({ sectors: 'gas', customerMix: 'commercial' }))
    expect(gas.contract.every((c) => c.sector === 'gas')).toBe(true)
    expect(gas.contact.every((c) => c.customer_type === 'commercial' && c.company_name)).toBe(true)
    const munich = generateDataset(scenario({ region: '8' }))
    expect(munich.contact.every((c) => c.postal_code.startsWith('8'))).toBe(true)
  })
})

describe('readings', () => {
  const ds = generateDataset(scenario({ customers: 200, frequency: 'monthly' }))
  const byCounter = Map.groupBy(ds.meter_reading, (r) => r.counter_id)

  it('rise monotonically and stay inside the window', () => {
    for (const readings of byCounter.values()) {
      for (let i = 1; i < readings.length; i++) {
        expect(readings[i]!.reading_date > readings[i - 1]!.reading_date).toBe(true)
        expect(readings[i]!.value).toBeGreaterThanOrEqual(readings[i - 1]!.value)
        expect(readings[i]!.consumption).toBe(readings[i]!.value - readings[i - 1]!.value)
      }
    }
    expect(ds.meter_reading.every((r) => r.reading_date >= '2024-10-01' && r.reading_date <= '2026-10-01')).toBe(true)
  })

  it('stay within contract dates', () => {
    const meters = new Map(ds.meter.map((m) => [m.id, m]))
    const contracts = new Map(ds.contract.map((c) => [c.id, c]))
    for (const r of ds.meter_reading) {
      const contract = contracts.get(meters.get(r.meter_id)!.contract_id)!
      expect(r.reading_date >= contract.start_date).toBe(true)
      if (contract.end_date) expect(r.reading_date <= contract.end_date).toBe(true)
    }
  })

  it('add up to roughly the forecast over a year', () => {
    const yearly = generateDataset(scenario({ customers: 300, months: 36 }))
    const counters = new Map(yearly.meter_counter.map((c) => [c.id, c]))
    // Only full turnus periods: a move-in a few days before the annual reading is a valid short period.
    const ratios = [...Map.groupBy(yearly.meter_reading, (r) => r.counter_id).values()].flatMap((readings) =>
      readings
        .filter((r, i) => i > 0 && r.reason === 'periodic' && readings[i - 1]!.reason === 'periodic')
        .filter((r) => counters.get(r.counter_id)!.direction === 'consumption')
        .map((r) => r.consumption_kwh! / counters.get(r.counter_id)!.forecast_annual_kwh),
    )
    expect(ratios.length).toBeGreaterThan(100)
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length
    expect(mean).toBeGreaterThan(0.9)
    expect(mean).toBeLessThan(1.1)
    expect(Math.min(...ratios)).toBeGreaterThan(0.7)
    expect(Math.max(...ratios)).toBeLessThan(1.3)
  })

  it('convert gas volume to kWh', () => {
    const counters = new Map(ds.meter_counter.map((c) => [c.id, c]))
    const gas = ds.meter_reading.filter((r) => r.unit === 'm³' && r.consumption !== null && r.consumption > 0)
    expect(gas.length).toBeGreaterThan(0)
    for (const r of gas) {
      const c = counters.get(r.counter_id)!
      expect(r.consumption_kwh).toBe(Math.round(r.consumption! * c.calorific_value_kwh_m3! * c.z_number!))
    }
  })

  it('model heat pumps with HT/NT and PV with a feed-in register', () => {
    const big = generateDataset(scenario({ customers: 300, customerMix: 'private', sectors: 'power' }))
    expect(big.meter_counter.some((c) => c.tariff_zone === 'nt' && c.obis_code === '1-0:1.8.2')).toBe(true)
    const feedIn = big.meter_counter.filter((c) => c.direction === 'feed_in')
    expect(feedIn.length).toBeGreaterThan(0)
    const meters = new Map(big.meter.map((m) => [m.id, m]))
    for (const c of feedIn) {
      expect(c.obis_code).toBe('1-0:2.8.0')
      expect(c.ma_lo_id).not.toBe(meters.get(c.meter_id)!.ma_lo_id)
      expect(meters.get(c.meter_id)!.meter_type).toBe('imsys')
    }
  })
})

describe('payment info', () => {
  it('uses real bank codes and valid IBANs', () => {
    const ds = generateDataset(scenario({ customers: 200 }))
    const banks = new Map(BANKS.map((b) => [b.value.blz, b.value]))
    for (const a of ds.billing_account) {
      expect(isValidIban(a.iban)).toBe(true)
      const bank = banks.get(a.iban.slice(4, 12))!
      expect(bank.bic).toBe(a.bic)
      expect(bank.name).toBe(a.bank_name)
      expect(a.mandate_reference === null).toBe(a.payment_method === 'bank_transfer')
    }
    expect(isValidIban('DE89370400440532013000')).toBe(true)
    expect(isValidIban('DE89370400440532013001')).toBe(false)
  })
})

describe('products and prices', () => {
  const ds = generateDataset(scenario({ customers: 200 }))
  const products = new Map(ds.product.map((p) => [p.id, p]))
  const contacts = new Map(ds.contact.map((c) => [c.id, c]))

  it('assigns products matching sector and customer type', () => {
    for (const c of ds.contract) {
      const product = products.get(c.product_id)!
      expect(product.name).toBe(c.product_name)
      expect(product.sector).toBe(c.sector)
      expect(product.customer_type).toBe(contacts.get(c.contact_id)!.customer_type)
    }
  })

  it('has grid prices for every grid area in use and statutory prices for every year', () => {
    const gridCodes = new Set(ds.price_component.filter((p) => p.scope === 'grid').map((p) => p.grid_operator_code))
    for (const m of ds.meter) expect(gridCodes.has(m.grid_operator_code)).toBe(true)
    const taxYears = ds.price_component.filter((p) => p.component === 'electricity_tax').map((p) => p.valid_from.slice(0, 4))
    expect(taxYears).toEqual(['2024', '2025', '2026'])
    for (const p of ds.price_component) expect(Math.abs(p.gross_amount - p.net_amount * 1.19)).toBeLessThanOrEqual(0.0051)
    expect(new Set(ds.price_component.map((p) => p.id)).size).toBe(ds.price_component.length)
  })
})

describe('billing events', () => {
  const ds = generateDataset(scenario({ customers: 300, months: 36 }))
  const events = new Map(ds.billing_event.map((e) => [e.id, e]))
  const contracts = new Map(ds.contract.map((c) => [c.id, c]))

  it('keep installments inside the contract and the window', () => {
    for (const e of ds.billing_event.filter((x) => x.event_type === 'installment')) {
      const c = contracts.get(e.contract_id)!
      expect(e.event_date >= c.start_date && e.event_date >= '2023-10-01' && e.event_date <= '2026-10-01').toBe(true)
      if (c.end_date) expect(e.event_date <= c.end_date).toBe(true)
      expect(Number.isInteger(e.gross_amount)).toBe(true)
    }
  })

  it('compute invoices consistently', () => {
    const invoices = ds.billing_event.filter((e) => e.event_type === 'invoice')
    expect(invoices.length).toBeGreaterThan(100)
    for (const inv of invoices) {
      expect(inv.gross_amount).toBeCloseTo(inv.net_amount! + inv.vat_amount!, 2)
      expect(Math.abs(inv.vat_amount! - inv.net_amount! * 0.19)).toBeLessThanOrEqual(0.0051)
      expect(inv.balance).toBeCloseTo(inv.gross_amount - inv.installments_credited!, 2)
      const credited = ds.billing_event
        .filter((e) => e.event_type === 'installment' && e.contract_id === inv.contract_id && e.event_date > inv.period_start! && e.event_date <= inv.period_end!)
        .reduce((s, e) => s + e.gross_amount, 0)
      expect(inv.installments_credited).toBeCloseTo(credited, 2)
    }
  })

  it('price a full year realistically and set installments close to the bill', () => {
    const yearly = ds.billing_event.filter(
      (e) => e.invoice_type === 'annual' && (Date.parse(e.period_end!) - Date.parse(e.period_start!)) / 86_400_000 > 330 && e.consumption_kwh! > 1000,
    )
    expect(yearly.length).toBeGreaterThan(50)
    for (const inv of yearly) {
      const perKwh = inv.gross_amount / inv.consumption_kwh!
      if (contracts.get(inv.contract_id)!.sector === 'power') expect(perKwh).toBeGreaterThan(0.24), expect(perKwh).toBeLessThan(0.6)
      else expect(perKwh).toBeGreaterThan(0.08), expect(perKwh).toBeLessThan(0.22)
    }
    // After the first annual invoice the installment is recalculated, so later balances stay small.
    const balanceShare = yearly.map((e) => Math.abs(e.balance!) / e.gross_amount)
    expect(balanceShare.reduce((a, b) => a + b, 0) / balanceShare.length).toBeLessThan(0.2)
  })

  it('link payments, chargebacks and refunds to their claim', () => {
    for (const e of ds.billing_event.filter((x) => ['payment', 'chargeback', 'refund'].includes(x.event_type))) {
      const claim = events.get(e.related_event_id!)!
      expect(['installment', 'invoice']).toContain(claim.event_type)
      // Transfers may arrive up to 5 days before the due date.
      expect(Date.parse(e.event_date) - Date.parse(claim.event_date)).toBeGreaterThanOrEqual(-5 * 86_400_000)
      if (e.event_type === 'refund') expect(e.gross_amount).toBeCloseTo(-claim.balance!, 2)
    }
    const types = new Set(ds.billing_event.map((e) => e.event_type))
    expect([...types].sort()).toEqual(['chargeback', 'installment', 'invoice', 'payment', 'refund'])
  })
})

describe('exports', () => {
  it('escapes CSV per RFC 4180', () => {
    const csv = toCsv([{ a: 'x,y', b: 'say "hi"', c: null }], ['a', 'b', 'c'])
    expect(csv).toBe('a,b,c\r\n"x,y","say ""hi""",\r\n')
    expect(toCsv([{ a: 'x,y' }], ['a'], ';')).toBe('a\r\nx,y\r\n')
  })

  it('nests the full tree under contacts', () => {
    const ds = generateDataset(scenario({ customers: 5 }))
    const nested = toNestedJson(ds, defaultColumns()) as { contacts: any[]; products: any[] }
    expect(nested.contacts).toHaveLength(5)
    expect(nested.products.every((p) => p.prices.length > 0)).toBe(true)
    const events = nested.contacts.flatMap((c: any) => c.billing_accounts.flatMap((b: any) => b.billing_events))
    expect(events).toHaveLength(ds.billing_event.length)
    const readings = nested.contacts.flatMap((c: any) => c.contracts.flatMap((k: any) => k.meters.flatMap((m: any) => m.counters.flatMap((x: any) => x.readings))))
    expect(readings).toHaveLength(ds.meter_reading.length)
  })

  it('registers every generated property as a field', () => {
    const ds = generateDataset(scenario({ customers: 5 }))
    for (const key of ENTITY_ORDER) {
      const fieldKeys = ENTITIES[key].fields.map((f) => f.key).sort()
      expect(Object.keys(ds[key][0]!).sort()).toEqual(fieldKeys)
    }
  })
})
