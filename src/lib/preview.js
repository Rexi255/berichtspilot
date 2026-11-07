// Preview of the three output blocks (E-032): the preview must show EXACTLY
// the text that gets copied. This module only cuts that text into lines and
// segments for rendering — kind per line (for quiet coloring) and every
// whitespace character as its own segment (so "Leerzeichen anzeigen" can draw
// "·"/"→" over it with CSS without changing the text). Joining the segments
// and line ends gives back the input, character for character.

// "Mittwoch, den 21.01.2026:" (dayHeader() in format.js)
const DAY_HEADER = /^\S.*, den \d{2}\.\d{2}\.\d{4}:$/

// Whitespace that gets a visible marker
const WHITESPACE = { ' ': 'space', '\t': 'tab', ' ': 'nbsp' }

/** Kind of an output line: header · subject · bullet · blank · text */
export function lineKind(line) {
  if (line === '') return 'blank'
  if (DAY_HEADER.test(line)) return 'header'
  if (line.startsWith('- ')) return 'bullet'
  if (line.length > 1 && line.endsWith(':')) return 'subject'
  return 'text'
}

// Split a line into runs of non-whitespace and single whitespace characters
function segments(line) {
  const out = []
  let run = ''
  for (const ch of line) {
    const ws = WHITESPACE[ch]
    if (!ws) {
      run += ch
      continue
    }
    if (run) out.push({ text: run, ws: null })
    run = ''
    out.push({ text: ch, ws })
  }
  if (run) out.push({ text: run, ws: null })
  return out
}

/**
 * Lines of `text` for the preview: `{ kind, segments: [{ text, ws }], eol }`.
 * `ws` is 'space' | 'tab' | 'nbsp' | null; `eol` is true when a "\n"
 * follows the line (all but the last). Empty text → [].
 */
export function previewLines(text) {
  if (!text) return []
  const lines = text.split('\n')
  return lines.map((line, i) => ({
    kind: lineKind(line),
    segments: segments(line),
    eol: i < lines.length - 1,
  }))
}

/** The text previewLines() was made from — for the round-trip test */
export function joinLines(lines) {
  return lines.map((l) => l.segments.map((s) => s.text).join('') + (l.eol ? '\n' : '')).join('')
}

/** Number of lines as pasted (0 for an empty block) */
export function lineCount(text) {
  return text ? text.split('\n').length : 0
}
