# Energy Mock Data

Linked mock data for the German energy market, generated entirely in the browser. Pick a scenario
and the columns you need, preview every table, and export CSV, ZIP or JSON. A link reproduces the
exact dataset. No backend, no accounts.

Hosted at https://energy-mock.sauerer.dev.

## What it generates

| Table | Highlights |
| --- | --- |
| Contacts | Private and business customers, German addresses (real postcode/city pairs), example-domain emails, phone numbers from the Bundesnetzagentur fiction ranges |
| Billing accounts | SEPA direct debit or transfer, real bank codes (BLZ/BIC/bank name) with valid IBAN check digits, mandate reference, payment day |
| Contracts | Power and gas, status and lifecycle (supplier change, move in/out), product, forecast, current installment |
| Products | Tariff catalogue: variable, fixed with price guarantee, dynamic (§41a EnWG), heat pump HT/NT, green products |
| Price components | Supplier energy and base prices per product and year; grid fees, metering and concession fees per grid area; electricity/energy tax, KWKG, §19 and offshore levies, CO₂ price |
| Meters | Meter numbers per DIN 43863-5, MaLo IDs with BDEW check digit, 33-character MeLo IDs, meter type, load profile, grid and metering operators with valid market partner codes |
| Meter counters | OBIS codes, HT/NT registers, PV feed-in registers with their own MaLo, gas calorific value and z-number |
| Meter readings | Monotonic readings following seasonal load profiles; yearly, quarterly or monthly; move-in/out and supplier-change readings |
| Billing events | Monthly installments, annual and final invoices computed from readings × prices (split at year boundaries, 19% VAT), payments, chargebacks, refunds; installments recalculated after each annual bill |

Everything hangs together: invoices bill the consumption the readings show at the prices in the
price table, credited installments match the installment events, and every payment points at the
claim it settles.

All people and companies are fictional. Taxes and levies follow published rates; supplier prices,
grid fees and load profiles are realistic approximations, not quotes.

## Development

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # core generator tests
pnpm build      # static site in apps/web/dist
```

- `packages/core`: the generator (pure TypeScript, deterministic per seed): `generateDataset(scenario)`, field registry, CSV/JSON/ZIP exports.
- `apps/web`: Vite + React + Tailwind UI. Settings live in the URL query.

Deploy `apps/web/dist` to any static host.
