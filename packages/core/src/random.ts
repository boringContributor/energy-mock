import { Faker, base, de } from '@faker-js/faker'

/** cyrb53 string hash, folded to an unsigned 32-bit seed. */
export function hashSeed(input: string): number {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h1 ^ h2) >>> 0
}

/** German faker. Every faker call used here exists in `de`; the tests fail if one goes missing. */
export function createFaker(): Faker {
  return new Faker({ locale: [de, base] })
}

/** Deterministic digit string derived from a key, independent of the dataset seed. */
export function stableDigits(key: string, length: number): string {
  let out = ''
  let n = 0
  while (out.length < length) out += String(hashSeed(`${key}#${n++}`)).padStart(10, '0')
  return out.slice(0, length)
}

/** Deterministic number in [0, 1) derived from a key. */
export function stableUnit(key: string): number {
  return hashSeed(key) / 2 ** 32
}

/** Deterministic UUID v4-shaped ID derived from a key, for rows created outside a customer's faker stream. */
export function stableUuid(key: string): string {
  let hex = ''
  for (let i = 0; hex.length < 32; i++) hex += hashSeed(`${key}#${i}`).toString(16).padStart(8, '0')
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
