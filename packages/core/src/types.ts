export type Sector = 'power' | 'gas'
export type CustomerType = 'private' | 'commercial'

export interface Contact {
  id: string
  customer_number: string
  customer_type: CustomerType
  salutation: 'Herr' | 'Frau'
  title: string | null
  first_name: string
  last_name: string
  company_name: string | null
  vat_id: string | null
  birth_date: string | null
  email: string
  phone: string
  street: string
  house_number: string
  postal_code: string
  city: string
  state: string
}

export interface BillingAccount {
  id: string
  billing_account_number: string
  contact_id: string
  payment_method: 'sepa_direct_debit' | 'bank_transfer'
  account_holder: string
  iban: string
  bic: string
  bank_name: string
  /** Day of month installments are due. */
  payment_day: number
  mandate_reference: string | null
  mandate_signed_at: string | null
  paperless_billing: boolean
  billing_street: string
  billing_house_number: string
  billing_postal_code: string
  billing_city: string
}

export type ContractStatus = 'active' | 'terminated' | 'ended'
export type StartReason = 'supplier_change' | 'move_in' | 'new_connection'
export type EndReason = 'supplier_change' | 'move_out' | 'cancellation'

export interface Contract {
  id: string
  contract_number: string
  contact_id: string
  billing_account_id: string
  sector: Sector
  status: ContractStatus
  product_id: string
  product_name: string
  tariff_type: 'single' | 'dual'
  start_date: string
  start_reason: StartReason
  end_date: string | null
  end_reason: EndReason | null
  notice_period_months: number
  annual_consumption_forecast_kwh: number
  /** Current monthly installment (Abschlag), gross EUR. */
  installment_amount: number
  delivery_street: string
  delivery_house_number: string
  delivery_postal_code: string
  delivery_city: string
}

export type MeterType = 'mme' | 'imsys' | 'ferraris' | 'diaphragm_gas'

export interface Meter {
  id: string
  contract_id: string
  meter_number: string
  ma_lo_id: string
  me_lo_id: string
  sector: Sector
  meter_type: MeterType
  metering_procedure: 'SLP'
  load_profile: string
  controllable_device_14a: boolean
  grid_operator_name: string
  grid_operator_code: string
  metering_operator_name: string
  metering_operator_code: string
  installed_at: string
  calibration_valid_until: string
}

export interface MeterCounter {
  id: string
  meter_id: string
  obis_code: string
  direction: 'consumption' | 'feed_in'
  tariff_zone: 'single' | 'ht' | 'nt'
  unit: 'kWh' | 'm³'
  pre_decimal_digits: number
  ma_lo_id: string
  calorific_value_kwh_m3: number | null
  z_number: number | null
  forecast_annual_kwh: number
}

export type ReadingReason = 'periodic' | 'supplier_change' | 'move_in' | 'move_out' | 'new_connection' | 'contract_end'
export type ReadingSource = 'customer' | 'grid_operator' | 'metering_operator' | 'estimated'

export interface MeterReading {
  id: string
  meter_id: string
  counter_id: string
  obis_code: string
  reading_date: string
  value: number
  unit: 'kWh' | 'm³'
  reason: ReadingReason
  source: ReadingSource
  /** Difference to the previous reading of the same counter, in `unit`. */
  consumption: number | null
  /** `consumption` in kWh (gas: volume × calorific value × z-number). */
  consumption_kwh: number | null
}

export interface Product {
  id: string
  product_number: string
  name: string
  sector: Sector
  customer_type: CustomerType
  tariff_type: 'single' | 'dual'
  pricing_model: 'fixed' | 'variable' | 'dynamic'
  price_guarantee_months: number | null
  minimum_term_months: number
  green_energy: boolean
  description: string
}

export type PriceScope = 'product' | 'grid' | 'statutory'
export type PriceComponentKey =
  | 'energy_price'
  | 'base_price'
  | 'grid_energy'
  | 'grid_base'
  | 'metering'
  | 'concession_fee'
  | 'grid_rebate_14a'
  | 'electricity_tax'
  | 'kwkg_levy'
  | 'par19_levy'
  | 'offshore_levy'
  | 'energy_tax'
  | 'co2_price'

export interface PriceComponent {
  id: string
  scope: PriceScope
  component: PriceComponentKey
  label: string
  sector: Sector
  product_id: string | null
  grid_operator_code: string | null
  grid_operator_name: string | null
  /** Which customers, meters or tariff zones the price applies to, e.g. "ht", "imsys", "private". */
  variant: string | null
  unit: 'ct/kWh' | 'EUR/year'
  net_amount: number
  vat_rate: number
  gross_amount: number
  valid_from: string
  valid_to: string
}

export type BillingEventType = 'installment' | 'invoice' | 'payment' | 'chargeback' | 'refund'
export type BillingEventStatus = 'paid' | 'open' | 'overdue' | 'returned' | 'completed'

export interface BillingEvent {
  id: string
  billing_account_id: string
  contract_id: string
  event_type: BillingEventType
  /** Invoices: annual or final bill. */
  invoice_type: 'annual' | 'final' | null
  document_number: string | null
  event_date: string
  due_date: string | null
  period_start: string | null
  period_end: string | null
  consumption_kwh: number | null
  net_amount: number | null
  vat_amount: number | null
  gross_amount: number
  installments_credited: number | null
  /** Invoice gross minus installments; negative means a credit for the customer. */
  balance: number | null
  payment_method: 'sepa_direct_debit' | 'bank_transfer' | null
  status: BillingEventStatus
  related_event_id: string | null
}

export interface Dataset {
  contact: Contact[]
  billing_account: BillingAccount[]
  contract: Contract[]
  product: Product[]
  price_component: PriceComponent[]
  meter: Meter[]
  meter_counter: MeterCounter[]
  meter_reading: MeterReading[]
  billing_event: BillingEvent[]
}

export type EntityKey = keyof Dataset
export type Row<K extends EntityKey> = Dataset[K][number]
