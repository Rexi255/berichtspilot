// Datenmodell: Profile, Wochen, Zeiträume, Seed-Daten, Migration + Validierung.
import { WOCHENTAG_KEYS, addDays, imBereich, formatDE } from './dates.js'
import { feiertagAm } from './holidays.js'

export const TAG_STATUS = ['normal', 'feiertag', 'krank', 'urlaub']

// Aktuelle Schema-Version von daten.json. Ältere Stände werden beim Laden/Import
// über migriereDaten() angehoben; neuere werden abgelehnt (Downgrade-Schutz).
export const DATEN_VERSION = 2

let idZaehler = 0
export const neueId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${(idZaehler++).toString(36)}`

/** Das Profil, dessen Gültigkeitsbereich das Datum abdeckt (sonst null). */
export function profilFuerDatum(profile, iso) {
  return profile.find((p) => imBereich(iso, p.gueltigVon, p.gueltigBis)) ?? null
}

/** Der erste Zeitraum (Urlaub/Ferien), der das Datum abdeckt (sonst null). */
export function zeitraumFuer(iso, zeitraeume = []) {
  return zeitraeume.find((z) => z.von && z.bis && imBereich(iso, z.von, z.bis)) ?? null
}

/** Neuer, leerer Zeitraum für die Verwaltung in der Profile-View. */
export function neuerZeitraum() {
  return { id: neueId('zeitraum'), typ: 'urlaub', label: '', von: '', bis: '' }
}

/**
 * Status eines Tages beim Anlegen einer Woche ableiten. Rangfolge:
 * Feiertag > Urlaubs-Zeitraum > normal. Ferien-Zeiträume ändern nicht den
 * Status, sondern machen Schultage zu Betriebstagen (Flag `ferien`).
 */
function tagStatusFuer(datum, bundesland, zeitraeume) {
  const feiertag = feiertagAm(datum, bundesland)
  if (feiertag) return { status: 'feiertag', feiertagName: feiertag, ferien: false }
  const zeitraum = zeitraumFuer(datum, zeitraeume)
  if (zeitraum?.typ === 'urlaub') return { status: 'urlaub', feiertagName: null, ferien: false }
  return { status: 'normal', feiertagName: null, ferien: zeitraum?.typ === 'ferien' }
}

// Tag ohne eingetragenen Inhalt? (alle Stichpunkte + Fach-Punkte leer)
const tagIstLeer = (tag) =>
  (tag.stichpunkte ?? []).every((s) => !s.trim()) &&
  (tag.faecher ?? []).every((f) => (f.punkte ?? []).every((p) => !p.trim()))

/**
 * Urlaubs-Zeitraum rückwirkend auf BESTEHENDE Wochen anwenden: nur Tage im
 * Zeitraum, die noch „normal" und leer sind, werden auf Urlaub gesetzt —
 * bereits geschriebene Inhalte und manuell gesetzte Status bleiben unberührt.
 */
export function wendeZeitraumAn(wochen, zeitraum) {
  if (!zeitraum || zeitraum.typ !== 'urlaub' || !zeitraum.von || !zeitraum.bis) return wochen
  return wochen.map((w) => {
    if (!w.tage.some((t) => imBereich(t.datum, zeitraum.von, zeitraum.bis))) return w
    return {
      ...w,
      tage: w.tage.map((t) =>
        imBereich(t.datum, zeitraum.von, zeitraum.bis) && t.status === 'normal' && tagIstLeer(t)
          ? { ...t, status: 'urlaub' }
          : t
      ),
    }
  })
}

// ---------------------------------------------------------------------------
// Migration, Validierung, Zusammenführen (daten.json / Import)
// ---------------------------------------------------------------------------

/**
 * Ältere daten.json-Stände auf die aktuelle Schema-Version anheben.
 * Wirft bei einem Stand aus einer NEUEREN App-Version (Downgrade-Schutz).
 */
export function migriereDaten(roh) {
  const d = structuredClone(roh)
  d.version = typeof d.version === 'number' ? d.version : 1
  if (d.version > DATEN_VERSION) {
    throw new Error('Die Daten stammen aus einer neueren Version von Berichtspilot.')
  }
  if (d.version < 2) {
    // v1 -> v2: Zeiträume + neue Einstellungsfelder ergänzen
    d.zeitraeume = []
    d.einstellungen = { startAnsicht: 'uebersicht', textbausteine: [], ...(d.einstellungen ?? {}) }
    d.version = 2
  }
  // Defensive Defaults, falls einzelne Felder fehlen (z. B. handeditierte Datei)
  d.zeitraeume ??= []
  d.einstellungen ??= {}
  d.einstellungen.startAnsicht ??= 'uebersicht'
  d.einstellungen.textbausteine ??= []
  return d
}

const IST_ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/

/**
 * Strukturelle Prüfung importierter Daten — wirft mit verständlicher Meldung,
 * bevor ein kaputter Import den eigenen Datenbestand ersetzen kann.
 */
export function validiereDaten(d) {
  const fehler = (text) => {
    throw new Error(text)
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) fehler('Die Datei enthält kein Datenobjekt.')
  if (typeof d.version === 'number' && d.version > DATEN_VERSION) {
    fehler('Die Datei stammt aus einer neueren Version von Berichtspilot.')
  }
  if (!Array.isArray(d.profile) || !Array.isArray(d.wochen)) {
    fehler('Der Datei fehlen die Listen „profile" oder „wochen".')
  }
  for (const p of d.profile) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || typeof p.name !== 'string' ||
        !p.wochentage || typeof p.wochentage !== 'object') {
      fehler('Ein Profil in der Datei ist unvollständig (id, name oder wochentage fehlen).')
    }
  }
  for (const w of d.wochen) {
    if (!w || typeof w !== 'object' || !IST_ISO_DATUM.test(w.id ?? '') || !Array.isArray(w.tage)) {
      fehler('Eine Woche in der Datei ist unvollständig (id muss ein Datum sein, tage eine Liste).')
    }
    for (const t of w.tage) {
      if (!t || !IST_ISO_DATUM.test(t.datum ?? '') ||
          !Array.isArray(t.stichpunkte ?? []) || !Array.isArray(t.faecher ?? [])) {
        fehler(`Die Woche ab ${w.id} enthält einen unvollständigen Tag.`)
      }
    }
  }
  if (d.zeitraeume !== undefined && !Array.isArray(d.zeitraeume)) {
    fehler('„zeitraeume" muss eine Liste sein.')
  }
  return d
}

/**
 * Import zusammenführen statt ersetzen: ergänzt nur Wochen, Profile und
 * Zeiträume, die (per id) noch nicht existieren — Bestehendes bleibt unberührt.
 */
export function mergeDaten(aktuell, importiert) {
  const nurNeue = (vorhandene, kandidaten = []) => {
    const ids = new Set(vorhandene.map((e) => e.id))
    return kandidaten.filter((e) => !ids.has(e.id))
  }
  return {
    ...aktuell,
    profile: [...aktuell.profile, ...nurNeue(aktuell.profile, importiert.profile)],
    zeitraeume: [...aktuell.zeitraeume, ...nurNeue(aktuell.zeitraeume, importiert.zeitraeume)],
    wochen: [...aktuell.wochen, ...nurNeue(aktuell.wochen, importiert.wochen)].sort((a, b) =>
      a.id < b.id ? -1 : 1
    ),
  }
}

// Fallback, falls kein Profil das Datum abdeckt: Mo–Fr Betrieb
const FALLBACK_WOCHENTAGE = Object.fromEntries(
  WOCHENTAG_KEYS.map((k) => [k, { typ: k === 'sa' ? 'frei' : 'betrieb', faecher: [] }])
)

/**
 * Neue Berichtswoche ab Montag `montagISO` aufbauen. Struktur (Tag-Typen,
 * Fächer, Anzahl Start-Stichpunkte) kommt aus dem passenden Profil; Feiertage
 * und Urlaubs-/Ferien-Zeiträume werden sofort erkannt: Urlaub setzt den Status,
 * Ferien machen Schultage zu Betriebstagen.
 */
export function neueWoche(montagISO, profile, zeitraeume = []) {
  const profil = profilFuerDatum(profile, montagISOMitte(montagISO))
  const wochentage = profil?.wochentage ?? FALLBACK_WOCHENTAGE
  const anzahl = Math.max(1, profil?.standardStichpunkte ?? 2)
  const bundesland = profil?.bundesland ?? 'SH'

  const tage = []
  WOCHENTAG_KEYS.forEach((key, i) => {
    const konfig = wochentage[key]
    if (!konfig || konfig.typ === 'frei') return
    const datum = addDays(montagISO, i)
    const { status, feiertagName, ferien } = tagStatusFuer(datum, bundesland, zeitraeume)
    const typ = konfig.typ === 'schule' && ferien ? 'betrieb' : konfig.typ
    tage.push({
      datum,
      typ,
      status,
      feiertagName,
      stichpunkte: Array.from({ length: anzahl }, () => ''),
      faecher: typ === 'schule' ? (konfig.faecher ?? []).map((label) => ({ label, punkte: [''] })) : [],
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
export function wocheAusVorlage(montagISO, vorlage, profile, zeitraeume = []) {
  const profil = profilFuerDatum(profile, montagISOMitte(montagISO))
  const bundesland = profil?.bundesland ?? 'SH'
  const anzahl = Math.max(1, profil?.standardStichpunkte ?? 2)

  const tage = vorlage.tage.map((alt) => {
    // Wochentags-Offset des alten Tags beibehalten (Mo=0 … Sa=5)
    const offset = Math.round(
      (new Date(alt.datum).getTime() - new Date(vorlage.id).getTime()) / 86400000
    )
    const datum = addDays(montagISO, offset)
    const { status, feiertagName, ferien } = tagStatusFuer(datum, bundesland, zeitraeume)
    const typ = alt.typ === 'schule' && ferien ? 'betrieb' : alt.typ
    return {
      datum,
      typ,
      status,
      feiertagName,
      stichpunkte: Array.from({ length: anzahl }, () => ''),
      faecher: typ === 'schule' ? alt.faecher.map((f) => ({ label: f.label, punkte: [''] })) : [],
    }
  })

  return { id: montagISO, status: 'entwurf', unterweisungen: '', tage }
}

/** Startdaten beim allerersten Start (echte Halbjahre des Nutzers als Vorlage). */
export function seedDaten() {
  return {
    version: DATEN_VERSION,
    einstellungen: {
      ausbildungVon: '',
      ausbildungBis: '',
      theme: 'nordlicht',
      startAnsicht: 'uebersicht',
      textbausteine: [],
    },
    zeitraeume: [],
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

/** Kopie eines Profils mit neuer id — für den Halbjahreswechsel. */
export function profilDupliziert(profil) {
  const kopie = structuredClone(profil)
  kopie.id = neueId('profil')
  kopie.name = `${profil.name} (Kopie)`
  return kopie
}

/**
 * Gültigkeitszeiträume der Profile prüfen: unvollständige/verdrehte Angaben,
 * Überlappungen (dann ist die Profilwahl mehrdeutig) und Lücken (Wochen ohne
 * Profil fallen auf den Mo–Fr-Betrieb-Fallback zurück). Liefert Warnungstexte.
 */
export function pruefeProfile(profile) {
  const warnungen = []
  for (const p of profile) {
    if (!p.gueltigVon || !p.gueltigBis) {
      warnungen.push(`„${p.name}" hat keinen vollständigen Gültigkeitszeitraum.`)
    } else if (p.gueltigBis < p.gueltigVon) {
      warnungen.push(`„${p.name}": „Gültig bis" liegt vor „Gültig von".`)
    }
  }

  const sortiert = profile
    .filter((p) => p.gueltigVon && p.gueltigBis && p.gueltigBis >= p.gueltigVon)
    .sort((a, b) => (a.gueltigVon < b.gueltigVon ? -1 : 1))

  for (let i = 0; i < sortiert.length; i++) {
    for (let j = i + 1; j < sortiert.length; j++) {
      const a = sortiert[i]
      const b = sortiert[j]
      if (b.gueltigVon <= a.gueltigBis) {
        const bis = a.gueltigBis < b.gueltigBis ? a.gueltigBis : b.gueltigBis
        warnungen.push(
          `„${a.name}" und „${b.name}" überlappen sich (${formatDE(b.gueltigVon)} – ${formatDE(bis)}) — es gewinnt das zuerst gelistete Profil.`
        )
      }
    }
  }

  for (let i = 0; i < sortiert.length - 1; i++) {
    const a = sortiert[i]
    const b = sortiert[i + 1]
    const lueckeVon = addDays(a.gueltigBis, 1)
    if (lueckeVon < b.gueltigVon) {
      warnungen.push(
        `Lücke zwischen „${a.name}" und „${b.name}" (${formatDE(lueckeVon)} – ${formatDE(addDays(b.gueltigVon, -1))}) — Wochen dort nutzen den Standard Mo–Fr Betrieb.`
      )
    }
  }
  return warnungen
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
