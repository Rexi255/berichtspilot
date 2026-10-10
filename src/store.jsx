// Central state: loads daten.json on start and saves changes automatically
// (debounced) through the preload bridge to the main process.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  seedData,
  newWeek,
  weekFromTemplate,
  newProfile,
  duplicateProfile as copyOfProfile,
  newPeriod,
  applyPeriod,
  migrateData,
  validateData,
  mergeData,
  replaceData,
} from './lib/model.js'
import { isoWeek } from './lib/dates.js'
import { showToast } from './ui/toast.jsx'

const StoreContext = createContext(null)

const DESKTOP_ONLY = 'Nur in der Desktop-App verfügbar'

// Fallback for plain browser mode (vite without Electron, smoke tests)
const browserApi = {
  loadData: async () => ({
    ok: true,
    data: JSON.parse(localStorage.getItem('daten') ?? 'null'),
    path: 'localStorage (Browser-Modus)',
  }),
  saveData: async (d) => {
    localStorage.setItem('daten', JSON.stringify(d))
    return { ok: true }
  },
  exportData: async () => ({ ok: false, error: DESKTOP_ONLY }),
  importData: async () => ({ ok: false, error: DESKTOP_ONLY }),
  exportText: async () => ({ ok: false, error: DESKTOP_ONLY }),
  readClipboard: () => navigator.clipboard.readText().catch(() => ''),
  revealDataFile: async () => {},
  askDialog: async () => 0,
  webuntisStatus: async () => ({ ok: false, loggedIn: false, error: DESKTOP_ONLY }),
  webuntisLogin: async () => ({ ok: false, loggedIn: false, error: DESKTOP_ONLY }),
  webuntisLogout: async () => ({ ok: false, error: DESKTOP_ONLY }),
  webuntisSetEnabled: async () => ({ ok: true }),
  webuntisWeek: async () => ({ ok: false, error: DESKTOP_ONLY }),
  minimize() {}, maximize() {}, close() {}, onMaximized: () => () => {},
}

export const api = typeof window !== 'undefined' && window.api ? window.api : browserApi

const byId = (a, b) => (a.id < b.id ? -1 : 1)

export function StoreProvider({ children }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [dataPath, setDataPath] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const timerRef = useRef(null)
  const loadedRef = useRef(false)
  // Current state for mutations that must read it BEFORE setData (undo)
  const dataRef = useRef(null)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  // Load on start; if the file is missing, seed data is created.
  // Older files are migrated; files from NEWER app versions block loading
  // (instead of being silently destroyed by the next autosave).
  useEffect(() => {
    api.loadData().then((res) => {
      setDataPath(res.path ?? '')
      let d
      if (res.ok && res.data) {
        try {
          d = migrateData(res.data)
        } catch (error) {
          setLoadError(String(error.message ?? error))
          return
        }
      } else {
        d = seedData()
      }
      loadedRef.current = true
      setData(d)
      // Main file was corrupted and restored from a backup
      if (res.fromBackup) {
        showToast('Daten aus Sicherung wiederhergestellt', { kind: 'error', duration: 5000 })
      } else if (!res.ok) {
        showToast('Daten konnten nicht geladen werden', { kind: 'error', duration: 5000 })
      }
    })
  }, [])

  const saveNow = useCallback(async (d) => {
    setSaveStatus('saving')
    const res = await api.saveData(d)
    setSaveStatus(res.ok ? 'saved' : 'error')
  }, [])

  // Write every change to disk, debounced (400 ms)
  useEffect(() => {
    if (!data || !loadedRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => saveNow(data), 400)
    return () => clearTimeout(timerRef.current)
  }, [data, saveNow])

  // The main process enforces the WebUntis switch (off = no request at all, and
  // switching off logs out). Synced here — not in Settings — so every path that
  // changes the flag counts: the toggle, an import, loading the file.
  // Layout effect: runs before any child's passive effect, so the main process
  // already knows "on" when Settings asks for the status right after toggling.
  const webuntisEnabled = data ? data.settings.webuntis?.enabled === true : null
  useLayoutEffect(() => {
    if (webuntisEnabled === null) return
    api.webuntisSetEnabled(webuntisEnabled).then(
      (res) => !res.ok && showToast(res.error || 'Abmelden fehlgeschlagen', { kind: 'error', duration: 5000 }),
      () => showToast('WebUntis konnte nicht umgeschaltet werden', { kind: 'error', duration: 5000 })
    )
  }, [webuntisEnabled])

  // ---------------- Mutations (always immutable) ----------------

  const createWeek = useCallback((mondayISO, { fromTemplate = false } = {}) => {
    let created = null
    setData((d) => {
      if (d.weeks.some((w) => w.id === mondayISO)) return d
      const earlier = d.weeks.filter((w) => w.id < mondayISO).sort((a, b) => (a.id < b.id ? 1 : -1))
      created =
        fromTemplate && earlier[0]
          ? weekFromTemplate(mondayISO, earlier[0], d.profiles, d.periods)
          : newWeek(mondayISO, d.profiles, d.periods)
      return { ...d, weeks: [...d.weeks, created].sort(byId) }
    })
    return created
  }, [])

  const updateWeek = useCallback((id, change) => {
    setData((d) => ({
      ...d,
      weeks: d.weeks.map((w) => (w.id === id ? change(structuredClone(w)) : w)),
    }))
  }, [])

  // Delete with undo: the object is only removed from state and kept
  // restorable via an "Rückgängig" toast (6 s window).
  const deleteWeek = useCallback((id) => {
    const week = dataRef.current?.weeks.find((w) => w.id === id)
    setData((d) => ({ ...d, weeks: d.weeks.filter((w) => w.id !== id) }))
    if (!week) return
    const { week: weekNo, year } = isoWeek(id)
    showToast(`Woche KW ${weekNo}/${year} gelöscht`, {
      duration: 6000,
      action: {
        label: 'Rückgängig',
        onClick: () =>
          setData((d) =>
            d.weeks.some((w) => w.id === id) ? d : { ...d, weeks: [...d.weeks, week].sort(byId) }
          ),
      },
    })
  }, [])

  const updateProfile = useCallback((id, change) => {
    setData((d) => ({
      ...d,
      profiles: d.profiles.map((p) => (p.id === id ? change(structuredClone(p)) : p)),
    }))
  }, [])

  const createProfile = useCallback(() => {
    const p = newProfile()
    setData((d) => ({ ...d, profiles: [p, ...d.profiles] }))
    return p
  }, [])

  const deleteProfile = useCallback((id) => {
    const index = dataRef.current?.profiles.findIndex((p) => p.id === id) ?? -1
    const profile = index >= 0 ? dataRef.current.profiles[index] : null
    setData((d) => ({ ...d, profiles: d.profiles.filter((p) => p.id !== id) }))
    if (!profile) return
    showToast(`Profil „${profile.name}" gelöscht`, {
      duration: 6000,
      action: {
        label: 'Rückgängig',
        onClick: () =>
          setData((d) => {
            if (d.profiles.some((p) => p.id === id)) return d
            const profiles = [...d.profiles]
            profiles.splice(Math.min(index, profiles.length), 0, profile)
            return { ...d, profiles }
          }),
      },
    })
  }, [])

  /** Copy a profile (half-year switch) — returns the new copy. */
  const duplicateProfile = useCallback((id) => {
    const original = dataRef.current?.profiles.find((p) => p.id === id)
    if (!original) return null
    const copy = copyOfProfile(original)
    setData((d) => {
      const index = d.profiles.findIndex((p) => p.id === id)
      const profiles = [...d.profiles]
      profiles.splice(index + 1, 0, copy)
      return { ...d, profiles }
    })
    return copy
  }, [])

  // ---------------- Periods (vacation / school breaks) ----------------

  const createPeriod = useCallback(() => {
    const p = newPeriod()
    setData((d) => ({ ...d, periods: [...d.periods, p] }))
    return p
  }, [])

  const updatePeriod = useCallback((id, patch) => {
    setData((d) => {
      const periods = d.periods.map((p) => (p.id === id ? { ...p, ...patch } : p))
      const changed = periods.find((p) => p.id === id)
      // Vacation applies to existing weeks right away (only empty normal days)
      return { ...d, periods, weeks: applyPeriod(d.weeks, changed) }
    })
  }, [])

  const deletePeriod = useCallback((id) => {
    setData((d) => ({ ...d, periods: d.periods.filter((p) => p.id !== id) }))
  }, [])

  const updateSettings = useCallback((patch) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }, [])

  // Only the on/off switch is stored — login state lives in the main process,
  // which follows this flag via the layout effect above
  const setWebuntisEnabled = useCallback((enabled) => {
    setData((d) => ({ ...d, settings: { ...d.settings, webuntis: { ...d.settings.webuntis, enabled } } }))
  }, [])

  const exportData = useCallback(() => api.exportData(data), [data])

  // Import: migrate + validate the file, then ask natively whether to merge
  // (add only what's missing) or replace everything.
  const importData = useCallback(async () => {
    const res = await api.importData()
    if (res.canceled) return { ok: false, canceled: true }
    if (!res.ok || !res.data) return { ok: false, error: res.error ?? 'Datei konnte nicht gelesen werden' }

    let imported
    try {
      imported = validateData(migrateData(res.data))
    } catch (error) {
      return { ok: false, error: String(error.message ?? error) }
    }

    const choice = await api.askDialog({
      title: 'Daten importieren',
      message: 'Wie sollen die importierten Daten übernommen werden?',
      detail:
        'Zusammenführen ergänzt nur Wochen, Profile und Zeiträume, die noch nicht existieren — Bestehendes bleibt unverändert. Ersetzen überschreibt den kompletten aktuellen Datenbestand.',
      buttons: ['Zusammenführen', 'Ersetzen', 'Abbrechen'],
      cancelId: 2,
    })
    if (choice !== 0 && choice !== 1) return { ok: false, canceled: true }
    setData((d) => (choice === 0 ? mergeData(d, imported) : replaceData(d, imported)))
    return { ok: true, merged: choice === 0 }
  }, [])

  const value = {
    data,
    loadError,
    dataPath,
    saveStatus,
    createWeek,
    updateWeek,
    deleteWeek,
    updateProfile,
    createProfile,
    deleteProfile,
    duplicateProfile,
    createPeriod,
    updatePeriod,
    deletePeriod,
    updateSettings,
    setWebuntisEnabled,
    exportData,
    importData,
    saveNow: () => data && saveNow(data),
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore used outside of StoreProvider')
  return ctx
}
