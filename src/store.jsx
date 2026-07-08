// Zentraler Zustand: lädt daten.json beim Start, speichert Änderungen
// automatisch (entprellt) über die preload-Brücke in den Main-Prozess.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { seedDaten, neueWoche, wocheAusVorlage, neuesProfil } from './lib/model.js'
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
  minimieren() {}, maximieren() {}, schliessen() {}, onMaximiert: () => () => {},
}

export const api = typeof window !== 'undefined' && window.api ? window.api : browserApi

export function StoreProvider({ children }) {
  const [daten, setDaten] = useState(null)
  const [speicherPfad, setSpeicherPfad] = useState('')
  const [speicherStatus, setSpeicherStatus] = useState('bereit') // bereit | speichert | gespeichert | fehler
  const timerRef = useRef(null)
  const geladenRef = useRef(false)

  // Beim Start laden; fehlt die Datei, werden Seed-Daten angelegt
  useEffect(() => {
    api.datenLaden().then((res) => {
      setSpeicherPfad(res.pfad ?? '')
      const d = res.ok && res.daten ? res.daten : seedDaten()
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
          ? wocheAusVorlage(montagISO, fruehere[0], d.profile)
          : neueWoche(montagISO, d.profile)
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

  const wocheLoeschen = useCallback((id) => {
    setDaten((d) => ({ ...d, wochen: d.wochen.filter((w) => w.id !== id) }))
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
    setDaten((d) => ({ ...d, profile: d.profile.filter((p) => p.id !== id) }))
  }, [])

  const einstellungenAendern = useCallback((patch) => {
    setDaten((d) => ({ ...d, einstellungen: { ...d.einstellungen, ...patch } }))
  }, [])

  const exportieren = useCallback(() => api.datenExportieren(daten), [daten])

  const importieren = useCallback(async () => {
    const res = await api.datenImportieren()
    if (res.ok && res.daten && Array.isArray(res.daten.profile) && Array.isArray(res.daten.wochen)) {
      setDaten(res.daten)
      return { ok: true }
    }
    if (res.abgebrochen) return { ok: false, abgebrochen: true }
    return { ok: false, fehler: res.fehler ?? 'Datei hat kein gültiges Format' }
  }, [])

  const wert = {
    daten,
    speicherPfad,
    speicherStatus,
    wocheAnlegen,
    wocheAendern,
    wocheLoeschen,
    profilAendern,
    profilAnlegen,
    profilLoeschen,
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
