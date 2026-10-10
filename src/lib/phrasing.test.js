// Clipboard bridge: prompt building, tolerant answer parsing and the
// customer-data warning.
import { describe, it, expect } from 'vitest'
import { phrasingCandidates, styleExamples, buildPrompt, parseResponse, findSensitive } from './phrasing.js'

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
