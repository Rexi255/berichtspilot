// Public holidays per German federal state — computed fully offline.
// Movable holidays derive from Easter Sunday (Gauss Easter formula).
// Holiday names are German because they appear in the IHK output.
import { toISO, addDays } from './dates.js'

export const STATES = [
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

const ALL = STATES.map((s) => s.code)

/**
 * Gauss Easter formula (extended version by Lichtenberg) —
 * returns Easter Sunday of the year as a Date.
 */
export function easterSunday(year) {
  const k = Math.floor(year / 100)
  const m = 15 + Math.floor((3 * k + 3) / 4) - Math.floor((8 * k + 13) / 25)
  const s = 2 - Math.floor((3 * k + 3) / 4)
  const a = year % 19
  const d = (19 * a + m) % 30
  const r = Math.floor((d + Math.floor(a / 11)) / 29)
  const og = 21 + d - r // paschal full moon
  const sz = 7 - ((year + Math.floor(year / 4) + s) % 7) // first Sunday in March
  const oe = 7 - ((og - sz) % 7) // distance to Easter
  const os = og + oe // Easter Sunday as a "March date" (March 32 = April 1)
  return new Date(year, 2, os)
}

// Wednesday before November 23 (Buß- und Bettag, Saxony only)
function repentanceDay(year) {
  const d = new Date(year, 10, 22)
  while (d.getDay() !== 3) d.setDate(d.getDate() - 1)
  return toISO(d)
}

/**
 * All public holidays of a year for one federal state.
 * Returns a Map "YYYY-MM-DD" -> holiday name.
 */
export function holidaysForYear(year, state = 'SH') {
  const easter = toISO(easterSunday(year))
  const fixed = (month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // [date, name, states]
  const entries = [
    [fixed(1, 1), 'Neujahr', ALL],
    [fixed(1, 6), 'Heilige Drei Könige', ['BW', 'BY', 'ST']],
    [fixed(3, 8), 'Internationaler Frauentag', ['BE', 'MV']],
    [addDays(easter, -2), 'Karfreitag', ALL],
    [easter, 'Ostersonntag', ['BB']],
    [addDays(easter, 1), 'Ostermontag', ALL],
    [fixed(5, 1), 'Tag der Arbeit', ALL],
    [addDays(easter, 39), 'Christi Himmelfahrt', ALL],
    [addDays(easter, 49), 'Pfingstsonntag', ['BB']],
    [addDays(easter, 50), 'Pfingstmontag', ALL],
    [addDays(easter, 60), 'Fronleichnam', ['BW', 'BY', 'HE', 'NW', 'RP', 'SL']],
    [fixed(8, 15), 'Mariä Himmelfahrt', ['SL']],
    [fixed(9, 20), 'Weltkindertag', ['TH']],
    [fixed(10, 3), 'Tag der Deutschen Einheit', ALL],
    [fixed(10, 31), 'Reformationstag', ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH']],
    [fixed(11, 1), 'Allerheiligen', ['BW', 'BY', 'NW', 'RP', 'SL']],
    [repentanceDay(year), 'Buß- und Bettag', ['SN']],
    [fixed(12, 25), '1. Weihnachtstag', ALL],
    [fixed(12, 26), '2. Weihnachtstag', ALL],
  ]

  const map = new Map()
  for (const [date, name, states] of entries) {
    if (states.includes(state)) map.set(date, name)
  }
  return map
}

/** Holiday name for a specific date, otherwise null */
export function holidayOn(iso, state = 'SH') {
  const year = Number(iso.slice(0, 4))
  return holidaysForYear(year, state).get(iso) ?? null
}
