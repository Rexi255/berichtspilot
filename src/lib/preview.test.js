// The preview may color lines and mark whitespace, but its text must stay the
// copied text exactly (E-032).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { previewLines, joinLines, lineKind, lineCount } from './preview.js'
import { formatAll } from './format.js'

const demo = JSON.parse(fs.readFileSync(new URL('../../e2e/fixtures/demo-daten.json', import.meta.url), 'utf8'))

// Block 3 of the spec example in docs/OUTPUT_FORMAT.md (two blank lines between days)
const SCHOOL = [
  'Montag, den 19.01.2026:',
  '',
  'LF03:',
  '- Netzwerkgrundlagen',
  '',
  'Englisch:',
  '- Bewerbungsschreiben',
  '',
  '',
  'Dienstag, den 20.01.2026:',
  '- Feiertag: Neujahr',
].join('\n')

describe('previewLines', () => {
  it('round-trips every block of every demo week exactly', () => {
    let blocks = 0
    for (const week of demo.weeks) {
      for (const text of Object.values(formatAll(week))) {
        expect(joinLines(previewLines(text))).toBe(text)
        blocks++
      }
    }
    expect(blocks).toBeGreaterThan(100)
  })

  it('round-trips odd whitespace: double, trailing, tabs, no-break spaces, blank lines', () => {
    const texts = [
      SCHOOL,
      '- zwei  Leerzeichen und am Ende ',
      '\tTab vorne\n\n\n- Ende mit NBSP',
      '\n',
      ' ',
      'ä ö ü ß 😀 Ende',
    ]
    for (const text of texts) expect(joinLines(previewLines(text))).toBe(text)
  })

  it('marks every whitespace character as its own segment', () => {
    const [line] = previewLines('- a  b\t ')
    expect(line.segments).toEqual([
      { text: '-', ws: null },
      { text: ' ', ws: 'space' },
      { text: 'a', ws: null },
      { text: ' ', ws: 'space' },
      { text: ' ', ws: 'space' },
      { text: 'b', ws: null },
      { text: '\t', ws: 'tab' },
      { text: ' ', ws: 'nbsp' },
    ])
  })

  it('marks line ends on all lines but the last', () => {
    expect(previewLines('a\nb\n').map((l) => l.eol)).toEqual([true, true, false])
    expect(previewLines('')).toEqual([])
  })
})

describe('lineKind', () => {
  it('tells headers, subjects, bullets and blank lines apart', () => {
    expect(previewLines(SCHOOL).map((l) => l.kind)).toEqual([
      'header', 'blank', 'subject', 'bullet', 'blank', 'subject', 'bullet', 'blank', 'blank', 'header', 'bullet',
    ])
    expect(lineKind('Freier Text')).toBe('text')
    expect(lineKind(':')).toBe('text')
  })
})

describe('lineCount', () => {
  it('counts lines as pasted, 0 when empty', () => {
    expect(lineCount(SCHOOL)).toBe(11)
    expect(lineCount('eine Zeile')).toBe(1)
    expect(lineCount('')).toBe(0)
  })
})
