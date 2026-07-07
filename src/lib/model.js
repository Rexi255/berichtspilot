// Datenmodell: Profile, Wochen, Seed-Daten und daraus abgeleitete Strukturen.
import { WOCHENTAG_KEYS, addDays, imBereich } from './dates.js'
import { feiertagAm } from './holidays.js'

export const TAG_STATUS = ['normal', 'feiertag', 'krank', 'urlaub']

let idZaehler = 0
export const neueId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${(idZaehler++).toString(36)}`

/** Das Profil, dessen Gültigkeitsbereich das Datum abdeckt (sonst null). */
export function profilFuerDatum(profile, iso) {
  return profile.find((p) => imBereich(iso, p.gueltigVon, p.gueltigBis)) ?? null
}

// Fallback, falls kein Profil das Datum abdeckt: Mo–Fr Betrieb
const FALLBACK_WOCHENTAGE = Object.fromEntries(
  WOCHENTAG_KEYS.map((k) => [k, { typ: k === 'sa' ? 'frei' : 'betrieb', faecher: [] }])
)

/**
 * Neue Berichtswoche ab Montag `montagISO` aufbauen. Struktur (Tag-Typen,
 * Fächer, Anzahl Start-Stichpunkte) kommt aus dem passenden Profil; Feiertage
 * werden sofort erkannt und als Status gesetzt.
 */
export function neueWoche(montagISO, profile) {
  const profil = profilFuerDatum(profile, montagISOMitte(montagISO))
  const wochentage = profil?.wochentage ?? FALLBACK_WOCHENTAGE
  const anzahl = Math.max(1, profil?.standardStichpunkte ?? 2)
  const bundesland = profil?.bundesland ?? 'SH'

  const tage = []
  WOCHENTAG_KEYS.forEach((key, i) => {
    const konfig = wochentage[key]
    if (!konfig || konfig.typ === 'frei') return
    const datum = addDays(montagISO, i)
    const feiertag = feiertagAm(datum, bundesland)
    tage.push({
      datum,
      typ: konfig.typ,
      status: feiertag ? 'feiertag' : 'normal',
      feiertagName: feiertag,
      stichpunkte: Array.from({ length: anzahl }, () => ''),
      faecher: (konfig.faecher ?? []).map((label) => ({ label, punkte: [''] })),
    })
  })

  return { id: montagISO, status: 'entwurf', unterweisungen: '', tage }
}

// Profilwahl anhand der Wochenmitte (Mittwoch) — robust, falls ein Halbjahr
// mitten in einer Woche beginnt.
function montagISOMitte(montagISO) {
  return addDays(montagISO, 2)
}

/**
 * Leere Kopie einer bestehenden Woche für einen neuen Montag: übernimmt
 * Tag-Typen und Fächer-Labels, leert alle Stichpunkte. Feiertage werden für
 * die neuen Daten frisch erkannt.
 */
export function wocheAusVorlage(montagISO, vorlage, profile) {
  const profil = profilFuerDatum(profile, montagISOMitte(montagISO))
  const bundesland = profil?.bundesland ?? 'SH'
  const anzahl = Math.max(1, profil?.standardStichpunkte ?? 2)

  const tage = vorlage.tage.map((alt) => {
    // Wochentags-Offset des alten Tags beibehalten (Mo=0 … Sa=5)
    const offset = Math.round(
      (new Date(alt.datum).getTime() - new Date(vorlage.id).getTime()) / 86400000
    )
    const datum = addDays(montagISO, offset)
    const feiertag = feiertagAm(datum, bundesland)
    return {
      datum,
      typ: alt.typ,
      status: feiertag ? 'feiertag' : 'normal',
      feiertagName: feiertag,
      stichpunkte: Array.from({ length: anzahl }, () => ''),
      faecher: alt.faecher.map((f) => ({ label: f.label, punkte: [''] })),
    }
  })

  return { id: montagISO, status: 'entwurf', unterweisungen: '', tage }
}

/** Startdaten beim allerersten Start (echte Halbjahre des Nutzers als Vorlage). */
export function seedDaten() {
  return {
    version: 1,
    einstellungen: {
      ausbildungVon: '',
      ausbildungBis: '',
      theme: 'nordlicht',
    },
    profile: [
      {
        id: neueId('profil'),
        name: 'Schulhalbjahr 2025/26 · 2',
        bundesland: 'SH',
        gueltigVon: '2026-02-02',
        gueltigBis: '2026-07-31',
        standardStichpunkte: 2,
        wochentage: {
          mo: { typ: 'schule', faecher: ['LF02', 'LF03', 'Englisch', 'WiPo'] },
          di: { typ: 'schule', faecher: ['LF04', 'LF05'] },
          mi: { typ: 'betrieb', faecher: [] },
          do: { typ: 'betrieb', faecher: [] },
          fr: { typ: 'betrieb', faecher: [] },
          sa: { typ: 'frei', faecher: [] },
        },
      },
      {
        id: neueId('profil'),
        name: 'Schulhalbjahr 2025/26 · 1',
        bundesland: 'SH',
        gueltigVon: '2025-08-01',
        gueltigBis: '2026-02-01',
        standardStichpunkte: 2,
        wochentage: {
          mo: { typ: 'schule', faecher: ['LF01', 'LF02', 'LF03', 'WiPo'] },
          di: { typ: 'betrieb', faecher: [] },
          mi: { typ: 'betrieb', faecher: [] },
          do: { typ: 'betrieb', faecher: [] },
          fr: { typ: 'betrieb', faecher: [] },
          sa: { typ: 'frei', faecher: [] },
        },
      },
    ],
    wochen: [],
  }
}

/** Neues, leeres Profil (für die Profile-Verwaltung). */
export function neuesProfil() {
  return {
    id: neueId('profil'),
    name: 'Neues Halbjahr',
    bundesland: 'SH',
    gueltigVon: '',
    gueltigBis: '',
    standardStichpunkte: 2,
    wochentage: {
      mo: { typ: 'betrieb', faecher: [] },
      di: { typ: 'betrieb', faecher: [] },
      mi: { typ: 'betrieb', faecher: [] },
      do: { typ: 'betrieb', faecher: [] },
      fr: { typ: 'betrieb', faecher: [] },
      sa: { typ: 'frei', faecher: [] },
    },
  }
}
