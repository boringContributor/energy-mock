import type { Faker } from '@faker-js/faker'

/**
 * Market location ID (MaLo, Marktlokations-ID): 11 digits, the last one a check digit.
 * BDEW algorithm: odd positions summed, even positions summed and doubled,
 * check digit = (10 - total mod 10) mod 10.
 */
export function maloCheckDigit(first10: string): number {
  let odd = 0
  let even = 0
  for (let i = 0; i < 10; i++) {
    const d = Number(first10[i])
    if (i % 2 === 0) odd += d
    else even += d
  }
  return (10 - ((odd + even * 2) % 10)) % 10
}

export function isValidMaloId(id: string): boolean {
  return /^[1-9]\d{10}$/.test(id) && maloCheckDigit(id.slice(0, 10)) === Number(id[10])
}

export function generateMaloId(f: Faker): string {
  const body = String(f.number.int({ min: 1, max: 9 })) + f.string.numeric(9)
  return body + maloCheckDigit(body)
}

/**
 * Market partner ID (BDEW code 99…, DVGW code 98…): 13 digits, GLN-style mod-10
 * check digit with weights 1 and 3 alternating from the left.
 */
export function marketPartnerCheckDigit(first12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}

export function isValidMarketPartnerId(id: string): boolean {
  return /^9[89]\d{11}$/.test(id) && marketPartnerCheckDigit(id.slice(0, 12)) === Number(id[12])
}

export function marketPartnerId(prefix: '98' | '99', digits10: string): string {
  const body = prefix + digits10
  return body + marketPartnerCheckDigit(body)
}

/**
 * Metering location ID (MeLo, Zählpunktbezeichnung): 33 characters —
 * "DE", 6-digit grid operator number, 5-digit postcode, 20-character point number.
 */
export function generateMeloId(f: Faker, operatorNumber: string, postalCode: string): string {
  return `DE${operatorNumber}${postalCode}${f.string.numeric(20)}`
}

export function isValidMeloId(id: string): boolean {
  return /^DE\d{11}[A-Z0-9]{20}$/.test(id)
}

const POWER_MANUFACTURERS = ['EMH', 'ESY', 'ITF', 'LGZ', 'EBZ', 'ISK', 'DZG', 'EFR']
const GAS_MANUFACTURERS = ['ELS', 'ITR', 'PIP', 'GWF', 'RMG']

/** Meter number per DIN 43863-5: sector digit, manufacturer FLAG ID, 2-digit block, 8-digit serial. */
export function generateMeterNumber(f: Faker, sector: 'power' | 'gas'): string {
  const manufacturer = f.helpers.arrayElement(sector === 'power' ? POWER_MANUFACTURERS : GAS_MANUFACTURERS)
  return `${sector === 'power' ? '1' : '7'}${manufacturer}${f.string.numeric(2)}${f.string.numeric(8)}`
}
