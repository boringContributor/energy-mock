import { strToU8, zipSync } from 'fflate'

export function toZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const [name, content] of Object.entries(files)) entries[name] = strToU8(content)
  return zipSync(entries, { level: 6 })
}
