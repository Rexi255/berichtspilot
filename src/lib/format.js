// Builds the three output blocks — the format is mandatory and must match the
// real IHK reports exactly (spec: docs/OUTPUT_FORMAT.md). Output text is German.
import { formatDE, weekdayName } from './dates.js'

/** "Mittwoch, den 21.01.2026:" */
export function dayHeader(iso) {
  return `${weekdayName(iso)}, den ${formatDE(iso)}:`
}

// Status line for non-normal days (replaces all bullets)
function statusLine(day) {
  if (day.status === 'holiday') return `- Feiertag: ${day.holidayName || 'Feiertag'}`
  if (day.status === 'sick') return '- Krankheitstag'
  if (day.status === 'vacation') return '- Urlaub'
  return null
}

const notEmpty = (s) => s.trim().length > 0

/**
 * Block 1 — Betriebliche Tätigkeiten (work).
 * Per work day: header + "- " bullets, ONE blank line between days.
 * Holiday/sick/vacation: only the status line instead of the bullets.
 */
export function formatWork(week) {
  const blocks = []
  for (const day of week.days) {
    if (day.type !== 'work') continue
    const status = statusLine(day)
    const lines = status
      ? [status]
      : day.bullets.filter(notEmpty).map((s) => `- ${s.trim()}`)
    blocks.push([dayHeader(day.date), ...lines].join('\n'))
  }
  return blocks.join('\n\n')
}

/** Block 2 — Unterweisungen (instructions): free text, taken as is. */
export function formatInstructions(week) {
  return (week.instructions || '').trim()
}

/**
 * Block 3 — Berufsschule (school).
 * Per school day: header, blank line, then per subject "Label:" + bullets.
 * ONE blank line between subjects, TWO blank lines between days.
 * Holiday/sick/vacation days are compact (header + status line) and are
 * separated by only ONE blank line — as in the real reports.
 */
export function formatSchool(week) {
  const blocks = [] // { text, compact }
  for (const day of week.days) {
    if (day.type !== 'school') continue
    const status = statusLine(day)
    if (status) {
      blocks.push({ text: `${dayHeader(day.date)}\n${status}`, compact: true })
      continue
    }
    const subjects = day.subjects
      .map((s) => ({ label: s.label.trim(), bullets: s.bullets.filter(notEmpty) }))
      .filter((s) => s.label && s.bullets.length > 0)
      .map((s) => [`${s.label}:`, ...s.bullets.map((b) => `- ${b.trim()}`)].join('\n'))
    const content = subjects.join('\n\n')
    blocks.push({
      text: content ? `${dayHeader(day.date)}\n\n${content}` : dayHeader(day.date),
      compact: !content,
    })
  }

  // Separator rule: two blank lines between full school days, one if a
  // compact status day is involved.
  let out = ''
  blocks.forEach((b, i) => {
    if (i > 0) {
      const previous = blocks[i - 1]
      out += previous.compact || b.compact ? '\n\n' : '\n\n\n'
    }
    out += b.text
  })
  return out
}

/** All three blocks at once (preview + export) */
export function formatAll(week) {
  return {
    work: formatWork(week),
    instructions: formatInstructions(week),
    school: formatSchool(week),
  }
}
