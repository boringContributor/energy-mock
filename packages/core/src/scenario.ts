import { formatMonth, utc } from './dates'

export type SectorMix = 'power' | 'gas' | 'power_gas'
export type CustomerMix = 'private' | 'commercial' | 'mixed'
export type ReadingFrequency = 'yearly' | 'quarterly' | 'monthly'

export interface Scenario {
  seed: string
  customers: number
  sectors: SectorMix
  customerMix: CustomerMix
  /** Postcode region: "all" or a leading digit "0"–"9". */
  region: string
  /** Length of the reading window in months. */
  months: number
  /** Window end, "YYYY-MM": readings run up to the first day of this month. */
  until: string
  frequency: ReadingFrequency
}

export const LIMITS = {
  customers: { min: 1, max: 1000 },
  months: { min: 1, max: 60 },
} as const

export function defaultScenario(now = new Date()): Scenario {
  return {
    seed: 'demo',
    customers: 25,
    sectors: 'power_gas',
    customerMix: 'mixed',
    region: 'all',
    months: 24,
    until: formatMonth(utc(now.getUTCFullYear(), now.getUTCMonth())),
    frequency: 'yearly',
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))

/** Coerces untrusted input (e.g. URL parameters) into a valid scenario. */
export function normalizeScenario(input: Partial<Scenario>, now = new Date()): Scenario {
  const d = defaultScenario(now)
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback
  const num = (value: unknown, fallback: number) => (Number.isFinite(Number(value)) && value !== '' ? Number(value) : fallback)
  return {
    seed: typeof input.seed === 'string' ? input.seed.slice(0, 64) : d.seed,
    customers: clamp(num(input.customers, d.customers), LIMITS.customers.min, LIMITS.customers.max),
    sectors: pick(input.sectors, ['power', 'gas', 'power_gas'], d.sectors),
    customerMix: pick(input.customerMix, ['private', 'commercial', 'mixed'], d.customerMix),
    region: typeof input.region === 'string' && /^(all|\d)$/.test(input.region) ? input.region : d.region,
    months: clamp(num(input.months, d.months), LIMITS.months.min, LIMITS.months.max),
    until: typeof input.until === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(input.until) ? input.until : d.until,
    frequency: pick(input.frequency, ['yearly', 'quarterly', 'monthly'], d.frequency),
  }
}
