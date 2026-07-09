// Datumslogik: ISO-Kalenderwoche (Donnerstagsregel), Montagsberechnung und
// Datumsarithmetik über Monats-/Jahresgrenzen.
import { describe, it, expect } from 'vitest'
import {
  toISO,
  parseISO,
  formatDE,
  addDays,
  wochentagName,
  montagVon,
  kalenderwoche,
  montagAusKW,
  wochenBereichLabel,
  imBereich,
} from './dates.js'

describe('toISO / parseISO / formatDE', () => {
  it('sind konsistent zueinander (lokal, ohne UTC-Versatz)', () => {
    expect(toISO(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toISO(parseISO('2026-01-05'))).toBe('2026-01-05')
    expect(formatDE('2026-05-01')).toBe('01.05.2026')
  })
})

describe('addDays', () => {
  it('rechnet über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29') // Schaltjahr
  })
})

describe('wochentagName / montagVon', () => {
  it('liefert deutsche Wochentagsnamen', () => {
    expect(wochentagName('2026-07-08')).toBe('Mittwoch')
    expect(wochentagName('2026-07-06')).toBe('Montag')
  })

  it('findet den Montag der Woche — auch am Sonntag', () => {
    expect(montagVon(new Date(2026, 6, 8))).toBe('2026-07-06') // Mittwoch
    expect(montagVon(new Date(2026, 6, 6))).toBe('2026-07-06') // Montag selbst
    expect(montagVon(new Date(2026, 6, 12))).toBe('2026-07-06') // Sonntag
  })
})

describe('kalenderwoche (ISO 8601)', () => {
  it('behandelt Jahreswechsel korrekt (Donnerstagsregel)', () => {
    // 1.1.2026 ist ein Donnerstag -> KW 1/2026
    expect(kalenderwoche('2026-01-01')).toEqual({ kw: 1, jahr: 2026 })
    // 30.12.2024 (Mo) gehört zur Woche des 1.1.2025 -> KW 1/2025
    expect(kalenderwoche('2024-12-30')).toEqual({ kw: 1, jahr: 2025 })
    // 2026 hat 53 Kalenderwochen (Jahr beginnt an einem Donnerstag)
    expect(kalenderwoche('2026-12-28')).toEqual({ kw: 53, jahr: 2026 })
    // 4. Januar liegt per Definition immer in KW 1
    expect(kalenderwoche('2027-01-04').kw).toBe(1)
  })
})

describe('montagAusKW', () => {
  it('ist die Umkehrung von kalenderwoche', () => {
    for (const [jahr, kw] of [[2026, 1], [2026, 29], [2026, 53], [2025, 33]]) {
      const montag = montagAusKW(jahr, kw)
      expect(parseISO(montag).getDay()).toBe(1) // Montag
      expect(kalenderwoche(montag)).toEqual({ kw, jahr })
    }
  })
})

describe('wochenBereichLabel / imBereich', () => {
  it('formatiert den Wochenbereich Mo–So', () => {
    expect(wochenBereichLabel('2026-04-20')).toBe('20.04. – 26.04.2026')
  })

  it('imBereich: inklusive Grenzen, leere Grenzen offen', () => {
    expect(imBereich('2026-07-08', '2026-07-08', '2026-07-08')).toBe(true)
    expect(imBereich('2026-07-08', '', '')).toBe(true)
    expect(imBereich('2026-07-08', '2026-07-09', '')).toBe(false)
    expect(imBereich('2026-07-08', '', '2026-07-07')).toBe(false)
  })
})
