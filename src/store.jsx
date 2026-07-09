// Zentraler Zustand: lädt daten.json beim Start, speichert Änderungen
// automatisch (entprellt) über die preload-Brücke in den Main-Prozess.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  seedDaten,
  neueWoche,
  wocheAusVorlage,
  neuesProfil,
  profilDupliziert,
  neuerZeitraum,
  wendeZeitraumAn,
  migriereDaten,
  validiereDaten,
  mergeDaten,
} from './lib/model.js'
import { kalenderwoche } from './lib/dates.js'
import { zeigeToast } from './ui/toast.jsx'

const StoreContext = createContext(null)

// Fallback für den reinen Browser-Betrieb (vite dev ohne Electron)
const browserApi = {
  datenLaden: async () => ({
    ok: true,
    daten: JSON.parse(localStorage.getItem('daten') ?? 'null'),
    pfad: 'localStorage (Browser-Modus)',
  }),
  datenSpeichern: async (d) => {
    localStorage.setItem('daten', JSON.stringify(d))
    return { ok: true }
  },
  datenExportieren: async () => ({ ok: false, fehler: 'Nur in der Desktop-App verfügbar' }),
  datenImportieren: async () => ({ ok: false, fehler: 'Nur in der Desktop-App verfügbar' }),
  textExportieren: async () => ({ ok: false, fehler: 'Nur in der Desktop-App verfügbar' }),
  zwischenablageLesen: () => navigator.clipboard.readText().catch(() => ''),
  pfadOeffnen: async () => {},
  frageDialog: async () => 0,
  minimieren() {}, maximieren() {}, schliessen() {}, onMaximiert: () => () => {},
}

export const api = typeof window !== 'undefined' && window.api ? window.api : browserApi

export function StoreProvider({ children }) {
  const [daten, setDaten] = useState(null)
  const [ladefehler, setLadefehler] = useState(null)
  const [speicherPfad, setSpeicherPfad] = useState('')
  const [speicherStatus, setSpeicherStatus] = useState('bereit') // bereit | speichert | gespeichert | fehler
  const timerRef = useRef(null)
  const geladenRef = useRef(false)
  // Aktueller Stand für Mutationen, die VOR dem setDaten lesen müssen (Undo)
  const datenRef = useRef(null)
  useEffect(() => {
    datenRef.current = daten
  }, [daten])

  // Beim Start laden; fehlt die Datei, werden Seed-Daten angelegt.
  // Ältere Stände werden migriert; Stände aus NEUEREN App-Versionen blockieren
  // das Laden (statt sie beim nächsten Autosave stillschweigend zu zerstören).
  useEffect(() => {
    api.datenLaden().then((res) => {
      setSpeicherPfad(res.pfad ?? '')
      let d
      if (res.ok && res.daten) {
        try {
          d = migriereDaten(res.daten)
        } catch (fehler) {
          setLadefehler(String(fehler.message ?? fehler))
          return
        }
      } else {
        d = seedDaten()
      }
      geladenRef.current = true
      setDaten(d)
      // Hauptdatei war kaputt und wurde aus einer Sicherung wiederhergestellt
      if (res.ausBackup) {
        zeigeToast('Daten aus Sicherung wiederhergestellt', { art: 'fehler', dauer: 5000 })
      } else if (!res.ok) {
        zeigeToast('Daten konnten nicht geladen werden', { art: 'fehler', dauer: 5000 })
      }
    })
  }, [])

  const sofortSpeichern = useCallback(async (d) => {
    setSpeicherStatus('speichert')
    const res = await api.datenSpeichern(d)
    setSpeicherStatus(res.ok ? 'gespeichert' : 'fehler')
  }, [])

  // Jede Änderung entprellt auf die Platte schreiben (400 ms)
  useEffect(() => {
    if (!daten || !geladenRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => sofortSpeichern(daten), 400)
    return () => clearTimeout(timerRef.current)
  }, [daten, sofortSpeichern])

  // ---------------- Mutationen (immer immutabel) ----------------

  const wocheAnlegen = useCallback((montagISO, { ausVorlage = false } = {}) => {
    let angelegt = null
    setDaten((d) => {
      if (d.wochen.some((w) => w.id === montagISO)) return d
      const fruehere = d.wochen.filter((w) => w.id < montagISO).sort((a, b) => (a.id < b.id ? 1 : -1))
      angelegt =
        ausVorlage && fruehere[0]
          ? wocheAusVorlage(montagISO, fruehere[0], d.profile, d.zeitraeume)
          : neueWoche(montagISO, d.profile, d.zeitraeume)
      return { ...d, wochen: [...d.wochen, angelegt].sort((a, b) => (a.id < b.id ? -1 : 1)) }
    })
    return angelegt
  }, [])

  const wocheAendern = useCallback((id, aendern) => {
    setDaten((d) => ({
      ...d,
      wochen: d.wochen.map((w) => (w.id === id ? aendern(structuredClone(w)) : w)),
    }))
  }, [])

  // Löschen mit Undo: das Objekt wird nur aus dem Zustand entfernt und über
  // einen „Rückgängig"-Toast wieder einsetzbar gehalten (6 s Zeitfenster).
  const wocheLoeschen = useCallback((id) => {
    const woche = datenRef.current?.wochen.find((w) => w.id === id)
    setDaten((d) => ({ ...d, wochen: d.wochen.filter((w) => w.id !== id) }))
    if (!woche) return
    const { kw, jahr } = kalenderwoche(id)
    zeigeToast(`Woche KW ${kw}/${jahr} gelöscht`, {
      dauer: 6000,
      aktion: {
        label: 'Rückgängig',
        onKlick: () =>
          setDaten((d) =>
            d.wochen.some((w) => w.id === id)
              ? d
              : { ...d, wochen: [...d.wochen, woche].sort((a, b) => (a.id < b.id ? -1 : 1)) }
          ),
      },
    })
  }, [])

  const profilAendern = useCallback((id, aendern) => {
    setDaten((d) => ({
      ...d,
      profile: d.profile.map((p) => (p.id === id ? aendern(structuredClone(p)) : p)),
    }))
  }, [])

  const profilAnlegen = useCallback(() => {
    const p = neuesProfil()
    setDaten((d) => ({ ...d, profile: [p, ...d.profile] }))
    return p
  }, [])

  const profilLoeschen = useCallback((id) => {
    const index = datenRef.current?.profile.findIndex((p) => p.id === id) ?? -1
    const profil = index >= 0 ? datenRef.current.profile[index] : null
    setDaten((d) => ({ ...d, profile: d.profile.filter((p) => p.id !== id) }))
    if (!profil) return
    zeigeToast(`Profil „${profil.name}" gelöscht`, {
      dauer: 6000,
      aktion: {
        label: 'Rückgängig',
        onKlick: () =>
          setDaten((d) => {
            if (d.profile.some((p) => p.id === id)) return d
            const profile = [...d.profile]
            profile.splice(Math.min(index, profile.length), 0, profil)
            return { ...d, profile }
          }),
      },
    })
  }, [])

  /** Profil kopieren (Halbjahreswechsel) — liefert die neue Kopie. */
  const profilDuplizieren = useCallback((id) => {
    const original = datenRef.current?.profile.find((p) => p.id === id)
    if (!original) return null
    const kopie = profilDupliziert(original)
    setDaten((d) => {
      const index = d.profile.findIndex((p) => p.id === id)
      const profile = [...d.profile]
      profile.splice(index + 1, 0, kopie)
      return { ...d, profile }
    })
    return kopie
  }, [])

  // ---------------- Zeiträume (Urlaub / Schulferien) ----------------

  const zeitraumAnlegen = useCallback(() => {
    const z = neuerZeitraum()
    setDaten((d) => ({ ...d, zeitraeume: [...d.zeitraeume, z] }))
    return z
  }, [])

  const zeitraumAendern = useCallback((id, patch) => {
    setDaten((d) => {
      const zeitraeume = d.zeitraeume.map((z) => (z.id === id ? { ...z, ...patch } : z))
      const geaendert = zeitraeume.find((z) => z.id === id)
      // Urlaub wirkt sofort auch auf bestehende Wochen (nur leere Normal-Tage)
      return { ...d, zeitraeume, wochen: wendeZeitraumAn(d.wochen, geaendert) }
    })
  }, [])

  const zeitraumLoeschen = useCallback((id) => {
    setDaten((d) => ({ ...d, zeitraeume: d.zeitraeume.filter((z) => z.id !== id) }))
  }, [])

  const einstellungenAendern = useCallback((patch) => {
    setDaten((d) => ({ ...d, einstellungen: { ...d.einstellungen, ...patch } }))
  }, [])

  const exportieren = useCallback(() => api.datenExportieren(daten), [daten])

  // Import: Datei prüfen + migrieren, dann nativ fragen, ob zusammengeführt
  // (nur Fehlendes ergänzen) oder komplett ersetzt werden soll.
  const importieren = useCallback(async () => {
    const res = await api.datenImportieren()
    if (res.abgebrochen) return { ok: false, abgebrochen: true }
    if (!res.ok || !res.daten) return { ok: false, fehler: res.fehler ?? 'Datei konnte nicht gelesen werden' }

    let importiert
    try {
      importiert = migriereDaten(validiereDaten(res.daten))
    } catch (fehler) {
      return { ok: false, fehler: String(fehler.message ?? fehler) }
    }

    const wahl = await api.frageDialog({
      titel: 'Daten importieren',
      nachricht: 'Wie sollen die importierten Daten übernommen werden?',
      detail:
        'Zusammenführen ergänzt nur Wochen, Profile und Zeiträume, die noch nicht existieren — Bestehendes bleibt unverändert. Ersetzen überschreibt den kompletten aktuellen Datenbestand.',
      buttons: ['Zusammenführen', 'Ersetzen', 'Abbrechen'],
      cancelId: 2,
    })
    if (wahl !== 0 && wahl !== 1) return { ok: false, abgebrochen: true }
    setDaten((d) => (wahl === 0 ? mergeDaten(d, importiert) : importiert))
    return { ok: true, zusammengefuehrt: wahl === 0 }
  }, [])

  const wert = {
    daten,
    ladefehler,
    speicherPfad,
    speicherStatus,
    wocheAnlegen,
    wocheAendern,
    wocheLoeschen,
    profilAendern,
    profilAnlegen,
    profilLoeschen,
    profilDuplizieren,
    zeitraumAnlegen,
    zeitraumAendern,
    zeitraumLoeschen,
    einstellungenAendern,
    exportieren,
    importieren,
    sofortSpeichern: () => daten && sofortSpeichern(daten),
  }

  return <StoreContext.Provider value={wert}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore außerhalb des StoreProvider')
  return ctx
}
