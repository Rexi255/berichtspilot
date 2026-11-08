// Generates e2e/fixtures/demo-daten.json: a fictional training record (no
// customer data, no real names) for screenshots, README images and UI checks.
// Built with the app's own model functions, so holidays, periods and profiles
// behave exactly like in the app. Deterministic: same input → same file.
//
//   node e2e/fixtures/make-demo.mjs
//
// "Today" for this record is DEMO_TODAY (Wednesday of KW 45/2026) — freeze the
// clock there (Playwright `page.clock.setFixedTime`) when showing it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { newWeek, seedData } from '../../src/lib/model.js'
import { addDays, mondayOf, parseISO } from '../../src/lib/dates.js'

export const DEMO_TODAY = '2026-11-04'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'demo-daten.json')

// Small seeded PRNG (mulberry32) — stable output across runs
function rng(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = rng(20260901)
const pick = (list) => list[Math.floor(random() * list.length)]

const WORK = [
  'Einrichtung eines Notebooks für einen neuen Mitarbeiter inklusive Softwareverteilung',
  'Bearbeitung von Support-Anfragen zu Druckerproblemen in der Verwaltung',
  'Dokumentation der Netzwerkverkabelung im zweiten Obergeschoss',
  'Austausch eines defekten Netzteils an einem Etagenswitch',
  'Pflege von Benutzerkonten und Gruppen im Active Directory',
  'Vorbereitung von Leihgeräten für eine interne Schulung',
  'Aktualisierung der Firmware an den WLAN-Access-Points',
  'Erstellung einer Anleitung zur Einrichtung der Zwei-Faktor-Anmeldung',
  'Inventarisierung von Hardware und Abgleich mit der Bestandsliste',
  'Einrichtung von Monitoren und Dockingstationen an zwei Arbeitsplätzen',
  'Überprüfung der nächtlichen Datensicherung und Auswertung der Protokolle',
  'Mitarbeit bei der Migration von Postfächern auf den neuen Mailserver',
  'Konfiguration von VLANs an einem Etagenswitch unter Anleitung',
  'Fehleranalyse bei langsamen Netzlaufwerken und Bereinigung von Benutzerprofilen',
  'Installation von Windows-Updates auf den Testsystemen',
  'Aufbau einer virtuellen Testumgebung mit Hyper-V',
  'Erneuerung abgelaufener Zertifikate auf internen Webdiensten',
  'Datenlöschung und Entsorgung von Altgeräten nach interner Vorgabe',
  'Einweisung von Kollegen in die neuen Kategorien des Ticketsystems',
  'Patch-Arbeiten am Netzwerkschrank und Beschriftung der Ports',
  'Austausch von Tonerkartuschen und Wartung der Etagendrucker',
  'Einrichtung eines Besprechungsraums mit Konferenzkamera und Lautsprecher',
  'Überprüfung der USV-Anlage und Dokumentation der Akkulaufzeit',
  'Anpassung von Gruppenrichtlinien für die Bildschirmsperre',
]

const TOPICS = {
  LF01: ['Das Unternehmen und die eigene Rolle im Betrieb', 'Organisationsformen und Leitbild', 'Kommunikationsregeln im Team'],
  LF02: ['Arbeitsplätze nach Kundenwunsch ausstatten', 'Hardwarekomponenten eines PCs', 'Ergonomie am Bildschirmarbeitsplatz'],
  LF03: ['Clients in Netzwerke einbinden', 'IPv4-Adressierung und Subnetting', 'DHCP und DNS im lokalen Netz'],
  LF04: ['Schutzbedarfsanalyse im eigenen Arbeitsbereich', 'Grundwerte der Informationssicherheit', 'Passwortrichtlinien'],
  LF05: ['Datenbankmodell eines Lagers entwerfen', 'SQL-Abfragen mit Filtern und Joins', 'Normalisierung bis zur dritten Normalform'],
  LF06: ['Serviceanfragen bearbeiten', 'Ticketpriorisierung nach SLA', 'Gesprächsführung im Support'],
  LF07: ['Cyber-physische Systeme ergänzen', 'Sensoren und Aktoren', 'Protokolle im Internet der Dinge'],
  LF08: ['Daten systemübergreifend bereitstellen', 'Schnittstellen und Datenformate', 'JSON und XML im Vergleich'],
  LF09: ['Netzwerke und Dienste bereitstellen', 'Routing zwischen Subnetzen', 'Virtualisierung von Servern'],
  Englisch: ['Technical documentation', 'Phone calls in IT support', 'Describing network diagrams'],
  WiPo: ['Sozialversicherungen', 'Tarifverträge und Mitbestimmung', 'Der Ausbildungsvertrag'],
}

const INSTRUCTIONS = [
  'Unterweisung zum Arbeitsschutz und zur Ersten Hilfe',
  'Schulung zum Umgang mit dem neuen Ticketsystem',
  'Jährliche Datenschutzunterweisung',
  'Einführung in die Richtlinie zur Passwortvergabe',
]

// Weeks with no report, drafts and sick days (all fictional)
const MISSING = new Set(['2026-03-16', '2026-06-08', '2026-06-15', '2026-10-19'])
const DRAFTS = new Set(['2026-09-21', '2026-10-12', '2026-10-26', '2026-11-02'])
const SICK = new Set(['2026-02-10', '2026-05-20'])

const data = seedData()
data.settings = {
  ...data.settings,
  trainingStart: '2025-09-01',
  trainingEnd: '2028-08-31',
  autoCreateWeek: false,
  updateCheck: false,
  setupDone: true,
  snippets: ['Bearbeitung von Support-Tickets im Bereich Arbeitsplatzausstattung'],
}
data.profiles = [
  {
    ...data.profiles[0],
    id: 'profile-demo-3',
    name: 'Schulhalbjahr 2026/27 · 1',
    validFrom: '2026-08-01',
    validTo: '2027-01-31',
    weekdays: {
      mon: { type: 'school', subjects: ['LF06', 'LF07', 'Englisch', 'WiPo'] },
      tue: { type: 'work', subjects: [] },
      wed: { type: 'work', subjects: [] },
      thu: { type: 'school', subjects: ['LF08', 'LF09'] },
      fri: { type: 'work', subjects: [] },
      sat: { type: 'off', subjects: [] },
    },
  },
  { ...data.profiles[0], id: 'profile-demo-2' },
  { ...data.profiles[1], id: 'profile-demo-1' },
]
data.periods = [
  { id: 'period-demo-1', type: 'schoolBreak', label: 'Herbstferien', from: '2025-10-20', to: '2025-10-31' },
  { id: 'period-demo-2', type: 'vacation', label: 'Weihnachten', from: '2025-12-22', to: '2026-01-02' },
  { id: 'period-demo-3', type: 'schoolBreak', label: 'Osterferien', from: '2026-04-07', to: '2026-04-17' },
  // vacation first: periodFor() takes the first period covering a date
  { id: 'period-demo-5', type: 'vacation', label: 'Sommerurlaub', from: '2026-07-20', to: '2026-07-31' },
  { id: 'period-demo-4', type: 'schoolBreak', label: 'Sommerferien', from: '2026-07-06', to: '2026-08-14' },
  { id: 'period-demo-6', type: 'schoolBreak', label: 'Herbstferien', from: '2026-10-12', to: '2026-10-24' },
]

const topicIndex = {}
const nextTopic = (label) => {
  const list = TOPICS[label] ?? ['Wiederholung']
  topicIndex[label] = (topicIndex[label] ?? 0) + 1
  return list[(topicIndex[label] - 1) % list.length]
}

// Fill a normal day completely (done weeks) or leave it empty
function fillDay(day, full) {
  if (day.status !== 'normal' || !full) return day
  if (day.type === 'work') {
    const count = 2 + Math.floor(random() * 2)
    const bullets = new Set()
    while (bullets.size < count) bullets.add(pick(WORK))
    return { ...day, bullets: [...bullets] }
  }
  return { ...day, subjects: day.subjects.map((s) => ({ ...s, bullets: [nextTopic(s.label)] })) }
}

const lastMonday = mondayOf(parseISO(DEMO_TODAY))
let index = 0
for (let monday = mondayOf(parseISO(data.settings.trainingStart)); monday <= lastMonday; monday = addDays(monday, 7)) {
  index++
  if (MISSING.has(monday)) continue
  let week = newWeek(monday, data.profiles, data.periods)
  const draft = DRAFTS.has(monday)
  week = {
    ...week,
    status: draft ? 'draft' : 'done',
    instructions: index % 7 === 0 ? pick(INSTRUCTIONS) : '',
    days: week.days.map((day) => {
      const sick = SICK.has(day.date) ? { ...day, status: 'sick' } : day
      // Drafts: only the first half of the week is written
      const full = !draft || day.date < addDays(monday, monday === lastMonday ? 2 : 3)
      return fillDay(sick, full)
    }),
  }
  data.weeks.push(week)
}

// Raw notes on today (current draft) and in the last draft — the notes area
const notes = {
  '2026-11-04': 'Drucker im zweiten OG getauscht, Treiber über die Softwareverteilung ausgerollt\nTicketsystem: alte Kategorien zusammengelegt',
  '2026-10-29': 'USV im Serverraum geprüft, Akkulaufzeit notiert',
}
data.weeks = data.weeks.map((w) => ({
  ...w,
  days: w.days.map((d) => (notes[d.date] ? { ...d, notes: notes[d.date] } : d)),
}))

fs.writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`)
console.log(`${path.relative(process.cwd(), OUT)}: ${data.weeks.length} weeks, version ${data.version}`)
