import { ENTITIES, ENTITY_ORDER, type ColumnSelection } from '../fields'
import type { Dataset, EntityKey } from '../types'

function project(row: object, columns: readonly string[]): Record<string, unknown> {
  const record = row as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const c of columns) out[c] = record[c]
  return out
}

/** One array per entity, rows reduced to the selected columns. */
export function toFlatJson(dataset: Dataset, columns: ColumnSelection): Record<EntityKey, Record<string, unknown>[]> {
  const out = {} as Record<EntityKey, Record<string, unknown>[]>
  for (const key of ENTITY_ORDER) out[key] = dataset[key].map((row) => project(row, columns[key]))
  return out
}

const CHILDREN: Record<EntityKey, { entity: EntityKey; property: string }[]> = {
  contact: [
    { entity: 'billing_account', property: 'billing_accounts' },
    { entity: 'contract', property: 'contracts' },
  ],
  billing_account: [{ entity: 'billing_event', property: 'billing_events' }],
  billing_event: [],
  product: [{ entity: 'price_component', property: 'prices' }],
  price_component: [],
  contract: [{ entity: 'meter', property: 'meters' }],
  meter: [{ entity: 'meter_counter', property: 'counters' }],
  meter_counter: [{ entity: 'meter_reading', property: 'readings' }],
  meter_reading: [],
}

/**
 * Contacts with billing accounts → billing events and contracts → meters → counters → readings
 * nested inside; products with their supplier prices; grid and statutory prices on their own.
 */
export function toNestedJson(dataset: Dataset, columns: ColumnSelection): Record<string, unknown> {
  const byParent = new Map<EntityKey, Map<string, object[]>>()
  for (const key of ENTITY_ORDER) {
    const def = ENTITIES[key]
    if (!def.parentKey) continue
    const groups = new Map<string, object[]>()
    for (const row of dataset[key] as object[]) {
      const parentId = (row as Record<string, unknown>)[def.parentKey] as string
      const list = groups.get(parentId)
      if (list) list.push(row)
      else groups.set(parentId, [row])
    }
    byParent.set(key, groups)
  }
  const build = (entity: EntityKey, row: object): Record<string, unknown> => {
    const out = project(row, columns[entity])
    const id = (row as { id: string }).id
    for (const child of CHILDREN[entity]) {
      out[child.property] = (byParent.get(child.entity)?.get(id) ?? []).map((r) => build(child.entity, r))
    }
    return out
  }
  return {
    contacts: dataset.contact.map((row) => build('contact', row)),
    products: dataset.product.map((row) => build('product', row)),
    price_components: dataset.price_component.filter((p) => p.product_id === null).map((row) => project(row, columns.price_component)),
  }
}
