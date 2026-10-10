// Holiday logic: Easter formula + state-specific holidays (acceptance criterion:
// the holidays of Schleswig-Holstein incl. the movable ones).
import { describe, it, expect } from 'vitest'
import { easterSunday, holidaysForYear, holidayOn } from './holidays.js'
import { toISO, parseISO } from './dates.js'

describe('easterSunday (Gauss/Lichtenberg)', () => {
  it('returns known Easter dates', () => {
    expect(toISO(easterSunday(2024))).toBe('2024-03-31')
    expect(toISO(easterSunday(2025))).toBe('2025-04-20')
    expect(toISO(easterSunday(2026))).toBe('2026-04-05')
    expect(toISO(easterSunday(2027))).toBe('2027-03-28')
  })
})

describe('holidaysForYear — Schleswig-Holstein 2026', () => {
  const sh = holidaysForYear(2026, 'SH')

  it('contains the movable holidays', () => {
    expect(sh.get('2026-04-03')).toBe('Karfreitag')
    expect(sh.get('2026-04-06')).toBe('Ostermontag')
    expect(sh.get('2026-05-14')).toBe('Christi Himmelfahrt')
    expect(sh.get('2026-05-25')).toBe('Pfingstmontag')
  })

  it('contains the fixed holidays incl. Reformation Day', () => {
    expect(sh.get('2026-01-01')).toBe('Neujahr')
    expect(sh.get('2026-05-01')).toBe('Tag der Arbeit')
    expect(sh.get('2026-10-03')).toBe('Tag der Deutschen Einheit')
    expect(sh.get('2026-10-31')).toBe('Reformationstag')
    expect(sh.get('2026-12-25')).toBe('1. Weihnachtstag')
    expect(sh.get('2026-12-26')).toBe('2. Weihnachtstag')
  })

  it('contains NO southern-only holidays', () => {
    expect(sh.get('2026-06-04')).toBeUndefined() // Corpus Christi
    expect(sh.get('2026-11-01')).toBeUndefined() // All Saints' Day
    expect(sh.get('2026-01-06')).toBeUndefined() // Epiphany
  })
})

describe('state-specific special cases', () => {
  it('Bavaria has Corpus Christi and All Saints\' Day', () => {
    const by = holidaysForYear(2026, 'BY')
    expect(by.get('2026-06-04')).toBe('Fronleichnam') // Easter + 60
    expect(by.get('2026-11-01')).toBe('Allerheiligen')
    expect(by.get('2026-10-31')).toBeUndefined() // no Reformation Day
  })

  it('Buß- und Bettag (Saxony only) is a Wednesday before Nov 23', () => {
    for (const year of [2025, 2026, 2027]) {
      const sn = holidaysForYear(year, 'SN')
      const date = [...sn.entries()].find(([, name]) => name === 'Buß- und Bettag')?.[0]
      expect(date).toBeDefined()
      expect(parseISO(date).getDay()).toBe(3) // Wednesday
      expect(date < `${year}-11-23`).toBe(true)
      expect(holidaysForYear(year, 'SH').get(date)).toBeUndefined()
    }
  })
})

describe('holidayOn', () => {
  it('returns the name or null', () => {
    expect(holidayOn('2026-05-01', 'SH')).toBe('Tag der Arbeit')
    expect(holidayOn('2026-05-02', 'SH')).toBeNull()
  })
})
