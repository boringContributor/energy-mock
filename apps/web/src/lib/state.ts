import {
  ENTITY_ORDER,
  defaultColumns,
  normalizeColumns,
  normalizeScenario,
  type ColumnSelection,
  type EntityKey,
  type Scenario,
} from '@energy-mock/core'

export type Delimiter = ',' | ';'
export type Format = 'csv' | 'json'

export interface AppState {
  scenario: Scenario
  columns: ColumnSelection
  tab: EntityKey
  delimiter: Delimiter
  format: Format
}

const SCENARIO_PARAMS: Record<keyof Scenario, string> = {
  seed: 'seed',
  customers: 'n',
  sectors: 'sectors',
  customerMix: 'mix',
  region: 'region',
  months: 'months',
  until: 'until',
  frequency: 'freq',
}

export function readState(search: string): AppState {
  const params = new URLSearchParams(search)
  const raw: Record<string, string> = {}
  for (const [key, param] of Object.entries(SCENARIO_PARAMS)) {
    const value = params.get(param)
    if (value !== null) raw[key] = value
  }
  const columns = defaultColumns()
  for (const entity of ENTITY_ORDER) {
    const value = params.get(`c_${entity}`)
    if (value !== null) columns[entity] = normalizeColumns(entity, value ? value.split(',') : [])
  }
  const tab = params.get('tab')
  return {
    scenario: normalizeScenario(raw as Partial<Scenario>),
    columns,
    tab: ENTITY_ORDER.includes(tab as EntityKey) ? (tab as EntityKey) : 'contact',
    delimiter: params.get('delim') === ';' ? ';' : ',',
    format: params.get('format') === 'json' ? 'json' : 'csv',
  }
}

/** Scenario values are always written (so a link stays reproducible); columns only when changed. */
export function writeState(state: AppState): string {
  const params = new URLSearchParams()
  for (const [key, param] of Object.entries(SCENARIO_PARAMS)) params.set(param, String(state.scenario[key as keyof Scenario]))
  if (state.tab !== 'contact') params.set('tab', state.tab)
  if (state.delimiter !== ',') params.set('delim', state.delimiter)
  if (state.format !== 'csv') params.set('format', state.format)
  const defaults = defaultColumns()
  for (const entity of ENTITY_ORDER) {
    if (state.columns[entity].join(',') !== defaults[entity].join(',')) params.set(`c_${entity}`, state.columns[entity].join(','))
  }
  return params.toString()
}

export function randomSeed(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
