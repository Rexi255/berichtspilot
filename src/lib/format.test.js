// Absicherung des EXAKTEN Ausgabeformats (Abnahmekriterium): die Beispiele
// stammen 1:1 aus der Spezifikation (CLAUDE.md) bzw. echten IHK-Berichten.
import { describe, it, expect } from 'vitest'
import { formatBetrieb, formatBerufsschule, formatUnterweisungen, tagesHeader } from './format.js'

const betriebsTag = (datum, stichpunkte, status = 'normal', feiertagName = null) => ({
  datum,
  typ: 'betrieb',
  status,
  feiertagName,
  stichpunkte,
  faecher: [],
})

const schulTag = (datum, faecher, status = 'normal', feiertagName = null) => ({
  datum,
  typ: 'schule',
  status,
  feiertagName,
  stichpunkte: [],
  faecher,
})

describe('tagesHeader', () => {
  it('erzeugt "<Wochentag>, den TT.MM.JJJJ:"', () => {
    expect(tagesHeader('2026-01-21')).toBe('Mittwoch, den 21.01.2026:')
    expect(tagesHeader('2026-05-01')).toBe('Freitag, den 01.05.2026:')
  })
})

describe('formatBetrieb (Block 1)', () => {
  it('entspricht exakt dem Beispiel aus der Spezifikation', () => {
    const woche = {
      tage: [
        betriebsTag('2026-01-20', [
          'Fehlerdiagnose bei DHCP-Zuweisungsproblemen und Behebung von lokalen Netzwerkstörungen an mobilen Endgeräten.',
          'Verwaltung von WLAN-Zugangsdaten für Gäste sowie Bearbeitung von Support-Tickets im Bereich Telefonie',
        ]),
        betriebsTag('2026-01-21', [
          'Aufbau und Inbetriebnahme eines neuen Mitarbeiter-Arbeitsplatzes inklusive Monitor-Setup und abschließendem Funktionstest der gesamten Peripherie',
          'Durchführung von Patch-Arbeiten an der Netzwerkdose sowie Konfiguration der zugehörigen Switch-Ports',
        ]),
      ],
    }
    expect(formatBetrieb(woche)).toBe(
      'Dienstag, den 20.01.2026:\n' +
        '- Fehlerdiagnose bei DHCP-Zuweisungsproblemen und Behebung von lokalen Netzwerkstörungen an mobilen Endgeräten.\n' +
        '- Verwaltung von WLAN-Zugangsdaten für Gäste sowie Bearbeitung von Support-Tickets im Bereich Telefonie\n' +
        '\n' +
        'Mittwoch, den 21.01.2026:\n' +
        '- Aufbau und Inbetriebnahme eines neuen Mitarbeiter-Arbeitsplatzes inklusive Monitor-Setup und abschließendem Funktionstest der gesamten Peripherie\n' +
        '- Durchführung von Patch-Arbeiten an der Netzwerkdose sowie Konfiguration der zugehörigen Switch-Ports'
    )
  })

  it('ersetzt Stichpunkte bei Feiertag/Krank/Urlaub durch die Statuszeile', () => {
    const woche = {
      tage: [
        betriebsTag('2026-05-01', ['wird ignoriert'], 'feiertag', 'Tag der Arbeit'),
        betriebsTag('2026-05-04', [''], 'krank'),
        betriebsTag('2026-05-05', [''], 'urlaub'),
      ],
    }
    expect(formatBetrieb(woche)).toBe(
      'Freitag, den 01.05.2026:\n- Feiertag: Tag der Arbeit\n' +
        '\n' +
        'Montag, den 04.05.2026:\n- Krankheitstag\n' +
        '\n' +
        'Dienstag, den 05.05.2026:\n- Urlaub'
    )
  })

  it('filtert leere Stichpunkte und trimmt Whitespace', () => {
    const woche = { tage: [betriebsTag('2026-01-20', ['  Ticket bearbeitet  ', '', '   '])] }
    expect(formatBetrieb(woche)).toBe('Dienstag, den 20.01.2026:\n- Ticket bearbeitet')
  })

  it('ignoriert Schultage', () => {
    const woche = { tage: [schulTag('2026-01-19', [{ label: 'LF02', punkte: ['x'] }])] }
    expect(formatBetrieb(woche)).toBe('')
  })
})

describe('formatBerufsschule (Block 3)', () => {
  it('entspricht exakt dem Beispiel aus der Spezifikation (2 Leerzeilen zwischen Tagen)', () => {
    const woche = {
      tage: [
        schulTag('2026-04-20', [
          { label: 'LF02', punkte: ['Wirtschaftssektoren', 'Tarifverträge', 'Betriebsrat'] },
          { label: 'LF03', punkte: ['Server und Clients: Arbeiten mit Cisco PacketTracer'] },
          { label: 'Englisch', punkte: ['Installing GUI components, explaining smartphone functions'] },
          { label: 'WiPo', punkte: ['Nutzwertanalyse', 'Übungsaufgabe'] },
        ]),
        schulTag('2026-04-21', [
          { label: 'LF04', punkte: ['Klassenarbeit LF4'] },
          { label: 'LF05', punkte: ['Weiterarbeit an Projekt (automatisierte Datenextraktion)'] },
        ]),
      ],
    }
    expect(formatBerufsschule(woche)).toBe(
      'Montag, den 20.04.2026:\n' +
        '\n' +
        'LF02:\n- Wirtschaftssektoren\n- Tarifverträge\n- Betriebsrat\n' +
        '\n' +
        'LF03:\n- Server und Clients: Arbeiten mit Cisco PacketTracer\n' +
        '\n' +
        'Englisch:\n- Installing GUI components, explaining smartphone functions\n' +
        '\n' +
        'WiPo:\n- Nutzwertanalyse\n- Übungsaufgabe\n' +
        '\n' +
        '\n' +
        'Dienstag, den 21.04.2026:\n' +
        '\n' +
        'LF04:\n- Klassenarbeit LF4\n' +
        '\n' +
        'LF05:\n- Weiterarbeit an Projekt (automatisierte Datenextraktion)'
    )
  })

  it('lässt Fächer ohne Stichpunkte weg', () => {
    const woche = {
      tage: [
        schulTag('2026-04-20', [
          { label: 'LF02', punkte: ['Inhalt'] },
          { label: 'Leer', punkte: ['', '  '] },
        ]),
      ],
    }
    expect(formatBerufsschule(woche)).toBe('Montag, den 20.04.2026:\n\nLF02:\n- Inhalt')
  })

  it('trennt kompakte Statustage nur mit EINER Leerzeile', () => {
    const woche = {
      tage: [
        schulTag('2026-04-20', [{ label: 'LF02', punkte: ['Inhalt'] }]),
        schulTag('2026-04-21', [], 'krank'),
      ],
    }
    expect(formatBerufsschule(woche)).toBe(
      'Montag, den 20.04.2026:\n\nLF02:\n- Inhalt\n' +
        '\n' +
        'Dienstag, den 21.04.2026:\n- Krankheitstag'
    )
  })
})

describe('formatUnterweisungen (Block 2)', () => {
  it('übernimmt freien Text getrimmt, leer bleibt leer', () => {
    expect(formatUnterweisungen({ unterweisungen: '  Brandschutzunterweisung  ' })).toBe(
      'Brandschutzunterweisung'
    )
    expect(formatUnterweisungen({ unterweisungen: '' })).toBe('')
    expect(formatUnterweisungen({})).toBe('')
  })
})
