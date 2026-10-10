// Date logic: ISO week (Thursday rule), Monday calculation and date arithmetic
// across month/year boundaries.
import { describe, it, expect } from 'vitest'
import {
  toISO,
  parseISO,
  formatDE,
  addDays,
  weekdayName,
  mondayOf,
  isoWeek,
  mondayOfIsoWeek,
  weekRangeLabel,
  inRange,
} from './dates.js'

describe('toISO / parseISO / formatDE', () => {
  it('are consistent with each other (local, no UTC offset)', () => {
    expect(toISO(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toISO(parseISO('2026-01-05'))).toBe('2026-01-05')
    expect(formatDE('2026-05-01')).toBe('01.05.2026')
  })
})

describe('addDays', () => {
  it('works across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29') // leap year
  })
})

describe('weekdayName / mondayOf', () => {
  it('returns German weekday names', () => {
    expect(weekdayName('2026-07-08')).toBe('Mittwoch')
    expect(weekdayName('2026-07-06')).toBe('Montag')
  })

  it('finds the Monday of the week — also on Sunday', () => {
    expect(mondayOf(new Date(2026, 6, 8))).toBe('2026-07-06') // Wednesday
    expect(mondayOf(new Date(2026, 6, 6))).toBe('2026-07-06') // Monday itself
    expect(mondayOf(new Date(2026, 6, 12))).toBe('2026-07-06') // Sunday
  })
})

describe('isoWeek (ISO 8601)', () => {
  it('handles year boundaries correctly (Thursday rule)', () => {
    // 2026-01-01 is a Thursday -> week 1/2026
    expect(isoWeek('2026-01-01')).toEqual({ week: 1, year: 2026 })
    // 2024-12-30 (Mon) belongs to the week of 2025-01-01 -> week 1/2025
    expect(isoWeek('2024-12-30')).toEqual({ week: 1, year: 2025 })
    // 2026 has 53 ISO weeks (the year starts on a Thursday)
    expect(isoWeek('2026-12-28')).toEqual({ week: 53, year: 2026 })
    // January 4th is always in week 1 by definition
    expect(isoWeek('2027-01-04').week).toBe(1)
  })
})

describe('mondayOfIsoWeek', () => {
  it('is the inverse of isoWeek', () => {
    for (const [year, week] of [[2026, 1], [2026, 29], [2026, 53], [2025, 33]]) {
      const monday = mondayOfIsoWeek(year, week)
      expect(parseISO(monday).getDay()).toBe(1) // Monday
      expect(isoWeek(monday)).toEqual({ week, year })
    }
  })
})

describe('weekRangeLabel / inRange', () => {
  it('formats the Mon–Sun range', () => {
    expect(weekRangeLabel('2026-04-20')).toBe('20.04. – 26.04.2026')
  })

  it('inRange: inclusive bounds, empty bounds are open', () => {
    expect(inRange('2026-07-08', '2026-07-08', '2026-07-08')).toBe(true)
    expect(inRange('2026-07-08', '', '')).toBe(true)
    expect(inRange('2026-07-08', '2026-07-09', '')).toBe(false)
    expect(inRange('2026-07-08', '', '2026-07-07')).toBe(false)
  })
})
