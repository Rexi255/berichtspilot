// Electron-Hauptprozess: Fenster, Ablageort + sicheres Speichern, Datei-I/O über IPC.
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu, MenuItem } = require('electron')
const path = require('path')
const fs = require('fs')
const fsp = fs.promises

// ---------------------------------------------------------------------------
// Ablageort für daten.json. Ziel: die Datei liegt möglichst „portabel" neben
// der Executable (Daten wandern mit, z. B. auf dem USB-Stick), aber die App
// darf NIE abstürzen, wenn dieser Ort schreibgeschützt ist (Installation unter
// C:\Program Files bzw. /usr/bin — dort blockt das OS Schreiben ohne Admin).
//
// Reihenfolge:
//  1. Dev-Modus                     -> Projektordner (CWD), daten.json direkt sichtbar
//  2. Portabler Ort neben der Exe   -> nur wenn wirklich beschreibbar
//       - Windows portable .exe: electron-builder setzt PORTABLE_EXECUTABLE_DIR
//       - Linux AppImage:        APPIMAGE zeigt auf die .AppImage-Datei
//  3. Installiert / Ort nicht beschreibbar -> app.getPath('userData')
//       (Windows: %APPDATA%\Berichtspilot, Linux: ~/.config/Berichtspilot) —
//       immer nutzerspezifisch beschreibbar, kein Admin nötig.
// ---------------------------------------------------------------------------

// Echter Schreibtest statt fs.access(W_OK): Letzteres ist unter Windows wegen
// ACLs/Virtualisierung unzuverlässig. Wir legen kurz eine Probedatei an.
function istBeschreibbar(verzeichnis) {
  const probe = path.join(verzeichnis, `.schreibtest-${process.pid}`)
  try {
    fs.writeFileSync(probe, '')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

function ermittleDatenVerzeichnis() {
  if (!app.isPackaged) return process.cwd()

  const portabel =
    process.env.PORTABLE_EXECUTABLE_DIR ||
    (process.env.APPIMAGE && path.dirname(process.env.APPIMAGE)) ||
    null
  if (portabel && istBeschreibbar(portabel)) return portabel

  return app.getPath('userData')
}

const DATEN_PFAD = path.join(ermittleDatenVerzeichnis(), 'daten.json')

// Wie viele rollierende Sicherungen (daten.json.bak1 … .bakN) wir vorhalten.
const MAX_BACKUPS = 3

/**
 * Vorherigen Speicherstand rollierend sichern, BEVOR daten.json überschrieben
 * wird: .bak2 -> .bak3, .bak1 -> .bak2, daten.json -> .bak1 (Kopie). Es wird
 * kopiert, nicht verschoben, damit daten.json bis zum finalen atomaren rename
 * durchgehend existiert. So bleiben die letzten MAX_BACKUPS Stände erhalten;
 * eine kaputte daten.json kann daraus wiederhergestellt werden.
 */
async function rotiereBackups() {
  try {
    await fsp.access(DATEN_PFAD) // noch keine daten.json -> nichts zu sichern
  } catch {
    return
  }
  await fsp.rm(`${DATEN_PFAD}.bak${MAX_BACKUPS}`, { force: true }).catch(() => {})
  for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
    await fsp.rename(`${DATEN_PFAD}.bak${i}`, `${DATEN_PFAD}.bak${i + 1}`).catch(() => {})
  }
  await fsp.copyFile(DATEN_PFAD, `${DATEN_PFAD}.bak1`).catch(() => {})
}

/**
 * Atomar + abgesichert schreiben. Ein Absturz/Stromausfall darf das über Jahre
 * gewachsene Berichtsheft nie zerstören:
 *  1. Neue Daten vollständig in eine Temp-Datei schreiben und per fsync auf den
 *     Datenträger zwingen — die alte daten.json bleibt dabei unberührt.
 *  2. Bisherigen Stand rollierend sichern (.bak1 … .bakN).
 *  3. Temp-Datei atomar an ihren Platz umbenennen (rename ist auf einer
 *     Partition atomar — daten.json existiert nie halb geschrieben).
 */
async function schreibeDaten(json) {
  const tmp = DATEN_PFAD + '.tmp'
  const fh = await fsp.open(tmp, 'w')
  try {
    await fh.writeFile(json, 'utf8')
    await fh.sync() // Puffer garantiert auf die Platte
  } finally {
    await fh.close()
  }
  await rotiereBackups()
  await fsp.rename(tmp, DATEN_PFAD)
}

let fenster = null

function erstelleFenster() {
  fenster = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 940,
    minHeight: 600,
    frame: false, // eigene Titlebar im Renderer
    backgroundColor: '#0a0c10',
    icon: path.join(__dirname, 'icon.ico'), // Fenster-/Taskbar-Icon (in dist gebündelt)
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  fenster.once('ready-to-show', () => fenster.show())

  // Deutsche Rechtschreibprüfung in den Eingabefeldern. Kann fehlschlagen,
  // wenn das OS kein deutsches Wörterbuch anbietet — dann einfach ohne.
  try {
    fenster.webContents.session.setSpellCheckerLanguages(['de-DE', 'de'])
  } catch {
    /* Sprache nicht verfügbar -> Spellcheck bleibt aus */
  }

  // Kontextmenü: Korrekturvorschläge des Spellcheckers + Standard-Bearbeiten
  fenster.webContents.on('context-menu', (_ev, params) => {
    const menu = new Menu()
    for (const vorschlag of params.dictionarySuggestions.slice(0, 5)) {
      menu.append(
        new MenuItem({
          label: vorschlag,
          click: () => fenster.webContents.replaceMisspelling(vorschlag),
        })
      )
    }
    if (params.misspelledWord) {
      menu.append(
        new MenuItem({
          label: 'Zum Wörterbuch hinzufügen',
          click: () =>
            fenster.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        })
      )
      menu.append(new MenuItem({ type: 'separator' }))
    }
    if (params.isEditable) {
      menu.append(new MenuItem({ label: 'Ausschneiden', role: 'cut' }))
      menu.append(new MenuItem({ label: 'Kopieren', role: 'copy' }))
      menu.append(new MenuItem({ label: 'Einfügen', role: 'paste' }))
    } else if (params.selectionText.trim()) {
      menu.append(new MenuItem({ label: 'Kopieren', role: 'copy' }))
    }
    if (menu.items.length > 0) menu.popup()
  })

  // Maximieren-Status an den Renderer melden (für das Titlebar-Icon)
  const meldeMax = () => {
    if (!fenster.isDestroyed()) {
      fenster.webContents.send('fenster:maximiert', fenster.isMaximized())
    }
  }
  fenster.on('maximize', meldeMax)
  fenster.on('unmaximize', meldeMax)

  // Externe Links im Systembrowser öffnen, nie im App-Fenster
  fenster.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    fenster.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    fenster.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Dev-Helfer: `electron . --screenshot=pfad.png [--view=editor]` rendert die
  // App, speichert einen Screenshot und beendet sich (für UI-Checks ohne Anzeige).
  const shotArg = process.argv.find((a) => a.startsWith('--screenshot='))
  if (shotArg) {
    const zielPfad = shotArg.split('=')[1]
    const viewArg = process.argv.find((a) => a.startsWith('--view='))
    fenster.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (viewArg) {
          const view = viewArg.split('=')[1]
          await fenster.webContents.executeJavaScript(
            `document.querySelector('[data-nav="${view}"]')?.click()`
          )
          await new Promise((r) => setTimeout(r, 900))
        }
        const bild = await fenster.webContents.capturePage()
        await fsp.writeFile(zielPfad, bild.toPNG())
        app.quit()
      }, 1500)
    })
  }
}

// ---------------------------------------------------------------------------
// IPC: Persistenz (Laden/Speichern) + Export/Import über native Dialoge
// ---------------------------------------------------------------------------
ipcMain.handle('daten:laden', async () => {
  // daten.json zuerst, dann die Sicherungen der Reihe nach. Ist die Hauptdatei
  // kaputt (JSON-Fehler nach abgebrochenem Schreiben), wird automatisch der
  // jüngste noch lesbare Backup-Stand genommen.
  const kandidaten = [DATEN_PFAD]
  for (let i = 1; i <= MAX_BACKUPS; i++) kandidaten.push(`${DATEN_PFAD}.bak${i}`)

  let letzterFehler = null
  for (const pfad of kandidaten) {
    try {
      const inhalt = await fsp.readFile(pfad, 'utf8')
      const daten = JSON.parse(inhalt) // wirft bei korrupter Datei
      return { ok: true, daten, pfad: DATEN_PFAD, ausBackup: pfad !== DATEN_PFAD }
    } catch (fehler) {
      if (fehler.code === 'ENOENT') continue // Datei existiert nicht -> nächste
      letzterFehler = fehler // vorhanden, aber kaputt -> Backup versuchen
    }
  }
  // Keine der Dateien existierte -> echter Erststart (kein Fehler)
  if (!letzterFehler) return { ok: true, daten: null, pfad: DATEN_PFAD }
  // Vorhandene Dateien alle unlesbar/korrupt
  return { ok: false, fehler: String(letzterFehler), pfad: DATEN_PFAD }
})

ipcMain.handle('daten:speichern', async (_ev, daten) => {
  try {
    await schreibeDaten(JSON.stringify(daten, null, 2))
    return { ok: true }
  } catch (fehler) {
    return { ok: false, fehler: String(fehler) }
  }
})

ipcMain.handle('daten:exportieren', async (_ev, daten) => {
  const { canceled, filePath } = await dialog.showSaveDialog(fenster, {
    title: 'Daten exportieren',
    defaultPath: `berichtspilot-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (canceled || !filePath) return { ok: false, abgebrochen: true }
  try {
    await fsp.writeFile(filePath, JSON.stringify(daten, null, 2), 'utf8')
    return { ok: true, pfad: filePath }
  } catch (fehler) {
    return { ok: false, fehler: String(fehler) }
  }
})

ipcMain.handle('daten:importieren', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(fenster, {
    title: 'Daten importieren',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return { ok: false, abgebrochen: true }
  try {
    const inhalt = await fsp.readFile(filePaths[0], 'utf8')
    const daten = JSON.parse(inhalt)
    return { ok: true, daten }
  } catch (fehler) {
    return { ok: false, fehler: String(fehler) }
  }
})

// Einzelnen Textblock als .txt exportieren
ipcMain.handle('text:exportieren', async (_ev, { dateiname, inhalt }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(fenster, {
    title: 'Als .txt exportieren',
    defaultPath: dateiname,
    filters: [{ name: 'Text', extensions: ['txt'] }],
  })
  if (canceled || !filePath) return { ok: false, abgebrochen: true }
  try {
    await fsp.writeFile(filePath, inhalt, 'utf8')
    return { ok: true, pfad: filePath }
  } catch (fehler) {
    return { ok: false, fehler: String(fehler) }
  }
})

// Zwischenablage lesen (für „Aus Zwischenablage einfügen" im Editor) —
// der sandboxte Renderer hat keinen verlässlichen Clipboard-Lesezugriff.
ipcMain.handle('zwischenablage:lesen', () => clipboard.readText())

// Ordner der daten.json im Dateimanager anzeigen (Einstellungen -> Daten)
ipcMain.handle('pfad:oeffnen', () => shell.showItemInFolder(DATEN_PFAD))

// Generischer nativer Frage-Dialog (z. B. Import: Zusammenführen/Ersetzen).
// Liefert den Index des geklickten Buttons.
ipcMain.handle('dialog:frage', async (_ev, { titel, nachricht, detail, buttons, cancelId }) => {
  const { response } = await dialog.showMessageBox(fenster, {
    type: 'question',
    title: titel,
    message: nachricht,
    detail,
    buttons,
    cancelId: cancelId ?? buttons.length - 1,
    defaultId: 0,
    noLink: true,
  })
  return response
})

// Fenstersteuerung für die eigene Titlebar
ipcMain.handle('fenster:minimieren', () => fenster?.minimize())
ipcMain.handle('fenster:maximieren', () => {
  if (!fenster) return
  fenster.isMaximized() ? fenster.unmaximize() : fenster.maximize()
})
ipcMain.handle('fenster:schliessen', () => fenster?.close())

// Nur EINE Instanz zulassen: zwei parallel laufende Instanzen würden sich
// gegenseitig die daten.json überschreiben (letzter Speichervorgang gewinnt).
// Ein zweiter Start gibt den Fokus an das bestehende Fenster ab und beendet sich.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (fenster && !fenster.isDestroyed()) {
      if (fenster.isMinimized()) fenster.restore()
      fenster.show()
      fenster.focus()
    }
  })

  app.whenReady().then(() => {
    erstelleFenster()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) erstelleFenster()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
