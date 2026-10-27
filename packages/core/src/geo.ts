import { marketPartnerId } from './ids'
import { stableDigits } from './random'

export interface City {
  postalCode: string
  city: string
  state: string
  /** More than 500,000 inhabitants: sets the concession fee tier. */
  large?: boolean
}

/** Real postcode/city pairs (city-centre postcodes) spread over all ten postcode regions. */
export const CITIES: City[] = [
  { postalCode: '01067', city: 'Dresden', large: true, state: 'Sachsen' },
  { postalCode: '04109', city: 'Leipzig', large: true, state: 'Sachsen' },
  { postalCode: '06108', city: 'Halle (Saale)', state: 'Sachsen-Anhalt' },
  { postalCode: '10115', city: 'Berlin', large: true, state: 'Berlin' },
  { postalCode: '14467', city: 'Potsdam', state: 'Brandenburg' },
  { postalCode: '18055', city: 'Rostock', state: 'Mecklenburg-Vorpommern' },
  { postalCode: '20095', city: 'Hamburg', large: true, state: 'Hamburg' },
  { postalCode: '23552', city: 'Lübeck', state: 'Schleswig-Holstein' },
  { postalCode: '24103', city: 'Kiel', state: 'Schleswig-Holstein' },
  { postalCode: '26122', city: 'Oldenburg', state: 'Niedersachsen' },
  { postalCode: '28195', city: 'Bremen', large: true, state: 'Bremen' },
  { postalCode: '30159', city: 'Hannover', large: true, state: 'Niedersachsen' },
  { postalCode: '33602', city: 'Bielefeld', state: 'Nordrhein-Westfalen' },
  { postalCode: '34117', city: 'Kassel', state: 'Hessen' },
  { postalCode: '39104', city: 'Magdeburg', state: 'Sachsen-Anhalt' },
  { postalCode: '40213', city: 'Düsseldorf', large: true, state: 'Nordrhein-Westfalen' },
  { postalCode: '42103', city: 'Wuppertal', state: 'Nordrhein-Westfalen' },
  { postalCode: '44135', city: 'Dortmund', large: true, state: 'Nordrhein-Westfalen' },
  { postalCode: '45127', city: 'Essen', large: true, state: 'Nordrhein-Westfalen' },
  { postalCode: '48143', city: 'Münster', state: 'Nordrhein-Westfalen' },
  { postalCode: '50667', city: 'Köln', large: true, state: 'Nordrhein-Westfalen' },
  { postalCode: '52062', city: 'Aachen', state: 'Nordrhein-Westfalen' },
  { postalCode: '53111', city: 'Bonn', state: 'Nordrhein-Westfalen' },
  { postalCode: '55116', city: 'Mainz', state: 'Rheinland-Pfalz' },
  { postalCode: '60311', city: 'Frankfurt am Main', large: true, state: 'Hessen' },
  { postalCode: '65183', city: 'Wiesbaden', state: 'Hessen' },
  { postalCode: '66111', city: 'Saarbrücken', state: 'Saarland' },
  { postalCode: '68159', city: 'Mannheim', state: 'Baden-Württemberg' },
  { postalCode: '70173', city: 'Stuttgart', large: true, state: 'Baden-Württemberg' },
  { postalCode: '76133', city: 'Karlsruhe', state: 'Baden-Württemberg' },
  { postalCode: '79098', city: 'Freiburg im Breisgau', state: 'Baden-Württemberg' },
  { postalCode: '80331', city: 'München', large: true, state: 'Bayern' },
  { postalCode: '86150', city: 'Augsburg', state: 'Bayern' },
  { postalCode: '89073', city: 'Ulm', state: 'Baden-Württemberg' },
  { postalCode: '90402', city: 'Nürnberg', large: true, state: 'Bayern' },
  { postalCode: '93047', city: 'Regensburg', state: 'Bayern' },
  { postalCode: '97070', city: 'Würzburg', state: 'Bayern' },
  { postalCode: '99084', city: 'Erfurt', state: 'Thüringen' },
]

export function citiesInRegion(region: string): City[] {
  if (region === 'all') return CITIES
  const matches = CITIES.filter((c) => c.postalCode.startsWith(region))
  return matches.length > 0 ? matches : CITIES
}

export interface MarketPartner {
  name: string
  /** 13-digit BDEW (power, 99…) or DVGW (gas, 98…) code */
  code: string
  /** 6-digit operator number used inside metering location IDs */
  operatorNumber: string
}

/**
 * Grid operators are fictional ("… Demo GmbH") so mock data never claims to be a real
 * company, but they are stable per city and sector and carry valid-format codes.
 */
export function gridOperator(city: City, sector: 'power' | 'gas'): MarketPartner {
  const key = `grid:${sector}:${city.postalCode}`
  return {
    name: `Verteilnetz ${city.city} Demo GmbH`,
    code: marketPartnerId(sector === 'power' ? '99' : '98', stableDigits(key, 10)),
    operatorNumber: stableDigits(`${key}:vnb`, 6),
  }
}

/** A competitive metering point operator (wettbewerblicher Messstellenbetreiber). */
export const COMPETITIVE_METERING_OPERATOR: MarketPartner = {
  name: 'Messwerk Demo GmbH',
  code: marketPartnerId('99', stableDigits('msb:messwerk', 10)),
  operatorNumber: stableDigits('msb:messwerk:vnb', 6),
}

/**
 * Fictional-use ("Drama") landline ranges the Bundesnetzagentur keeps free for film and
 * TV, so generated phone numbers never reach a real subscriber.
 */
export const DRAMA_PHONE_PREFIXES = ['+49 30 23125', '+49 40 66969', '+49 69 90009', '+49 221 4710', '+49 89 99998']
