// Feiertagslogik: Osterformel + landesspezifische Feiertage (Abnahmekriterium
// sind die Feiertage in Schleswig-Holstein inkl. der beweglichen).
import { describe, it, expect } from 'vitest'
import { ostersonntag, feiertageFuerJahr, feiertagAm } from './holidays.js'
import { toISO, parseISO } from './dates.js'

describe('ostersonntag (Gauß/Lichtenberg)', () => {
  it('liefert bekannte Ostertermine', () => {
    expect(toISO(ostersonntag(2024))).toBe('2024-03-31')
    expect(toISO(ostersonntag(2025))).toBe('2025-04-20')
    expect(toISO(ostersonntag(2026))).toBe('2026-04-05')
    expect(toISO(ostersonntag(2027))).toBe('2027-03-28')
  })
})

describe('feiertageFuerJahr — Schleswig-Holstein 2026', () => {
  const sh = feiertageFuerJahr(2026, 'SH')

  it('enthält die beweglichen Feiertage', () => {
    expect(sh.get('2026-04-03')).toBe('Karfreitag')
    expect(sh.get('2026-04-06')).toBe('Ostermontag')
    expect(sh.get('2026-05-14')).toBe('Christi Himmelfahrt')
    expect(sh.get('2026-05-25')).toBe('Pfingstmontag')
  })

  it('enthält die festen Feiertage inkl. Reformationstag', () => {
    expect(sh.get('2026-01-01')).toBe('Neujahr')
    expect(sh.get('2026-05-01')).toBe('Tag der Arbeit')
    expect(sh.get('2026-10-03')).toBe('Tag der Deutschen Einheit')
    expect(sh.get('2026-10-31')).toBe('Reformationstag')
    expect(sh.get('2026-12-25')).toBe('1. Weihnachtstag')
    expect(sh.get('2026-12-26')).toBe('2. Weihnachtstag')
  })

  it('enthält KEINE nur-süddeutschen Feiertage', () => {
    expect(sh.get('2026-06-04')).toBeUndefined() // Fronleichnam
    expect(sh.get('2026-11-01')).toBeUndefined() // Allerheiligen
    expect(sh.get('2026-01-06')).toBeUndefined() // Heilige Drei Könige
  })
})

describe('landesspezifische Sonderfälle', () => {
  it('Bayern hat Fronleichnam und Allerheiligen', () => {
    const by = feiertageFuerJahr(2026, 'BY')
    expect(by.get('2026-06-04')).toBe('Fronleichnam') // Ostern + 60
    expect(by.get('2026-11-01')).toBe('Allerheiligen')
    expect(by.get('2026-10-31')).toBeUndefined() // kein Reformationstag
  })

  it('Buß- und Bettag (nur Sachsen) ist ein Mittwoch vor dem 23.11.', () => {
    for (const jahr of [2025, 2026, 2027]) {
      const sn = feiertageFuerJahr(jahr, 'SN')
      const datum = [...sn.entries()].find(([, name]) => name === 'Buß- und Bettag')?.[0]
      expect(datum).toBeDefined()
      expect(parseISO(datum).getDay()).toBe(3) // Mittwoch
      expect(datum < `${jahr}-11-23`).toBe(true)
      expect(feiertageFuerJahr(jahr, 'SH').get(datum)).toBeUndefined()
    }
  })
})

describe('feiertagAm', () => {
  it('liefert den Namen bzw. null', () => {
    expect(feiertagAm('2026-05-01', 'SH')).toBe('Tag der Arbeit')
    expect(feiertagAm('2026-05-02', 'SH')).toBeNull()
  })
})
