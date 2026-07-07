// Gesetzliche Feiertage je Bundesland — komplett offline berechnet.
// Bewegliche Feiertage leiten sich vom Ostersonntag ab (Gaußsche Osterformel).
import { toISO, addDays } from './dates.js'

export const BUNDESLAENDER = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
]

const ALLE = BUNDESLAENDER.map((b) => b.code)

/**
 * Gaußsche Osterformel (erweiterte Fassung nach Lichtenberg) —
 * liefert den Ostersonntag des Jahres als Date.
 */
export function ostersonntag(jahr) {
  const k = Math.floor(jahr / 100)
  const m = 15 + Math.floor((3 * k + 3) / 4) - Math.floor((8 * k + 13) / 25)
  const s = 2 - Math.floor((3 * k + 3) / 4)
  const a = jahr % 19
  const d = (19 * a + m) % 30
  const r = Math.floor((d + Math.floor(a / 11)) / 29)
  const og = 21 + d - r // Ostergrenze
  const sz = 7 - ((jahr + Math.floor(jahr / 4) + s) % 7) // erster Sonntag im März
  const oe = 7 - ((og - sz) % 7) // Osterentfernung
  const os = og + oe // Ostersonntag als "Märzdatum" (32. März = 1. April)
  return new Date(jahr, 2, os)
}

// Mittwoch vor dem 23. November (Buß- und Bettag, nur Sachsen)
function bussUndBettag(jahr) {
  const d = new Date(jahr, 10, 22)
  while (d.getDay() !== 3) d.setDate(d.getDate() - 1)
  return toISO(d)
}

/**
 * Alle gesetzlichen Feiertage eines Jahres für ein Bundesland.
 * Rückgabe: Map "YYYY-MM-DD" -> Feiertagsname.
 */
export function feiertageFuerJahr(jahr, bundesland = 'SH') {
  const ostern = toISO(ostersonntag(jahr))
  const fix = (monat, tag) => `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`

  // [Datum, Name, Bundesländer]
  const eintraege = [
    [fix(1, 1), 'Neujahr', ALLE],
    [fix(1, 6), 'Heilige Drei Könige', ['BW', 'BY', 'ST']],
    [fix(3, 8), 'Internationaler Frauentag', ['BE', 'MV']],
    [addDays(ostern, -2), 'Karfreitag', ALLE],
    [ostern, 'Ostersonntag', ['BB']],
    [addDays(ostern, 1), 'Ostermontag', ALLE],
    [fix(5, 1), 'Tag der Arbeit', ALLE],
    [addDays(ostern, 39), 'Christi Himmelfahrt', ALLE],
    [addDays(ostern, 49), 'Pfingstsonntag', ['BB']],
    [addDays(ostern, 50), 'Pfingstmontag', ALLE],
    [addDays(ostern, 60), 'Fronleichnam', ['BW', 'BY', 'HE', 'NW', 'RP', 'SL']],
    [fix(8, 15), 'Mariä Himmelfahrt', ['SL']],
    [fix(9, 20), 'Weltkindertag', ['TH']],
    [fix(10, 3), 'Tag der Deutschen Einheit', ALLE],
    [fix(10, 31), 'Reformationstag', ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH']],
    [fix(11, 1), 'Allerheiligen', ['BW', 'BY', 'NW', 'RP', 'SL']],
    [bussUndBettag(jahr), 'Buß- und Bettag', ['SN']],
    [fix(12, 25), '1. Weihnachtstag', ALLE],
    [fix(12, 26), '2. Weihnachtstag', ALLE],
  ]

  const map = new Map()
  for (const [datum, name, laender] of eintraege) {
    if (laender.includes(bundesland)) map.set(datum, name)
  }
  return map
}

/** Feiertagsname für ein konkretes Datum, sonst null */
export function feiertagAm(iso, bundesland = 'SH') {
  const jahr = Number(iso.slice(0, 4))
  return feiertageFuerJahr(jahr, bundesland).get(iso) ?? null
}
