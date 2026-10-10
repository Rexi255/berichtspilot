// AI phrasing via the "clipboard bridge" (DECISIONS E-011): the app builds a
// prompt from the raw notes, the user pastes it into any chat AI and copies the
// answer back; this module parses that answer into bullets per day.
// Pure and offline — nothing here talks to the network. The prompt text is
// German because it is content for the user and the AI, not code.
import { weekdayName, formatDE } from './dates.js'
import { BULLET_PREFIX } from './notes.js'

// Fallback style examples (from the real reports in docs/OUTPUT_FORMAT.md)
const DEFAULT_EXAMPLES = [
  'Fehlerdiagnose bei DHCP-Zuweisungsproblemen und Behebung von lokalen Netzwerkstörungen an mobilen Endgeräten',
  'Verwaltung von WLAN-Zugangsdaten für Gäste sowie Bearbeitung von Support-Tickets im Bereich Telefonie',
  'Aufbau und Inbetriebnahme eines neuen Mitarbeiter-Arbeitsplatzes inklusive Monitor-Setup und abschließendem Funktionstest der gesamten Peripherie',
  'Durchführung von Patch-Arbeiten an der Netzwerkdose sowie Konfiguration der zugehörigen Switch-Ports',
]

/** Days the AI should phrase: normal work days that have raw notes. */
export function phrasingCandidates(week) {
  return (week?.days ?? []).filter(
    (d) => d.type === 'work' && d.status === 'normal' && (d.notes ?? '').trim()
  )
}

/**
 * Style examples from the user's own finished weeks (newest first, unique,
 * reasonable length) so the AI matches their wording; falls back to the
 * examples from the real reports.
 */
export function styleExamples(weeks, limit = 12) {
  const seen = new Set()
  const examples = []
  const done = [...(weeks ?? [])].filter((w) => w.status === 'done').sort((a, b) => (a.id < b.id ? 1 : -1))
  for (const week of done) {
    for (const day of week.days ?? []) {
      if (day.type !== 'work' || day.status !== 'normal') continue
      for (const raw of day.bullets ?? []) {
        const bullet = raw.trim()
        if (bullet.length < 15 || bullet.length > 220 || seen.has(bullet)) continue
        seen.add(bullet)
        examples.push(bullet)
        if (examples.length >= limit) return examples
      }
    }
  }
  return examples.length > 0 ? examples : DEFAULT_EXAMPLES
}

/**
 * The complete prompt for the chat AI, or null if the week has no notes to
 * phrase. Day markers carry the ISO date so the answer can be mapped back
 * reliably, whatever the AI writes around it.
 */
export function buildPrompt(week, weeks) {
  const days = phrasingCandidates(week)
  if (days.length === 0) return null
  const examples = styleExamples(weeks)
  const notes = days
    .map((d) => `### ${d.date} (${weekdayName(d.date)}, ${formatDE(d.date)})\n${d.notes.trim()}`)
    .join('\n\n')
  const format = days.map((d) => `### ${d.date}\n- …\n- …`).join('\n\n')

  return [
    'Du hilfst einem Auszubildenden (Fachinformatiker für Systemintegration) beim Ausbildungsnachweis für das IHK-Berichtsheft.',
    'Formuliere aus den Rohnotizen je Tag Stichpunkte für den Abschnitt „Betriebliche Tätigkeiten".',
    '',
    'Regeln:',
    '- Nominalstil, sachlich, korrekte Fachbegriffe (z. B. „Konfiguration der Switch-Ports").',
    '- Ein Stichpunkt = eine Tätigkeit, höchstens zwei Zeilen. Kein „ich", keine Uhrzeiten.',
    '- Keine Kunden- oder Personennamen, IP-Adressen, Ticketnummern oder Passwörter — neutral umschreiben (z. B. „bei einem Kunden").',
    '- Nichts erfinden: nur formulieren, was in den Notizen steht. Zusammengehöriges darf zusammengefasst werden.',
    '- Meist 2–4 Stichpunkte pro Tag.',
    '',
    'Stilbeispiele aus früheren Berichten:',
    ...examples.map((e) => `- ${e}`),
    '',
    'Antworte AUSSCHLIESSLICH in diesem Format — ohne Einleitung, ohne Schlusssatz, die Datumszeilen unverändert:',
    '',
    format,
    '',
    'Rohnotizen:',
    '',
    notes,
  ].join('\n')
}

const ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/
const DE_DATE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/
const pad2 = (n) => String(n).padStart(2, '0')

// ISO date from a marker line ("### 2026-09-29", "Dienstag, den 29.09.2026:" …)
function dateInLine(line) {
  const iso = line.match(ISO_DATE)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const de = line.match(DE_DATE)
  if (de) return `${de[3]}-${pad2(de[2])}-${pad2(de[1])}`
  return null
}

/**
 * Parse the AI's answer. Tolerant on purpose: accepts markdown headings or
 * plain date lines (when copied from the rendered chat), code fences and the
 * usual bullet characters. Text outside a day or without a bullet is ignored
 * and only counted, so chatty intros/outros never end up in the report.
 * Returns { days: { 'YYYY-MM-DD': [bullets] }, ignoredLines }.
 */
export function parseResponse(text) {
  const days = {}
  let current = null
  let ignoredLines = 0
  for (const raw of (text ?? '').split(/\r?\n/)) {
    // bold markers (**…**) are formatting only — and "**" would look like a bullet
    const line = raw.replace(/\*\*/g, '').trim()
    if (!line || line.startsWith('```')) continue
    const isBullet = BULLET_PREFIX.test(line) && !/^\d+\.\d/.test(line)
    const date = isBullet ? null : dateInLine(line)
    if (date) {
      current = date
      days[current] ??= []
      continue
    }
    const bullet = line.replace(BULLET_PREFIX, '').trim()
    if (current && isBullet && bullet && bullet !== '…') days[current].push(bullet)
    else ignoredLines++
  }
  return { days, ignoredLines }
}

// Patterns that should not leave the machine unnoticed (warning only)
const SENSITIVE_PATTERNS = [
  ['email', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ['ip', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ['mac', /\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b/gi],
  ['ticket', /(?:#\d{3,}|\b(?:INC|REQ|RITM|TKT|SR|CHG)[-_ ]?\d{3,}|\bTicket(?:nummer|[- ]?Nr\.?)?\s*:?\s*#?\d{3,})/gi],
  ['phone', /(?:\+49|\b0)\d[\d /-]{6,}\d/g],
]

/**
 * Find things that look like customer data in text that is about to leave the
 * app (e-mail, IP, MAC, ticket and phone numbers). Returns [{ kind, match }],
 * unique per match. A hint for the user, not a filter.
 */
export function findSensitive(text) {
  const found = []
  const seen = new Set()
  for (const [kind, pattern] of SENSITIVE_PATTERNS) {
    for (const m of (text ?? '').matchAll(pattern)) {
      const match = m[0].trim()
      if (seen.has(match)) continue
      seen.add(match)
      found.push({ kind, match })
    }
  }
  return found
}
