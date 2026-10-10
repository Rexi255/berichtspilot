// Notes -> bullets: line and sentence splitting, bullet characters,
// abbreviations and numbers must survive.
import { describe, it, expect } from 'vitest'
import { splitNotes, BULLET_PREFIX } from './notes.js'

describe('splitNotes', () => {
  it('splits lines and strips bullet characters and numbering', () => {
    expect(splitNotes('- Drucker getauscht\n• Switch konfiguriert\n2) Tickets bearbeitet\n3. Doku geschrieben')).toEqual([
      'Drucker getauscht',
      'Switch konfiguriert',
      'Tickets bearbeitet',
      'Doku geschrieben',
    ])
  })

  it('splits run-on dictated text into sentences', () => {
    expect(splitNotes('Drucker getauscht. Danach Switch-Ports konfiguriert! Läuft das? Ja.')).toEqual([
      'Drucker getauscht',
      'Danach Switch-Ports konfiguriert!',
      'Läuft das?',
      'Ja',
    ])
  })

  it('keeps German abbreviations intact', () => {
    expect(
      splitNotes('Peripherie getestet, z. B. Maus und Tastatur. Danach ca. 5 Tickets bearbeitet, u. a. Telefonie.')
    ).toEqual(['Peripherie getestet, z. B. Maus und Tastatur', 'Danach ca. 5 Tickets bearbeitet, u. a. Telefonie'])
  })

  it('only matches whole abbreviations ("Admin." is a sentence end)', () => {
    expect(splitNotes('Rechte vergeben mit dem Admin. Danach Pause.')).toEqual([
      'Rechte vergeben mit dem Admin',
      'Danach Pause',
    ])
  })

  it('does not split after numbers (dates, versions)', () => {
    expect(splitNotes('Am 3. Oktober Server aufgesetzt. Version 1.5 installiert.')).toEqual([
      'Am 3. Oktober Server aufgesetzt',
      'Version 1.5 installiert',
    ])
  })

  it('keeps an abbreviation at the end of a bullet', () => {
    expect(splitNotes('Kabel, Stecker usw.')).toEqual(['Kabel, Stecker usw.'])
  })

  it('returns an empty list for empty input', () => {
    expect(splitNotes('')).toEqual([])
    expect(splitNotes(null)).toEqual([])
    expect(splitNotes(' \n  \r\n ')).toEqual([])
  })
})

describe('BULLET_PREFIX', () => {
  it('matches the usual bullet characters and numbering only at the start', () => {
    for (const line of ['- a', '– a', '• a', '* a', '· a', '1. a', '12) a']) {
      expect(line.replace(BULLET_PREFIX, '')).toBe('a')
    }
    expect('Version 1. a'.replace(BULLET_PREFIX, '')).toBe('Version 1. a')
  })
})
