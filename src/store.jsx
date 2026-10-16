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
  shouldAutoCreate,
} from './lib/model.js'
import { isoWeek, mondayOf, toISO } from './lib/dates.js'
import { setMapping } from './lib/webuntis.js'
import { applySetup } from './lib/setup.js'
import { showToast } from './ui/toast.jsx'

const StoreContext = createContext(null)

const DESKTOP_ONLY = 'Nur in der Desktop-App verfügbar'
const NO_UPDATES = { ok: true, state: 'unsupported', current: '', error: DESKTOP_ONLY }

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
  onFlushRequest: () => () => {},
  exportData: async () => ({ ok: false, error: DESKTOP_ONLY }),
  importData: async () => ({ ok: false, error: DESKTOP_ONLY }),
  exportText: async () => ({ ok: false, error: DESKTOP_ONLY }),
  readClipboard: () => navigator.clipboard.readText().catch(() => ''),
  revealDataFile: async () => {},
  askDialog: async () => 0,
  webuntisStatus: async () => ({ ok: false, loggedIn: false, error: DESKTOP_ONLY }),
  webuntisLogin: async () => ({ ok: false, loggedIn: false, error: DESKTOP_ONLY }),
  webuntisLogout: async () => ({ ok: false, error: DESKTOP_ONLY }),
  webuntisConfigure: async () => ({ ok: true }),
  webuntisWeek: async () => ({ ok: false, error: DESKTOP_ONLY }),
  updateStatus: async () => NO_UPDATES,
  updateCheck: async () => NO_UPDATES,
  updateDownload: async () => NO_UPDATES,
  updateInstall: async () => ({ ok: false, error: DESKTOP_ONLY }),
  onUpdateChanged: () => () => {},
  minimize() {}, maximize() {}, close() {}, onMaximized: () => () => {},
}

export const api = typeof window !== 'undefined' && window.api ? window.api : browserApi

const byId = (a, b) => (a.id < b.id ? -1 : 1)

// Store an update status and pass it on to the caller
const keepStatus = (setUpdate) => (status) => {
  setUpdate(status)
  return status
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [dataPath, setDataPath] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  // Auto-update status from the main process (electron/updater.js)
  const [update, setUpdate] = useState(null)
  // Install started (shared by sidebar + Settings; the ref guards double clicks)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  // Setup wizard opened again from Settings (a fresh install opens it through
  // settings.setupDone === false). UI state only, never saved.
  const [setupRequested, setSetupRequested] = useState(false)
  const installingRef = useRef(false)
  // Pending autosave (timer id, null = nothing waiting) and whether the last
  // save failed — both mean "the state on screen isn't on disk yet"
  const timerRef = useRef(null)
  const saveFailedRef = useRef(false)
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
      // daten.json and every backup exist but are unreadable: never fall back to
      // seed data — the next autosave would rotate the originals out of the backups
      if (!res.ok) {
        setLoadError({
          message: `daten.json und alle Sicherungen sind nicht lesbar (${res.error ?? 'unbekannter Fehler'}).`,
          hint: 'Deine Dateien bleiben unverändert. Ersetze daten.json im Datenordner durch eine lesbare Kopie (z. B. einen Export) und starte Berichtspilot neu.',
          canReveal: true,
        })
        return
      }
      let d
      if (res.data) {
        try {
          d = migrateData(res.data)
        } catch (error) {
          setLoadError({
            message: String(error.message ?? error),
            hint: 'Bitte aktualisiere Berichtspilot auf die neueste Version — deine daten.json bleibt unverändert.',
          })
          return
        }
      } else {
        d = seedData()
      }
      // Current week missing (Mon–Fri)? Create it once, right with the loaded data
      const today = new Date()
      const autoCreated = shouldAutoCreate(d, toISO(today)) ? newWeek(mondayOf(today), d.profiles, d.periods) : null
      if (autoCreated) d = { ...d, weeks: [...d.weeks, autoCreated].sort(byId) }
      loadedRef.current = true
      setData(d)
      // Main file was corrupted and restored from a backup
      if (res.fromBackup) {
        showToast('Daten aus Sicherung wiederhergestellt', { kind: 'error', duration: 5000 })
      } else if (autoCreated) {
        showToast(`KW ${isoWeek(autoCreated.id).week} angelegt`)
      }
      // Look for a new version once per start, only if the user leaves it on
      // (E-017). Main answers 'unsupported' without a request in dev/portable.
      if (d.settings.updateCheck) api.updateCheck().then(setUpdate, () => {})
    })
  }, [])

  // Every status change (progress included) arrives as an event from main
  useEffect(() => {
    api.updateStatus().then(setUpdate, () => {})
    return api.onUpdateChanged(setUpdate)
  }, [])

  const saveNow = useCallback(async (d) => {
    setSaveStatus('saving')
    let res
    try {
      res = await api.saveData(d)
    } catch (error) {
      res = { ok: false, error: String(error) }
    }
    saveFailedRef.current = !res.ok
    setSaveStatus(res.ok ? 'saved' : 'error')
    return res
  }, [])

  // Write every change to disk, debounced (400 ms)
  useEffect(() => {
    if (!data || !loadedRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      saveNow(data)
    }, 400)
    return () => clearTimeout(timerRef.current)
  }, [data, saveNow])

  // Write what isn't on disk yet right now — before the window closes (main
  // asks via onFlushRequest, step 7.2) or the page reloads. → { ok, error? }
  const flush = useCallback(async () => {
    if (!dataRef.current || !loadedRef.current) return { ok: true }
    if (timerRef.current === null && !saveFailedRef.current) return { ok: true }
    clearTimeout(timerRef.current)
    timerRef.current = null
    return saveNow(dataRef.current)
  }, [saveNow])

  useEffect(() => api.onFlushRequest(flush), [flush])

  // The main process enforces the WebUntis switch and address (off or no
  // address = no request at all; switching off or changing the address logs
  // out). Synced here — not in Settings — so every path that changes them
  // counts: the settings, an import, loading the file.
  // Layout effect: runs before any child's passive effect, so the main process
  // already knows the new state when Settings asks for the status right after.
  const webuntisEnabled = data ? data.settings.webuntis?.enabled === true : null
  const webuntisHost = data?.settings.webuntis?.host ?? ''
  const webuntisSchool = data?.settings.webuntis?.school ?? ''
  useLayoutEffect(() => {
    if (webuntisEnabled === null) return
    api.webuntisConfigure({ enabled: webuntisEnabled, host: webuntisHost, school: webuntisSchool }).then(
      (res) => !res.ok && showToast(res.error || 'Abmelden fehlgeschlagen', { kind: 'error', duration: 5000 }),
      () => showToast('WebUntis konnte nicht umgeschaltet werden', { kind: 'error', duration: 5000 })
    )
  }, [webuntisEnabled, webuntisHost, webuntisSchool])

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

  // WebUntis subject → profile label ('' = ignore, null = remove), schema v6
  const setWebuntisSubject = useCallback((profileId, short, label) => {
    setData((d) => ({
      ...d,
      profiles: d.profiles.map((p) =>
        p.id === profileId ? { ...p, webuntisSubjects: setMapping(p.webuntisSubjects, short, label) } : p
      ),
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

  // Only the switch and the address are stored — login state lives in the main
  // process, which follows them via the layout effect above
  const setWebuntisEnabled = useCallback((enabled) => {
    setData((d) => ({ ...d, settings: { ...d.settings, webuntis: { ...d.settings.webuntis, enabled } } }))
  }, [])

  // Address as parsed by parseWebuntisAddress() (host '' = none)
  const setWebuntisAddress = useCallback(({ host, school }) => {
    setData((d) => ({ ...d, settings: { ...d.settings, webuntis: { ...d.settings.webuntis, host, school } } }))
  }, [])

  // ---------------- Setup wizard ----------------

  // Finish: apply the answers (src/lib/setup.js), then create the current week
  // like a normal start would have — it was held back while the wizard was open
  const completeSetup = useCallback((answers) => {
    const today = new Date()
    const next = applySetup(dataRef.current, answers)
    const created = shouldAutoCreate(next, toISO(today)) ? newWeek(mondayOf(today), next.profiles, next.periods) : null
    setData(created ? { ...next, weeks: [...next.weeks, created].sort(byId) } : next)
    setSetupRequested(false)
    showToast(created ? `Eingerichtet — KW ${isoWeek(created.id).week} angelegt` : 'Berichtspilot ist eingerichtet')
  }, [])

  // Skip / close: a fresh install keeps the sample data and won't ask again
  const skipSetup = useCallback(() => {
    setData((d) => (d.settings.setupDone ? d : { ...d, settings: { ...d.settings, setupDone: true } }))
    setSetupRequested(false)
  }, [])

  const openSetup = useCallback(() => setSetupRequested(true), [])
  const setupOpen = Boolean(data) && (data.settings.setupDone === false || setupRequested)

  // Stable references: UpdateHint's toast effect depends on downloadUpdate
  const checkForUpdate = useCallback(() => api.updateCheck().then(keepStatus(setUpdate)), [])
  const downloadUpdate = useCallback(() => api.updateDownload().then(keepStatus(setUpdate)), [])

  // Installing quits the app: write pending changes first (the 400 ms autosave
  // would be lost) and don't install if that fails. Never rejects.
  const installUpdate = useCallback(async () => {
    if (installingRef.current) return { ok: true } // already on its way (other button)
    installingRef.current = true
    setInstallingUpdate(true)
    clearTimeout(timerRef.current)
    timerRef.current = null
    let res
    try {
      const saved = dataRef.current ? await saveNow(dataRef.current) : { ok: true }
      res = saved.ok
        ? await api.updateInstall()
        : { ok: false, error: 'Daten konnten nicht gespeichert werden — Update abgebrochen.' }
    } catch {
      res = { ok: false, error: 'Update konnte nicht installiert werden' }
    }
    // ok → the app quits right away; stay "installing" until it does
    if (!res.ok) {
      installingRef.current = false
      setInstallingUpdate(false)
    }
    return res
  }, [saveNow])

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
    setWebuntisSubject,
    createPeriod,
    updatePeriod,
    deletePeriod,
    updateSettings,
    setWebuntisEnabled,
    setWebuntisAddress,
    exportData,
    importData,
    setupOpen,
    completeSetup,
    skipSetup,
    openSetup,
    flush,
    update,
    checkForUpdate,
    downloadUpdate,
    installUpdate,
    installingUpdate,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore used outside of StoreProvider')
  return ctx
}
