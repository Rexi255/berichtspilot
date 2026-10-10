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
