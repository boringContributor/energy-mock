import type { Faker } from '@faker-js/faker'

export interface Bank {
  blz: string
  bic: string
  name: string
}

/** Real German bank codes (Bankleitzahl) with their BIC, weighted roughly by retail market share. */
export const BANKS: { weight: number; value: Bank }[] = [
  { weight: 9, value: { blz: '37050198', bic: 'COLSDE33XXX', name: 'Sparkasse KölnBonn' } },
  { weight: 8, value: { blz: '20050550', bic: 'HASPDEHHXXX', name: 'Hamburger Sparkasse' } },
  { weight: 7, value: { blz: '70150000', bic: 'SSKMDEMMXXX', name: 'Stadtsparkasse München' } },
  { weight: 7, value: { blz: '10050000', bic: 'BELADEBEXXX', name: 'Berliner Sparkasse' } },
  { weight: 10, value: { blz: '50010517', bic: 'INGDDEFFXXX', name: 'ING-DiBa' } },
  { weight: 7, value: { blz: '10070000', bic: 'DEUTDEBBXXX', name: 'Deutsche Bank' } },
  { weight: 6, value: { blz: '50040000', bic: 'COBADEFFXXX', name: 'Commerzbank' } },
  { weight: 6, value: { blz: '44010046', bic: 'PBNKDEFFXXX', name: 'Postbank' } },
  { weight: 5, value: { blz: '12030000', bic: 'BYLADEM1001', name: 'Deutsche Kreditbank (DKB)' } },
  { weight: 4, value: { blz: '10011001', bic: 'NTSBDEB1XXX', name: 'N26 Bank' } },
  { weight: 4, value: { blz: '60050101', bic: 'SOLADEST600', name: 'Baden-Württembergische Bank' } },
  { weight: 2, value: { blz: '43060967', bic: 'GENODEM1GLS', name: 'GLS Gemeinschaftsbank' } },
]

/** ISO 13616 check digits for a German IBAN ("DE" = 13 14). */
export function ibanCheckDigits(blz: string, account: string): string {
  const digits = `${blz}${account}131400`
  let rest = 0
  for (const ch of digits) rest = (rest * 10 + Number(ch)) % 97
  return String(98 - rest).padStart(2, '0')
}

export function isValidIban(iban: string): boolean {
  if (!/^DE\d{20}$/.test(iban)) return false
  return ibanCheckDigits(iban.slice(4, 12), iban.slice(12)) === iban.slice(2, 4)
}

/** Bank, account number and an IBAN with valid check digits. */
export function generateBankAccount(f: Faker): Bank & { iban: string } {
  const bank = f.helpers.weightedArrayElement(BANKS)
  const account = f.string.numeric({ length: 10, allowLeadingZeros: true })
  return { ...bank, iban: `DE${ibanCheckDigits(bank.blz, account)}${bank.blz}${account}` }
}
