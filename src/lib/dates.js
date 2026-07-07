// Datums-Helfer. Alle Daten laufen als ISO-Strings ("YYYY-MM-DD") durch die App
// und werden bewusst als LOKALE Daten geparst (kein UTC-Versatz an Zeitzonengrenzen).

export const WOCHENTAG_NAMEN = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag',
]

// Reihenfolge der konfigurierbaren Wochentage (Mo–Sa)
export const WOCHENTAG_KEYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa']
export const WOCHENTAG_LABELS = {
  mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag',
}

const pad2 = (n) => String(n).padStart(2, '0')

/** Date -> "YYYY-MM-DD" (lokal) */
export function toISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** "YYYY-MM-DD" -> Date (lokal, 00:00) */
export function parseISO(iso) {
  const [j, m, t] = iso.split('-').map(Number)
  return new Date(j, m - 1, t)
}

/** "YYYY-MM-DD" -> "TT.MM.JJJJ" */
export function formatDE(iso) {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

/** ISO-Datum + n Tage */
export function addDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Deutscher Wochentagsname für ein ISO-Datum */
export function wochentagName(iso) {
  return WOCHENTAG_NAMEN[parseISO(iso).getDay()]
}

/** Montag der Woche, in der `date` liegt (als ISO-String) */
export function montagVon(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const tag = d.getDay() // 0 = So
  d.setDate(d.getDate() + (tag === 0 ? -6 : 1 - tag))
  return toISO(d)
}

/**
 * ISO-8601-Kalenderwoche. Der Donnerstag der Woche bestimmt das KW-Jahr:
 * KW 1 ist die Woche, die den ersten Donnerstag des Jahres enthält.
 */
export function kalenderwoche(iso) {
  const d = parseISO(iso)
  const donnerstag = new Date(d)
  donnerstag.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3)
  const jahr = donnerstag.getFullYear()
  const ersterDonnerstag = new Date(jahr, 0, 4)
  ersterDonnerstag.setDate(ersterDonnerstag.getDate() - ((ersterDonnerstag.getDay() + 6) % 7) + 3)
  const kw = 1 + Math.round((donnerstag - ersterDonnerstag) / (7 * 24 * 3600 * 1000))
  return { kw, jahr }
}

/** Montag der KW `kw` im Jahr `jahr` (ISO-8601) */
export function montagAusKW(jahr, kw) {
  // 4. Januar liegt immer in KW 1
  const vierterJanuar = new Date(jahr, 0, 4)
  const montagKW1 = parseISO(montagVon(vierterJanuar))
  montagKW1.setDate(montagKW1.getDate() + (kw - 1) * 7)
  return toISO(montagKW1)
}

/** "20.04. – 26.04.2026" für die Woche ab Montag `montagISO` */
export function wochenBereichLabel(montagISO) {
  const sonntag = addDays(montagISO, 6)
  const [, m1, t1] = montagISO.split('-')
  return `${t1}.${m1}. – ${formatDE(sonntag)}`
}

/** Heutiges Datum als ISO-String */
export function heuteISO() {
  return toISO(new Date())
}

/** Liegt `iso` im Bereich [von, bis] (beide inklusiv, leere Grenzen = offen)? */
export function imBereich(iso, von, bis) {
  if (von && iso < von) return false
  if (bis && iso > bis) return false
  return true
}
