// Clipboard bridge: prompt building, tolerant answer parsing and the
// customer-data warning.
import { describe, it, expect } from 'vitest'
import { phrasingCandidates, styleExamples, buildPrompt, parseResponse, parseDayResponse, findSensitive, promptSensitive } from './phrasing.js'

const day = (date, patch = {}) => ({
  date,
  type: 'work',
  status: 'normal',
  holidayName: null,
  notes: '',
  bullets: [''],
  subjects: [],
  ...patch,
})

const week = {
  id: '2026-09-28',
  status: 'draft',
  instructions: '',
  days: [
    day('2026-09-28', { type: 'school', notes: 'Schule, wird ignoriert' }),
    day('2026-09-29', { status: 'sick', notes: 'krank, wird ignoriert' }),
    day('2026-09-30', { notes: 'Drucker getauscht. Switch-Ports konfiguriert.' }),
    day('2026-10-01', { notes: '' }),
    day('2026-10-02', { notes: 'neuen Arbeitsplatz aufgebaut, Monitore angeschlossen' }),
  ],
}

describe('phrasingCandidates', () => {
  it('takes only normal work days with notes', () => {
    expect(phrasingCandidates(week).map((d) => d.date)).toEqual(['2026-09-30', '2026-10-02'])
  })
})

describe('styleExamples', () => {
  it('uses bullets from finished weeks, newest first, unique', () => {
    const weeks = [
      { id: '2026-09-14', status: 'done', days: [day('2026-09-14', { bullets: ['Älterer Stichpunkt zur Patchung'] })] },
      { id: '2026-09-21', status: 'done', days: [day('2026-09-21', { bullets: ['Neuerer Stichpunkt zur Druckerwartung', 'kurz'] })] },
      { id: '2026-09-28', status: 'draft', days: [day('2026-09-28', { bullets: ['Entwurf zählt nicht als Beispiel'] })] },
    ]
    expect(styleExamples(weeks)).toEqual(['Neuerer Stichpunkt zur Druckerwartung', 'Älterer Stichpunkt zur Patchung'])
  })

  it('falls back to the examples from the real reports', () => {
    expect(styleExamples([])[0]).toMatch(/DHCP/)
  })
})

describe('buildPrompt', () => {
  it('contains rules, examples, the answer format and only the candidate notes', () => {
    const prompt = buildPrompt(week, [])
    expect(prompt).toContain('Betriebliche Tätigkeiten')
    expect(prompt).toContain('Nichts erfinden')
    expect(prompt).toContain('- Fehlerdiagnose bei DHCP')
    expect(prompt).toContain('### 2026-09-30 (Mittwoch, 30.09.2026)\nDrucker getauscht. Switch-Ports konfiguriert.')
    expect(prompt).toContain('### 2026-10-02 (Freitag, 02.10.2026)')
    expect(prompt).not.toContain('wird ignoriert')
  })

  it('returns null when there is nothing to phrase', () => {
    expect(buildPrompt({ days: [day('2026-09-30')] }, [])).toBeNull()
  })
})

describe('parseResponse', () => {
  it('parses the requested format', () => {
    const answer = '### 2026-09-30\n- Austausch eines defekten Druckers\n- Konfiguration der Switch-Ports\n\n### 2026-10-02\n- Aufbau eines Arbeitsplatzes'
    expect(parseResponse(answer)).toEqual({
      days: {
        '2026-09-30': ['Austausch eines defekten Druckers', 'Konfiguration der Switch-Ports'],
        '2026-10-02': ['Aufbau eines Arbeitsplatzes'],
      },
      ignoredLines: 0,
    })
  })

  it('tolerates rendered copies, bold dates, German dates, code fences and chatter', () => {
    const answer = [
      'Gerne! Hier sind die Stichpunkte:',
      '```',
      '**Mittwoch, den 30.09.2026:**',
      '• Austausch eines defekten Druckers',
      '* Konfiguration der Switch-Ports',
      '2026-10-02',
      '1. Aufbau eines Arbeitsplatzes',
      '```',
      'Viel Erfolg!',
    ].join('\n')
    const { days, ignoredLines } = parseResponse(answer)
    expect(days).toEqual({
      '2026-09-30': ['Austausch eines defekten Druckers', 'Konfiguration der Switch-Ports'],
      '2026-10-02': ['Aufbau eines Arbeitsplatzes'],
    })
    expect(ignoredLines).toBe(2)
  })

  it('ignores the "…" placeholders from the format template', () => {
    expect(parseResponse('### 2026-09-30\n- …\n- …').days).toEqual({ '2026-09-30': [] })
  })

  it('handles empty input', () => {
    expect(parseResponse('')).toEqual({ days: {}, ignoredLines: 0 })
  })
})

describe('findSensitive', () => {
  it('finds e-mail, IP, MAC, ticket and phone numbers', () => {
    const kinds = findSensitive(
      'Mail an max.muster@kunde.de, Server 192.168.10.5, MAC 00:1A:2B:3C:4D:5E, Ticket #48213, INC-10234, Tel. 0481 123456'
    ).map((f) => `${f.kind}:${f.match}`)
    expect(kinds).toEqual([
      'email:max.muster@kunde.de',
      'ip:192.168.10.5',
      'mac:00:1A:2B:3C:4D:5E',
      'ticket:Ticket #48213',
      'ticket:INC-10234',
      'phone:0481 123456',
    ])
  })

  it('does not flag dates or ordinary text', () => {
    expect(findSensitive('### 2026-09-30 (Mittwoch, 30.09.2026)\nDrucker getauscht, ca. 3 Tickets bearbeitet')).toEqual([])
  })
})

describe('findSensitive: the word "Kunde"', () => {
  const kinds = (text) => findSensitive(text).map((f) => `${f.kind}:${f.match}`)

  it('flags the word, compounds ending in it and customer numbers', () => {
    expect(kinds('Rückruf beim Kunden, Endkunde und Stammkundin informiert, Kundennummer 4711')).toEqual([
      'customer:Kunden',
      'customer:Endkunde',
      'customer:Stammkundin',
      'customer:Kundennummer',
    ])
    expect(kinds('kunde hat angerufen')).toEqual(['customer:kunde'])
  })

  it('stays quiet for "Kundenwunsch" (LF02) and "Kundendienst"', () => {
    expect(findSensitive('Arbeitsplätze nach Kundenwunsch ausstatten, Kundendienst erklärt')).toEqual([])
  })

  it('stays quiet for words that only contain the letters (Urkunde, Sekunden, erkunden)', () => {
    expect(findSensitive('Ausbildungsurkunde abgeholt, Urkunden beurkunden lassen')).toEqual([])
    expect(findSensitive('Timeout nach 30 Sekunden, Netzwerk erkunden, Interesse bekunden')).toEqual([])
    // compounds that name a real customer stay flagged
    expect(kinds('Partnerkunde und Neukunde angerufen')).toEqual(['customer:Partnerkunde', 'customer:Neukunde'])
  })

  it('does not report the "kunde" inside an e-mail address twice', () => {
    expect(kinds('Mail an max.muster@kunde.de')).toEqual(['email:max.muster@kunde.de'])
  })
})

describe('per-day prompt and its privacy check', () => {
  it('builds the prompt for the given dates only', () => {
    const prompt = buildPrompt(week, [], { dates: ['2026-10-02'] })
    expect(prompt).toContain('### 2026-10-02')
    expect(prompt).not.toContain('### 2026-09-30')
    expect(buildPrompt(week, [], { dates: ['2026-10-01'] })).toBeNull() // no notes that day
  })

  it('checks only the user text, never the prompt rules (which mention "Kunden")', () => {
    expect(buildPrompt(week, [])).toMatch(/Kunden/)
    expect(findSensitive(buildPrompt(week, [])).some((f) => f.kind === 'customer')).toBe(true)
    expect(promptSensitive(week, [])).toEqual([])
  })

  it('flags customer data in the notes and in the style examples', () => {
    const noisy = {
      ...week,
      days: week.days.map((d) => (d.date === '2026-09-30' ? { ...d, notes: 'Beim Kunden Drucker getauscht' } : d)),
    }
    expect(promptSensitive(noisy, [], { dates: ['2026-09-30'] })).toEqual([{ kind: 'customer', match: 'Kunden' }])
    expect(promptSensitive(noisy, [], { dates: ['2026-10-02'] })).toEqual([])
    const doneWeek = {
      id: '2026-09-14', status: 'done',
      days: [day('2026-09-14', { bullets: ['Einrichtung eines Notebooks für Kunde 192.168.1.20'] })],
    }
    expect(promptSensitive(week, [doneWeek]).map((f) => f.kind)).toEqual(['ip', 'customer'])
  })
})

describe('parseDayResponse (one day from the notes area)', () => {
  it('takes the section of that date when the AI kept the date line', () => {
    const answer = 'Gern, hier die Stichpunkte:\n\n### 2026-10-02\n- Aufbau eines Arbeitsplatzes\n- Anschluss zweier Monitore\n\nViel Erfolg!'
    expect(parseDayResponse(answer, '2026-10-02')).toEqual(['Aufbau eines Arbeitsplatzes', 'Anschluss zweier Monitore'])
  })

  it('takes every bullet line when the answer has no date line at all', () => {
    expect(parseDayResponse('- **Aufbau** eines Arbeitsplatzes\n• Anschluss zweier Monitore\nDas war es.', '2026-10-02')).toEqual([
      'Aufbau eines Arbeitsplatzes',
      'Anschluss zweier Monitore',
    ])
  })

  it('gives nothing for an answer about other days or without bullets', () => {
    expect(parseDayResponse('### 2026-09-30\n- Drucker getauscht', '2026-10-02')).toEqual([])
    expect(parseDayResponse('Ich habe leider keine Notizen gefunden.', '2026-10-02')).toEqual([])
    expect(parseDayResponse('', '2026-10-02')).toEqual([])
  })
})
