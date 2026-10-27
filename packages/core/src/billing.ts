import type { Faker } from '@faker-js/faker'
import { DAY_MS, isoDate, monthIndex, utc } from './dates'
import { VAT_RATE, baseCharge, energyRate, type PriceBook, type TariffContext } from './pricing'
import type { BillingAccount, BillingEvent, Contract } from './types'

export type Zone = 'single' | 'ht' | 'nt'
export type ZoneKwh = Partial<Record<Zone, number>>

/** A billing-relevant meter reading: cumulative kWh per tariff zone at that date. */
export interface BillingPoint {
  date: number
  kind: 'start' | 'periodic' | 'end'
  kwh: ZoneKwh
}

interface Args {
  f: Faker
  contract: Contract
  account: BillingAccount
  tariff: TariffContext
  book: PriceBook
  points: BillingPoint[]
  /** Supplier forecast per zone, kWh/year, used for the first installment. */
  forecast: ZoneKwh
  windowStart: number
  windowEnd: number
}

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const yearOf = (ms: number) => new Date(ms).getUTCFullYear()

/** Gross EUR per year for a consumption profile at a given year's prices. */
function annualGross(book: PriceBook, t: TariffContext, kwh: ZoneKwh, year: number): number {
  let net = baseCharge(book, t, year)
  for (const [zone, amount] of Object.entries(kwh) as [Zone, number][]) net += (amount * energyRate(book, t, zone, year)) / 100
  return net * (1 + VAT_RATE / 100)
}

/** Monthly installment, rounded up to whole euros as most suppliers do. */
function installmentFor(book: PriceBook, t: TariffContext, kwh: ZoneKwh, year: number): number {
  return Math.max(5, Math.ceil(annualGross(book, t, kwh, year) / 12))
}

/** Net amount for a billing period, split at 1 January so each part uses that year's prices. */
function invoiceNet(book: PriceBook, t: TariffContext, from: number, to: number, kwh: ZoneKwh): number {
  const totalDays = Math.max(1, (to - from) / DAY_MS)
  let net = 0
  let cursor = from
  while (cursor < to) {
    const year = yearOf(cursor)
    const segmentEnd = Math.min(to, utc(year + 1, 0, 1))
    const days = (segmentEnd - cursor) / DAY_MS
    // Consumption is apportioned by days (zeitanteilige Abgrenzung).
    for (const [zone, amount] of Object.entries(kwh) as [Zone, number][]) net += (amount * (days / totalDays) * energyRate(book, t, zone, year)) / 100
    net += (baseCharge(book, t, year) * days) / 365
    cursor = segmentEnd
  }
  return cents(net)
}

function diff(a: ZoneKwh, b: ZoneKwh): ZoneKwh {
  const out: ZoneKwh = {}
  for (const zone of Object.keys(b) as Zone[]) out[zone] = Math.max(0, (b[zone] ?? 0) - (a[zone] ?? 0))
  return out
}

const sum = (kwh: ZoneKwh) => Object.values(kwh).reduce((a, b) => a + (b ?? 0), 0)

/**
 * Installments, annual/final invoices and the payments that settle them. Installments are
 * recalculated after every annual invoice from the billed consumption, like a real supplier.
 */
export function generateBillingEvents(args: Args): BillingEvent[] {
  const { f, contract, account, tariff, book, points, windowStart, windowEnd } = args
  const start = Date.parse(contract.start_date)
  const end = contract.end_date === null ? null : Date.parse(contract.end_date)
  const lastDay = end === null ? windowEnd : Math.min(end, windowEnd)
  const sepa = account.payment_method === 'sepa_direct_debit'
  const events: BillingEvent[] = []

  const base = {
    billing_account_id: account.id,
    contract_id: contract.id,
    invoice_type: null,
    document_number: null,
    due_date: null,
    period_start: null,
    period_end: null,
    consumption_kwh: null,
    net_amount: null,
    vat_amount: null,
    installments_credited: null,
    balance: null,
    related_event_id: null,
  } satisfies Partial<BillingEvent>

  const settle = (claim: BillingEvent, due: number, amount: number) => {
    // Most customers pay; a few direct debits bounce and a few transfers are late or missing.
    if (sepa) {
      if (due > windowEnd) return
      if (f.datatype.boolean({ probability: 0.025 })) {
        const returnedAt = due + f.number.int({ min: 3, max: 7 }) * DAY_MS
        const fee = f.number.float({ min: 3, max: 8.5, fractionDigits: 2 })
        if (returnedAt <= windowEnd)
          events.push({ ...base, id: f.string.uuid(), event_type: 'chargeback', event_date: isoDate(returnedAt), gross_amount: cents(amount + fee), payment_method: 'sepa_direct_debit', status: 'completed', related_event_id: claim.id })
        const repaidAt = returnedAt + f.number.int({ min: 5, max: 20 }) * DAY_MS
        if (repaidAt <= windowEnd) {
          events.push({ ...base, id: f.string.uuid(), event_type: 'payment', event_date: isoDate(repaidAt), gross_amount: cents(amount + fee), payment_method: 'bank_transfer', status: 'completed', related_event_id: claim.id })
          claim.status = 'paid'
        } else claim.status = 'returned'
        return
      }
      events.push({ ...base, id: f.string.uuid(), event_type: 'payment', event_date: isoDate(due), gross_amount: amount, payment_method: 'sepa_direct_debit', status: 'completed', related_event_id: claim.id })
      claim.status = 'paid'
      return
    }
    const paidAt = due + f.number.int({ min: -5, max: 12 }) * DAY_MS
    if (f.datatype.boolean({ probability: 0.05 }) || paidAt > windowEnd) {
      claim.status = due + 30 * DAY_MS < windowEnd ? 'overdue' : 'open'
      return
    }
    events.push({ ...base, id: f.string.uuid(), event_type: 'payment', event_date: isoDate(paidAt), gross_amount: amount, payment_method: 'bank_transfer', status: 'completed', related_event_id: claim.id })
    claim.status = 'paid'
  }

  const installments: { due: number; event: BillingEvent }[] = []
  const firstMonth = monthIndex(Math.max(start, windowStart))
  const dues: number[] = []
  for (let m = firstMonth; m <= monthIndex(lastDay); m++) {
    const due = utc(Math.floor(m / 12), m % 12, account.payment_day)
    if (due >= start && due >= windowStart && due <= lastDay) dues.push(due)
  }

  let amount = installmentFor(book, tariff, args.forecast, yearOf(dues[0] ?? lastDay))
  let next = 0
  const addInstallmentsUntil = (limit: number) => {
    while (next < dues.length && dues[next]! <= limit) {
      const due = dues[next++]!
      const net = cents(amount / (1 + VAT_RATE / 100))
      const event: BillingEvent = {
        ...base,
        id: f.string.uuid(),
        event_type: 'installment',
        event_date: isoDate(due),
        due_date: isoDate(due),
        net_amount: net,
        vat_amount: cents(amount - net),
        gross_amount: amount,
        payment_method: account.payment_method,
        status: 'open',
      }
      events.push(event)
      installments.push({ due, event })
      settle(event, due, amount)
    }
  }

  const billing = points
  for (let i = 1; i < billing.length; i++) {
    const from = billing[i - 1]!
    const to = billing[i]!
    const invoiceDate = to.date + f.number.int({ min: 4, max: 21 }) * DAY_MS
    addInstallmentsUntil(to.date)
    // The invoice run happens a few days after the reading; later than the window means not billed yet.
    if (invoiceDate > windowEnd) break

    const consumption = diff(from.kwh, to.kwh)
    const net = invoiceNet(book, tariff, from.date, to.date, consumption)
    const vat = cents((net * VAT_RATE) / 100)
    const gross = cents(net + vat)
    const credited = cents(installments.filter((x) => x.due > from.date && x.due <= to.date).reduce((s, x) => s + x.event.gross_amount, 0))
    const balance = cents(gross - credited)
    const due = invoiceDate + 14 * DAY_MS
    const invoice: BillingEvent = {
      ...base,
      id: f.string.uuid(),
      event_type: 'invoice',
      invoice_type: to.kind === 'end' ? 'final' : 'annual',
      document_number: `R${yearOf(invoiceDate)}-${contract.contract_number.slice(1)}-${i}`,
      event_date: isoDate(invoiceDate),
      due_date: isoDate(due),
      period_start: isoDate(from.date),
      period_end: isoDate(to.date),
      consumption_kwh: Math.round(sum(consumption)),
      net_amount: net,
      vat_amount: vat,
      gross_amount: gross,
      installments_credited: credited,
      balance,
      payment_method: account.payment_method,
      status: 'paid',
    }
    events.push(invoice)
    if (balance > 0) settle(invoice, due, balance)
    else if (balance < 0) {
      const refundAt = invoiceDate + f.number.int({ min: 5, max: 14 }) * DAY_MS
      if (refundAt <= windowEnd)
        events.push({ ...base, id: f.string.uuid(), event_type: 'refund', event_date: isoDate(refundAt), gross_amount: -balance, payment_method: 'bank_transfer', status: 'completed', related_event_id: invoice.id })
    }

    // New installment from the billed consumption, annualised, at the prices of the invoice year.
    const days = (to.date - from.date) / DAY_MS
    if (to.kind !== 'end' && days >= 60) {
      const annualised: ZoneKwh = {}
      for (const [zone, kwh] of Object.entries(consumption) as [Zone, number][]) annualised[zone] = (kwh * 365) / days
      amount = installmentFor(book, tariff, annualised, yearOf(invoiceDate))
    }
  }
  addInstallmentsUntil(lastDay)

  contract.installment_amount = amount
  return events.sort((a, b) => (a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0))
}
