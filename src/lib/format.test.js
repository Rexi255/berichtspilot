// Guards the EXACT output format (acceptance criterion): the examples come 1:1
// from the spec (docs/OUTPUT_FORMAT.md) and real IHK reports. Never edit the
// expected strings to make a test pass — fix the code instead.
import { describe, it, expect } from 'vitest'
import { formatWork, formatSchool, formatInstructions, dayHeader } from './format.js'

const workDay = (date, bullets, status = 'normal', holidayName = null) => ({
  date,
  type: 'work',
  status,
  holidayName,
  bullets,
  subjects: [],
})

const schoolDay = (date, subjects, status = 'normal', holidayName = null) => ({
  date,
  type: 'school',
  status,
  holidayName,
  bullets: [],
  subjects,
})

describe('dayHeader', () => {
  it('produces "<Wochentag>, den TT.MM.JJJJ:"', () => {
    expect(dayHeader('2026-01-21')).toBe('Mittwoch, den 21.01.2026:')
    expect(dayHeader('2026-05-01')).toBe('Freitag, den 01.05.2026:')
  })
})

describe('formatWork (block 1)', () => {
  it('matches the spec example exactly', () => {
    const week = {
      days: [
        workDay('2026-01-20', [
          'Fehlerdiagnose bei DHCP-Zuweisungsproblemen und Behebung von lokalen Netzwerkstörungen an mobilen Endgeräten.',
          'Verwaltung von WLAN-Zugangsdaten für Gäste sowie Bearbeitung von Support-Tickets im Bereich Telefonie',
        ]),
        workDay('2026-01-21', [
          'Aufbau und Inbetriebnahme eines neuen Mitarbeiter-Arbeitsplatzes inklusive Monitor-Setup und abschließendem Funktionstest der gesamten Peripherie',
          'Durchführung von Patch-Arbeiten an der Netzwerkdose sowie Konfiguration der zugehörigen Switch-Ports',
        ]),
      ],
    }
    expect(formatWork(week)).toBe(
      'Dienstag, den 20.01.2026:\n' +
        '- Fehlerdiagnose bei DHCP-Zuweisungsproblemen und Behebung von lokalen Netzwerkstörungen an mobilen Endgeräten.\n' +
        '- Verwaltung von WLAN-Zugangsdaten für Gäste sowie Bearbeitung von Support-Tickets im Bereich Telefonie\n' +
        '\n' +
        'Mittwoch, den 21.01.2026:\n' +
        '- Aufbau und Inbetriebnahme eines neuen Mitarbeiter-Arbeitsplatzes inklusive Monitor-Setup und abschließendem Funktionstest der gesamten Peripherie\n' +
        '- Durchführung von Patch-Arbeiten an der Netzwerkdose sowie Konfiguration der zugehörigen Switch-Ports'
    )
  })

  it('replaces bullets with the status line for holiday/sick/vacation', () => {
    const week = {
      days: [
        workDay('2026-05-01', ['is ignored'], 'holiday', 'Tag der Arbeit'),
        workDay('2026-05-04', [''], 'sick'),
        workDay('2026-05-05', [''], 'vacation'),
      ],
    }
    expect(formatWork(week)).toBe(
      'Freitag, den 01.05.2026:\n- Feiertag: Tag der Arbeit\n' +
        '\n' +
        'Montag, den 04.05.2026:\n- Krankheitstag\n' +
        '\n' +
        'Dienstag, den 05.05.2026:\n- Urlaub'
    )
  })

  it('drops empty bullets and trims whitespace', () => {
    const week = { days: [workDay('2026-01-20', ['  Ticket bearbeitet  ', '', '   '])] }
    expect(formatWork(week)).toBe('Dienstag, den 20.01.2026:\n- Ticket bearbeitet')
  })

  it('ignores school days', () => {
    const week = { days: [schoolDay('2026-01-19', [{ label: 'LF02', bullets: ['x'] }])] }
    expect(formatWork(week)).toBe('')
  })
})

describe('formatSchool (block 3)', () => {
  it('matches the spec example exactly (2 blank lines between days)', () => {
    const week = {
      days: [
        schoolDay('2026-04-20', [
          { label: 'LF02', bullets: ['Wirtschaftssektoren', 'Tarifverträge', 'Betriebsrat'] },
          { label: 'LF03', bullets: ['Server und Clients: Arbeiten mit Cisco PacketTracer'] },
          { label: 'Englisch', bullets: ['Installing GUI components, explaining smartphone functions'] },
          { label: 'WiPo', bullets: ['Nutzwertanalyse', 'Übungsaufgabe'] },
        ]),
        schoolDay('2026-04-21', [
          { label: 'LF04', bullets: ['Klassenarbeit LF4'] },
          { label: 'LF05', bullets: ['Weiterarbeit an Projekt (automatisierte Datenextraktion)'] },
        ]),
      ],
    }
    expect(formatSchool(week)).toBe(
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

  it('drops subjects without bullets', () => {
    const week = {
      days: [
        schoolDay('2026-04-20', [
          { label: 'LF02', bullets: ['Inhalt'] },
          { label: 'Leer', bullets: ['', '  '] },
        ]),
      ],
    }
    expect(formatSchool(week)).toBe('Montag, den 20.04.2026:\n\nLF02:\n- Inhalt')
  })

  it('separates compact status days with only ONE blank line', () => {
    const week = {
      days: [
        schoolDay('2026-04-20', [{ label: 'LF02', bullets: ['Inhalt'] }]),
        schoolDay('2026-04-21', [], 'sick'),
      ],
    }
    expect(formatSchool(week)).toBe(
      'Montag, den 20.04.2026:\n\nLF02:\n- Inhalt\n' +
        '\n' +
        'Dienstag, den 21.04.2026:\n- Krankheitstag'
    )
  })
})

describe('formatInstructions (block 2)', () => {
  it('takes free text trimmed, empty stays empty', () => {
    expect(formatInstructions({ instructions: '  Brandschutzunterweisung  ' })).toBe(
      'Brandschutzunterweisung'
    )
    expect(formatInstructions({ instructions: '' })).toBe('')
    expect(formatInstructions({})).toBe('')
  })
})

describe('notes (raw text)', () => {
  it('never appear in any output block', () => {
    const week = {
      instructions: '',
      days: [
        { ...workDay('2026-01-20', ['Ticket bearbeitet']), notes: 'GEHEIMER ROHTEXT' },
        { ...schoolDay('2026-01-19', [{ label: 'LF02', bullets: ['Inhalt'] }]), notes: 'GEHEIMER ROHTEXT' },
      ],
    }
    for (const text of [formatWork(week), formatSchool(week), formatInstructions(week)]) {
      expect(text).not.toContain('GEHEIMER ROHTEXT')
    }
  })
})
