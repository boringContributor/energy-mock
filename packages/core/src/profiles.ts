import { daysInMonth, monthIndex, monthStart, DAY_MS } from './dates'

/**
 * Monthly shares (percent, Jan–Dec, summing to 100) of annual energy. Approximations of
 * the shape of the BDEW standard load profiles and gas heating profiles — good enough for
 * plausible seasonal readings, not for settlement.
 */
export const PROFILES = {
  H25: [9.8, 8.8, 9.0, 7.9, 7.6, 7.1, 7.2, 7.4, 7.6, 8.4, 9.2, 10.0],
  G25: [8.8, 8.3, 8.7, 8.1, 8.2, 7.9, 7.9, 7.8, 8.1, 8.6, 8.7, 8.9],
  HEAT_PUMP: [16, 14, 12, 7.5, 4.5, 2.5, 2, 2, 3.5, 7.5, 12, 16.5],
  PV_FEED_IN: [3, 4.5, 8, 11, 13, 13.5, 13.5, 12, 9, 6, 4, 2.5],
  GAS_HOUSEHOLD: [16.5, 14.5, 12.5, 8, 4.5, 2, 1.5, 1.5, 3.5, 8, 12, 15.5],
  GAS_COMMERCIAL: [14.5, 13, 11.5, 8, 5.5, 3.5, 3, 3, 4.5, 8, 11, 14.5],
} as const satisfies Record<string, readonly number[]>

export type ProfileKey = keyof typeof PROFILES

/**
 * Cumulative energy series for one register: energy per calendar month from `fromMonth`
 * on, each month scaled by its own noise factor. Reading the series at any date gives a
 * monotonic value, so readings taken at arbitrary dates always agree with each other.
 */
export class EnergySeries {
  private readonly cumulative: number[] = [0]

  constructor(
    readonly fromMonth: number,
    readonly toMonth: number,
    annualKwh: number,
    profile: ProfileKey,
    noise: () => number,
  ) {
    const shares = PROFILES[profile]
    for (let m = fromMonth; m <= toMonth; m++) {
      const energy = (annualKwh * shares[m % 12]!) / 100
      this.cumulative.push(this.cumulative[this.cumulative.length - 1]! + energy * noise())
    }
  }

  /** Energy in kWh between the start of `fromMonth` and the given date. */
  at(ms: number): number {
    const m = Math.min(Math.max(monthIndex(ms), this.fromMonth), this.toMonth)
    const i = m - this.fromMonth
    const before = this.cumulative[i]!
    const month = this.cumulative[i + 1]! - before
    const fraction = Math.min(1, Math.max(0, (ms - monthStart(m)) / DAY_MS / daysInMonth(m)))
    return before + month * fraction
  }
}
