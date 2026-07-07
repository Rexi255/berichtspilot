// Electron-Hauptprozess: Fenster, portabler Basispfad, Datei-I/O über IPC.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const fsp = fs.promises

// ---------------------------------------------------------------------------
// Portabler Basispfad: daten.json liegt IMMER neben der Executable.
//  1. Windows portable .exe  -> electron-builder setzt PORTABLE_EXECUTABLE_DIR
//  2. Linux AppImage         -> APPIMAGE zeigt auf die .AppImage-Datei
//  3. Dev-Modus              -> Projektordner (CWD)
// ---------------------------------------------------------------------------
function ermittleBasisPfad() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR
  }
  if (process.env.APPIMAGE) {
    return path.dirname(process.env.APPIMAGE)
  }
  if (app.isPackaged) {
    // Gepackt, aber weder portable.exe noch AppImage (z. B. entpackter Ordner)
    return path.dirname(app.getPath('exe'))
  }
  return process.cwd()
}

const DATEN_PFAD = path.join(ermittleBasisPfad(), 'daten.json')

// Atomar schreiben: erst Temp-Datei, dann umbenennen — verhindert kaputte
// daten.json bei Absturz mitten im Schreibvorgang.
async function schreibeDaten(json) {
  const tmp = DATEN_PFAD + '.tmp'
  await fsp.writeFile(tmp, json, 'utf8')
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
    },
  })

  fenster.once('ready-to-show', () => fenster.show())

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
  try {
    const inhalt = await fsp.readFile(DATEN_PFAD, 'utf8')
    return { ok: true, daten: JSON.parse(inhalt), pfad: DATEN_PFAD }
  } catch (fehler) {
    if (fehler.code === 'ENOENT') return { ok: true, daten: null, pfad: DATEN_PFAD }
    return { ok: false, fehler: String(fehler), pfad: DATEN_PFAD }
  }
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

// Fenstersteuerung für die eigene Titlebar
ipcMain.handle('fenster:minimieren', () => fenster?.minimize())
ipcMain.handle('fenster:maximieren', () => {
  if (!fenster) return
  fenster.isMaximized() ? fenster.unmaximize() : fenster.maximize()
})
ipcMain.handle('fenster:schliessen', () => fenster?.close())

app.whenReady().then(() => {
  erstelleFenster()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) erstelleFenster()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
