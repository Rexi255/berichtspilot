// Raw notes -> bullets without AI: split typed, pasted or dictated text into
// one bullet per line/sentence. Pure and offline; also the fallback whenever
// no AI phrasing is used.

// Bullet characters / numbering at the start of a line ("- ", "• ", "1. ", "2) ")
export const BULLET_PREFIX = /^\s*(?:[-–—•*·]|\d+[.)])\s*/

// Common German abbreviations whose dots must not end a sentence
const ABBREVIATIONS = [
  'z. B.', 'z.B.', 'u. a.', 'u.a.', 'd. h.', 'd.h.', 'o. Ä.', 'i. d. R.',
  'ca.', 'Nr.', 'bzw.', 'ggf.', 'inkl.', 'evtl.', 'usw.', 'etc.', 'vgl.', 'bspw.',
  'zzgl.', 'max.', 'min.', 'Std.', 'Min.', 'sog.', 'Hr.', 'Fr.', 'Dr.',
]
const MASK = '\u0000'
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Only whole abbreviations: "min." must not match the end of "Admin."
const ABBREVIATION_PATTERNS = ABBREVIATIONS.map((a) => ({
  regex: new RegExp(`(?<!\\p{L})${escapeRegExp(a)}`, 'gu'),
  masked: a.replaceAll('.', MASK),
}))

// Sentence end: . ! ? (a dot right after a digit doesn't count — "am 3. Oktober")
const SENTENCE_END = /(?<=(?<!\d)[.!?])\s+/

const ABBREVIATION_AT_END = new RegExp(
  `(?<!\\p{L})(?:${ABBREVIATIONS.map(escapeRegExp).join('|')})$`,
  'u'
)
const endsWithAbbreviation = (s) => ABBREVIATION_AT_END.test(s)

/**
 * Split notes into bullets: one per line, run-on lines additionally per
 * sentence. Bullet characters/numbering are stripped, a single trailing dot is
 * removed (bullets in the reports usually have none), empty items are dropped.
 * The wording itself stays untouched.
 */
export function splitNotes(text) {
  const bullets = []
  for (const rawLine of (text ?? '').split(/\r?\n/)) {
    let line = rawLine.replace(BULLET_PREFIX, '').trim()
    if (!line) continue
    for (const { regex, masked } of ABBREVIATION_PATTERNS) line = line.replace(regex, masked)
    for (const part of line.split(SENTENCE_END)) {
      let bullet = part.replaceAll(MASK, '.').trim()
      if (bullet.endsWith('.') && !bullet.endsWith('..') && !endsWithAbbreviation(bullet)) {
        bullet = bullet.slice(0, -1).trimEnd()
      }
      if (bullet) bullets.push(bullet)
    }
  }
  return bullets
}
