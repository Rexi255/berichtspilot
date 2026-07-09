// Preload: schmale, explizite Brücke zwischen Renderer und Main-Prozess.
// Der Renderer bekommt NUR diese Funktionen — kein Node, kein fs, kein ipcRenderer.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Persistenz (daten.json neben der Executable)
  datenLaden: () => ipcRenderer.invoke('daten:laden'),
  datenSpeichern: (daten) => ipcRenderer.invoke('daten:speichern', daten),

  // Backup über native Dialoge
  datenExportieren: (daten) => ipcRenderer.invoke('daten:exportieren', daten),
  datenImportieren: () => ipcRenderer.invoke('daten:importieren'),

  // Einzelne Ausgabeblöcke als .txt speichern
  textExportieren: (dateiname, inhalt) =>
    ipcRenderer.invoke('text:exportieren', { dateiname, inhalt }),

  // Zwischenablage lesen (Import von Stichpunkten aus Zeiterfassung/WebUntis)
  zwischenablageLesen: () => ipcRenderer.invoke('zwischenablage:lesen'),

  // Ordner der daten.json im Dateimanager anzeigen
  pfadOeffnen: () => ipcRenderer.invoke('pfad:oeffnen'),

  // Nativer Frage-Dialog; liefert den Index des geklickten Buttons
  frageDialog: (optionen) => ipcRenderer.invoke('dialog:frage', optionen),

  // Fenstersteuerung (eigene Titlebar)
  minimieren: () => ipcRenderer.invoke('fenster:minimieren'),
  maximieren: () => ipcRenderer.invoke('fenster:maximieren'),
  schliessen: () => ipcRenderer.invoke('fenster:schliessen'),
  onMaximiert: (callback) => {
    const handler = (_ev, istMax) => callback(istMax)
    ipcRenderer.on('fenster:maximiert', handler)
    return () => ipcRenderer.removeListener('fenster:maximiert', handler)
  },
})
