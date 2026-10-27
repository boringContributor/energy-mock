import { ENTITIES, type ColumnSelection } from '../fields'
import type { Dataset, EntityKey } from '../types'

/** Foreign keys: each row of `from` points at exactly one row of `to` (or none, when null). */
export const RELATIONS: { from: EntityKey; key: string; to: EntityKey }[] = [
  { from: 'billing_account', key: 'contact_id', to: 'contact' },
  { from: 'contract', key: 'contact_id', to: 'contact' },
  { from: 'contract', key: 'billing_account_id', to: 'billing_account' },
  { from: 'contract', key: 'product_id', to: 'product' },
  { from: 'meter', key: 'contract_id', to: 'contract' },
  { from: 'meter_counter', key: 'meter_id', to: 'meter' },
  { from: 'meter_reading', key: 'counter_id', to: 'meter_counter' },
  { from: 'meter_reading', key: 'meter_id', to: 'meter' },
  { from: 'billing_event', key: 'billing_account_id', to: 'billing_account' },
  { from: 'billing_event', key: 'contract_id', to: 'contract' },
  { from: 'price_component', key: 'product_id', to: 'product' },
]

interface Step {
  entity: EntityKey
  via: EntityKey
  key: string
}

/**
 * Entities reachable from `base` by following foreign keys, nearest first. Only parents are
 * reachable, so every one of them contributes at most one record per base row.
 */
function ancestorPaths(base: EntityKey): Step[] {
  const steps: Step[] = []
  const seen = new Set<EntityKey>([base])
  const queue: EntityKey[] = [base]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const r of RELATIONS) {
      if (r.from !== current || seen.has(r.to)) continue
      seen.add(r.to)
      steps.push({ entity: r.to, via: current, key: r.key })
      queue.push(r.to)
    }
  }
  return steps
}

export function relatedEntities(base: EntityKey): EntityKey[] {
  return ancestorPaths(base).map((s) => s.entity)
}

export interface JoinedTable {
  /** Base columns as-is, related columns prefixed with their entity, e.g. "contact.first_name". */
  columns: string[]
  rows: Record<string, unknown>[]
  /** Same rows with related records nested as objects, for JSON. */
  nested: Record<string, unknown>[]
}

/** One row per `base` record, with the selected columns of the chosen related entities alongside. */
export function toJoinedTable(dataset: Dataset, base: EntityKey, include: readonly EntityKey[], columns: ColumnSelection): JoinedTable {
  const wanted = new Set(include)
  const steps = ancestorPaths(base)
  // Intermediate entities are resolved even when not exported, so deeper ones stay reachable.
  const needed = new Set<EntityKey>()
  for (const step of [...steps].reverse()) {
    if (wanted.has(step.entity) || needed.has(step.entity)) needed.add(step.via)
  }
  const index = new Map<EntityKey, Map<string, Record<string, unknown>>>()
  for (const step of steps) {
    if (!wanted.has(step.entity) && !needed.has(step.entity)) continue
    index.set(step.entity, new Map((dataset[step.entity] as { id: string }[]).map((r) => [r.id, r as unknown as Record<string, unknown>])))
  }
  const exported = steps.filter((s) => wanted.has(s.entity))
  const outColumns = [...columns[base], ...exported.flatMap((s) => columns[s.entity].map((c) => `${s.entity}.${c}`))]

  const rows: Record<string, unknown>[] = []
  const nested: Record<string, unknown>[] = []
  for (const raw of dataset[base] as object[]) {
    const record = raw as Record<string, unknown>
    const resolved = new Map<EntityKey, Record<string, unknown> | undefined>([[base, record]])
    for (const step of steps) {
      if (!index.has(step.entity)) continue
      const parent = resolved.get(step.via)
      const id = parent?.[step.key]
      resolved.set(step.entity, typeof id === 'string' ? index.get(step.entity)!.get(id) : undefined)
    }
    const flat: Record<string, unknown> = {}
    const tree: Record<string, unknown> = {}
    for (const c of columns[base]) flat[c] = tree[c] = record[c]
    for (const step of exported) {
      const related = resolved.get(step.entity)
      const sub: Record<string, unknown> = {}
      for (const c of columns[step.entity]) flat[`${step.entity}.${c}`] = sub[c] = related?.[c] ?? null
      tree[step.entity] = related ? sub : null
    }
    rows.push(flat)
    nested.push(tree)
  }
  return { columns: outColumns, rows, nested }
}

export function joinedLabel(base: EntityKey, include: readonly EntityKey[]): string {
  return [base, ...include].map((e) => ENTITIES[e].label.toLowerCase()).join(' + ')
}
