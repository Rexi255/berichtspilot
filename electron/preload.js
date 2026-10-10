// Preload: narrow, explicit bridge between renderer and main process.
// The renderer gets ONLY these functions — no Node, no fs, no ipcRenderer.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Persistence (daten.json, location resolved in main)
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),

  // Backup via native dialogs
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),

  // Save a single output block as .txt
  exportText: (fileName, content) => ipcRenderer.invoke('text:export', { fileName, content }),

  // Read the clipboard (bullets from time tracking/WebUntis)
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),

  // Show the folder containing daten.json in the file manager
  revealDataFile: () => ipcRenderer.invoke('path:reveal'),

  // Native question dialog; returns the index of the clicked button
  askDialog: (options) => ipcRenderer.invoke('dialog:ask', options),

  // WebUntis session (switch + address, login window, status, logout) → { ok, loggedIn, personId?, code?, error? }
  webuntisStatus: () => ipcRenderer.invoke('webuntis:status'),
  webuntisLogin: () => ipcRenderer.invoke('webuntis:login'),
  webuntisLogout: () => ipcRenderer.invoke('webuntis:logout'),
  webuntisConfigure: ({ enabled, host, school } = {}) =>
    ipcRenderer.invoke('webuntis:configure', { enabled: enabled === true, host: String(host ?? ''), school: String(school ?? '') }),
  // One timetable week (Mon–Sat) incl. lesson topics → { ok, days } (see electron/webuntis.js)
  webuntisWeek: (mondayISO) => ipcRenderer.invoke('webuntis:week', String(mondayISO)),

  // Auto-update (electron/updater.js) → { ok, state, current, version?, percent?, code?, error? }
  updateStatus: () => ipcRenderer.invoke('update:status'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  // Quits the app — save daten.json first (installUpdate in src/store.jsx does) → { ok, error? }
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdateChanged: (callback) => {
    const handler = (_ev, status) => callback(status)
    ipcRenderer.on('update:changed', handler)
    return () => ipcRenderer.removeListener('update:changed', handler)
  },

  // Window controls (custom title bar)
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  onMaximized: (callback) => {
    const handler = (_ev, isMaximized) => callback(isMaximized)
    ipcRenderer.on('window:maximized', handler)
    return () => ipcRenderer.removeListener('window:maximized', handler)
  },
})
