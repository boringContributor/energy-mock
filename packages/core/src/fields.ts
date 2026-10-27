import type { EntityKey, Row } from './types'

export interface FieldDef<K extends EntityKey = EntityKey> {
  key: keyof Row<K> & string
  label: string
  group: string
  /** Off by default in the column picker. */
  optional?: boolean
  description?: string
}

export interface EntityDef<K extends EntityKey = EntityKey> {
  key: K
  label: string
  /** Name of the foreign key pointing at the parent row, for nested exports. */
  parentKey?: keyof Row<K> & string
  parent?: EntityKey
  fields: FieldDef<K>[]
}

function entity<K extends EntityKey>(def: EntityDef<K>): EntityDef<K> {
  return def
}

export const ENTITIES = {
  contact: entity({
    key: 'contact',
    label: 'Contacts',
    fields: [
      { key: 'id', label: 'ID', group: 'Keys' },
      { key: 'customer_number', label: 'Customer number', group: 'Keys' },
      { key: 'customer_type', label: 'Customer type', group: 'Person' },
      { key: 'salutation', label: 'Salutation', group: 'Person' },
      { key: 'title', label: 'Title', group: 'Person', optional: true },
      { key: 'first_name', label: 'First name', group: 'Person' },
      { key: 'last_name', label: 'Last name', group: 'Person' },
      { key: 'company_name', label: 'Company', group: 'Person' },
      { key: 'vat_id', label: 'VAT ID', group: 'Person', optional: true, description: 'USt-IdNr. format only, no valid check digit' },
      { key: 'birth_date', label: 'Birth date', group: 'Person', optional: true },
      { key: 'email', label: 'Email', group: 'Communication', description: 'Reserved example domains only' },
      { key: 'phone', label: 'Phone', group: 'Communication', description: 'Bundesnetzagentur numbers reserved for fiction' },
      { key: 'street', label: 'Street', group: 'Address' },
      { key: 'house_number', label: 'House number', group: 'Address' },
      { key: 'postal_code', label: 'Postcode', group: 'Address' },
      { key: 'city', label: 'City', group: 'Address' },
      { key: 'state', label: 'State', group: 'Address', optional: true },
    ],
  }),
  billing_account: entity({
    key: 'billing_account',
    label: 'Billing accounts',
    parent: 'contact',
    parentKey: 'contact_id',
    fields: [
      { key: 'id', label: 'ID', group: 'Keys' },
      { key: 'billing_account_number', label: 'Billing account number', group: 'Keys', description: 'Vertragskonto' },
      { key: 'contact_id', label: 'Contact ID', group: 'Keys' },
      { key: 'payment_method', label: 'Payment method', group: 'Payment' },
      { key: 'account_holder', label: 'Account holder', group: 'Payment' },
      { key: 'iban', label: 'IBAN', group: 'Payment', description: 'Real bank code, valid check digits' },
      { key: 'bic', label: 'BIC', group: 'Payment', optional: true },
      { key: 'bank_name', label: 'Bank', group: 'Payment' },
      { key: 'payment_day', label: 'Payment day', group: 'Payment', optional: true, description: 'Day of month installments are due' },
      { key: 'mandate_reference', label: 'SEPA mandate reference', group: 'Payment' },
      { key: 'mandate_signed_at', label: 'Mandate signed', group: 'Payment', optional: true },
      { key: 'paperless_billing', label: 'Paperless billing', group: 'Payment', optional: true },
      { key: 'billing_street', label: 'Billing street', group: 'Billing address', optional: true },
      { key: 'billing_house_number', label: 'Billing house number', group: 'Billing address', optional: true },
      { key: 'billing_postal_code', label: 'Billing postcode', group: 'Billing address', optional: true },
      { key: 'billing_city', label: 'Billing city', group: 'Billing address', optional: true },
    ],
  }),
  contract: entity({
    key: 'contract',
    label: 'Contracts',
    parent: 'contact',
    parentKey: 'contact_id',
    fields: [
      { key: 'id', label: 'ID', group: 'Keys' },
      { key: 'contract_number', label: 'Contract number', group: 'Keys' },
      { key: 'contact_id', label: 'Contact ID', group: 'Keys' },
      { key: 'billing_account_id', label: 'Billing account ID', group: 'Keys' },
      { key: 'sector', label: 'Sector', group: 'Contract' },
      { key: 'status', label: 'Status', group: 'Contract' },
      { key: 'product_id', label: 'Product ID', group: 'Keys', optional: true },
      { key: 'product_name', label: 'Product', group: 'Contract' },
      { key: 'tariff_type', label: 'Tariff type', group: 'Contract', description: 'single, or dual (HT/NT)' },
      { key: 'annual_consumption_forecast_kwh', label: 'Forecast kWh/year', group: 'Contract' },
      { key: 'installment_amount', label: 'Installment (EUR)', group: 'Contract', description: 'Current monthly Abschlag, gross' },
      { key: 'notice_period_months', label: 'Notice period (months)', group: 'Contract', optional: true },
      { key: 'start_date', label: 'Start date', group: 'Lifecycle' },
      { key: 'start_reason', label: 'Start reason', group: 'Lifecycle' },
      { key: 'end_date', label: 'End date', group: 'Lifecycle' },
      { key: 'end_reason', label: 'End reason', group: 'Lifecycle' },
      { key: 'delivery_street', label: 'Delivery street', group: 'Delivery address', optional: true },
      { key: 'delivery_house_number', label: 'Delivery house number', group: 'Delivery address', optional: true },
      { key: 'delivery_postal_code', label: 'Delivery postcode', group: 'Delivery address', optional: true },
      { key: 'delivery_city', label: 'Delivery city', group: 'Delivery address', optional: true },
    ],
  }),
  meter: entity({
    key: 'meter',
    label: 'Meters',
    parent: 'contract',
    parentKey: 'contract_id',
    fields: [
      { key: 'id', label: 'ID', group: 'Keys' },
      { key: 'contract_id', label: 'Contract ID', group: 'Keys' },
      { key: 'meter_number', label: 'Meter number', group: 'Identification', description: 'DIN 43863-5' },
      { key: 'ma_lo_id', label: 'MaLo ID', group: 'Identification', description: 'Market location, valid check digit' },
      { key: 'me_lo_id', label: 'MeLo ID', group: 'Identification', description: 'Metering location, 33 characters' },
      { key: 'sector', label: 'Sector', group: 'Device' },
      { key: 'meter_type', label: 'Meter type', group: 'Device', description: 'mme, imsys, ferraris, diaphragm_gas' },
      { key: 'metering_procedure', label: 'Metering procedure', group: 'Device', optional: true },
      { key: 'load_profile', label: 'Load profile', group: 'Device' },
      { key: 'controllable_device_14a', label: '§14a controllable', group: 'Device', optional: true },
      { key: 'installed_at', label: 'Installed', group: 'Device', optional: true },
      { key: 'calibration_valid_until', label: 'Calibration valid until', group: 'Device', optional: true },
      { key: 'grid_operator_name', label: 'Grid operator', group: 'Market partners' },
      { key: 'grid_operator_code', label: 'Grid operator code', group: 'Market partners', description: 'BDEW 99… / DVGW 98…' },
      { key: 'metering_operator_name', label: 'Metering operator', group: 'Market partners', optional: true },
      { key: 'metering_operator_code', label: 'Metering operator code', group: 'Market partners', optional: true },
    ],
  }),
  meter_counter: entity({
    key: 'meter_counter',
    label: 'Meter counters',
    parent: 'meter',
    parentKey: 'meter_id',
    fields: [
      { key: 'id', label: 'ID', group: 'Keys' },
      { key: 'meter_id', label: 'Meter ID', group: 'Keys' },
      { key: 'obis_code', label: 'OBIS code', group: 'Register' },
      { key: 'direction', label: 'Direction', group: 'Register' },
      { key: 'tariff_zone', label: 'Tariff zone', group: 'Register' },
      { key: 'unit', label: 'Unit', group: 'Register' },
      { key: 'pre_decimal_digits', label: 'Pre-decimal digits', group: 'Register', optional: true },
      { key: 'ma_lo_id', label: 'MaLo ID', group: 'Register', description: 'Feed-in registers have their own market location' },
      { key: 'forecast_annual_kwh', label: 'Forecast kWh/year', group: 'Register' },
      { key: 'calorific_value_kwh_m3', label: 'Calorific value (kWh/m³)', group: 'Gas conversion' },
      { key: 'z_number', label: 'Z-number', group: 'Gas conversion' },
    ],
  }),
  meter_reading: entity({
    key: 'meter_reading',
    label: 'Meter readings',
    parent: 'meter_counter',
    parentKey: 'counter_id',
    fields: [
      { key: 'id', label: 'ID', group: 'Keys' },
      { key: 'meter_id', label: 'Meter ID', group: 'Keys' },
      { key: 'counter_id', label: 'Counter ID', group: 'Keys' },
      { key: 'obis_code', label: 'OBIS code', group: 'Reading' },
      { key: 'reading_date', label: 'Reading date', group: 'Reading' },
      { key: 'value', label: 'Value', group: 'Reading' },
      { key: 'unit', label: 'Unit', group: 'Reading' },
      { key: 'reason', label: 'Reason', group: 'Reading' },
      { key: 'source', label: 'Source', group: 'Reading' },
      { key: 'consumption', label: 'Consumption', group: 'Derived', description: 'Since the previous reading, in the reading unit' },
      { key: 'consumption_kwh', label: 'Consumption (kWh)', group: 'Derived', description: 'Gas: volume × calorific value × z-number' },
    ],
  }),
  product: entity({
    key: 'product',
    label: 'Products',
    fields: [
      { key: 'id', label: 'ID', group: 'Keys' },
      { key: 'product_number', label: 'Product number', group: 'Keys' },
      { key: 'name', label: 'Name', group: 'Product' },
      { key: 'sector', label: 'Sector', group: 'Product' },
      { key: 'customer_type', label: 'Customer type', group: 'Product' },
      { key: 'tariff_type', label: 'Tariff type', group: 'Product' },
      { key: 'pricing_model', label: 'Pricing model', group: 'Product', description: 'fixed, variable or dynamic (§41a EnWG)' },
      { key: 'price_guarantee_months', label: 'Price guarantee (months)', group: 'Terms' },
      { key: 'minimum_term_months', label: 'Minimum term (months)', group: 'Terms' },
      { key: 'green_energy', label: 'Green energy', group: 'Product' },
      { key: 'description', label: 'Description', group: 'Product', optional: true },
    ],
  }),
  price_component: entity({
    key: 'price_component',
    label: 'Price components',
    parent: 'product',
    parentKey: 'product_id',
    fields: [
      { key: 'id', label: 'ID', group: 'Keys' },
      { key: 'scope', label: 'Scope', group: 'Component', description: 'product (supplier), grid (per grid area) or statutory' },
      { key: 'component', label: 'Component', group: 'Component' },
      { key: 'label', label: 'Label', group: 'Component' },
      { key: 'sector', label: 'Sector', group: 'Component' },
      { key: 'product_id', label: 'Product ID', group: 'Keys' },
      { key: 'grid_operator_code', label: 'Grid operator code', group: 'Keys' },
      { key: 'grid_operator_name', label: 'Grid operator', group: 'Component', optional: true },
      { key: 'variant', label: 'Variant', group: 'Component', description: 'Tariff zone, meter type or customer type the price applies to' },
      { key: 'unit', label: 'Unit', group: 'Amount' },
      { key: 'net_amount', label: 'Net', group: 'Amount' },
      { key: 'vat_rate', label: 'VAT %', group: 'Amount', optional: true },
      { key: 'gross_amount', label: 'Gross', group: 'Amount' },
      { key: 'valid_from', label: 'Valid from', group: 'Validity' },
      { key: 'valid_to', label: 'Valid to', group: 'Validity' },
    ],
  }),
  billing_event: entity({
    key: 'billing_event',
    label: 'Billing events',
    parent: 'billing_account',
    parentKey: 'billing_account_id',
    fields: [
      { key: 'id', label: 'ID', group: 'Keys' },
      { key: 'billing_account_id', label: 'Billing account ID', group: 'Keys' },
      { key: 'contract_id', label: 'Contract ID', group: 'Keys' },
      { key: 'related_event_id', label: 'Related event ID', group: 'Keys', description: 'The installment or invoice a payment settles' },
      { key: 'event_type', label: 'Type', group: 'Event', description: 'installment, invoice, payment, chargeback, refund' },
      { key: 'invoice_type', label: 'Invoice type', group: 'Event' },
      { key: 'document_number', label: 'Document number', group: 'Event' },
      { key: 'event_date', label: 'Date', group: 'Event' },
      { key: 'due_date', label: 'Due date', group: 'Event' },
      { key: 'status', label: 'Status', group: 'Event' },
      { key: 'payment_method', label: 'Payment method', group: 'Event', optional: true },
      { key: 'period_start', label: 'Period start', group: 'Invoice' },
      { key: 'period_end', label: 'Period end', group: 'Invoice' },
      { key: 'consumption_kwh', label: 'Consumption (kWh)', group: 'Invoice' },
      { key: 'net_amount', label: 'Net (EUR)', group: 'Amounts', optional: true },
      { key: 'vat_amount', label: 'VAT (EUR)', group: 'Amounts', optional: true },
      { key: 'gross_amount', label: 'Gross (EUR)', group: 'Amounts' },
      { key: 'installments_credited', label: 'Installments credited', group: 'Amounts' },
      { key: 'balance', label: 'Balance', group: 'Amounts', description: 'Positive: back payment. Negative: credit' },
    ],
  }),
} satisfies { [K in EntityKey]: EntityDef<K> }

export const ENTITY_ORDER: EntityKey[] = [
  'contact',
  'billing_account',
  'contract',
  'product',
  'price_component',
  'meter',
  'meter_counter',
  'meter_reading',
  'billing_event',
]

export type ColumnSelection = { [K in EntityKey]: string[] }

export function defaultColumns(): ColumnSelection {
  const out = {} as ColumnSelection
  for (const key of ENTITY_ORDER) out[key] = ENTITIES[key].fields.filter((f) => !f.optional).map((f) => f.key)
  return out
}

/** Keeps known keys in registry order; unknown keys are dropped. */
export function normalizeColumns(entity: EntityKey, keys: readonly string[]): string[] {
  const wanted = new Set(keys)
  return ENTITIES[entity].fields.filter((f) => wanted.has(f.key)).map((f) => f.key)
}
