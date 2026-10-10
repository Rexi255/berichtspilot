// Electron main process: window, data location + safe saving, file I/O via IPC.
// User-facing strings (dialogs, menus) are German.
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu, MenuItem } = require('electron')
const path = require('path')
const fs = require('fs')
const fsp = fs.promises

// ---------------------------------------------------------------------------
// Location of daten.json. Goal: keep the file "portable" next to the
// executable whenever possible (data travels along, e.g. on a USB stick), but
// the app must NEVER crash when that location is read-only (installed under
// C:\Program Files or /usr/bin — the OS blocks writes there without admin).
//
// Order:
//  1. Dev mode                         -> project folder (CWD), daten.json directly visible
//  2. Portable location next to the exe -> only if actually writable
//       - Windows portable .exe: electron-builder sets PORTABLE_EXECUTABLE_DIR
//       - Linux AppImage:        APPIMAGE points to the .AppImage file
//  3. Installed / location not writable -> app.getPath('userData')
//       (Windows: %APPDATA%\Berichtspilot, Linux: ~/.config/Berichtspilot) —
//       always writable per user, no admin needed.
// ---------------------------------------------------------------------------

// A real write test instead of fs.access(W_OK): the latter is unreliable on
// Windows because of ACLs/virtualization. We briefly create a probe file.
function isWritable(dir) {
  const probe = path.join(dir, `.write-test-${process.pid}`)
  try {
    fs.writeFileSync(probe, '')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

function resolveDataDir() {
  if (!app.isPackaged) return process.cwd()

  const portable =
    process.env.PORTABLE_EXECUTABLE_DIR ||
    (process.env.APPIMAGE && path.dirname(process.env.APPIMAGE)) ||
    null
  if (portable && isWritable(portable)) return portable

  return app.getPath('userData')
}

// The file name stays German for compatibility with existing installs (DECISIONS E-014)
const DATA_PATH = path.join(resolveDataDir(), 'daten.json')

// How many rolling backups (daten.json.bak1 … .bakN) we keep.
const MAX_BACKUPS = 3

/**
 * Back up the previous state, rolling, BEFORE daten.json is overwritten:
 * .bak2 -> .bak3, .bak1 -> .bak2, daten.json -> .bak1 (copy). We copy instead
 * of moving so daten.json keeps existing until the final atomic rename. That
 * way the last MAX_BACKUPS states survive and a corrupted daten.json can be
 * restored from them.
 */
async function rotateBackups() {
  try {
    await fsp.access(DATA_PATH) // no daten.json yet -> nothing to back up
  } catch {
    return
  }
  await fsp.rm(`${DATA_PATH}.bak${MAX_BACKUPS}`, { force: true }).catch(() => {})
  for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
    await fsp.rename(`${DATA_PATH}.bak${i}`, `${DATA_PATH}.bak${i + 1}`).catch(() => {})
  }
  await fsp.copyFile(DATA_PATH, `${DATA_PATH}.bak1`).catch(() => {})
}

/**
 * Write atomically and safely. A crash/power failure must never destroy a
 * training record that grew over years:
 *  1. Write the new data completely into a temp file and force it to disk
 *     via fsync — the old daten.json stays untouched meanwhile.
 *  2. Back up the previous state, rolling (.bak1 … .bakN).
 *  3. Atomically rename the temp file into place (rename is atomic within one
 *     partition — daten.json never exists half-written).
 */
async function writeData(json) {
  const tmp = DATA_PATH + '.tmp'
  const fh = await fsp.open(tmp, 'w')
  try {
    await fh.writeFile(json, 'utf8')
    await fh.sync() // buffers guaranteed on disk
  } finally {
    await fh.close()
  }
  await rotateBackups()
  await fsp.rename(tmp, DATA_PATH)
}

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 940,
    minHeight: 600,
    frame: false, // custom title bar in the renderer
    backgroundColor: '#0a0c10',
    icon: path.join(__dirname, 'icon.ico'), // window/taskbar icon (bundled)
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  // German spell checking in input fields. May fail if the OS offers no German
  // dictionary — then we simply go without.
  try {
    win.webContents.session.setSpellCheckerLanguages(['de-DE', 'de'])
  } catch {
    /* language not available -> spell check stays off */
  }

  // Context menu: spell checker suggestions + standard edit actions
  win.webContents.on('context-menu', (_ev, params) => {
    const menu = new Menu()
    for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => win.webContents.replaceMisspelling(suggestion),
        })
      )
    }
    if (params.misspelledWord) {
      menu.append(
        new MenuItem({
          label: 'Zum Wörterbuch hinzufügen',
          click: () =>
            win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
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

  // Report the maximized state to the renderer (for the title bar icon)
  const reportMaximized = () => {
    if (!win.isDestroyed()) {
      win.webContents.send('window:maximized', win.isMaximized())
    }
  }
  win.on('maximize', reportMaximized)
  win.on('unmaximize', reportMaximized)

  // Open external links in the system browser, never in the app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Dev helper: `electron . --screenshot=path.png [--view=editor]` renders the
  // app, saves a screenshot and quits (for UI checks without a display).
  const shotArg = process.argv.find((a) => a.startsWith('--screenshot='))
  if (shotArg) {
    const targetPath = shotArg.split('=')[1]
    const viewArg = process.argv.find((a) => a.startsWith('--view='))
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (viewArg) {
          const view = viewArg.split('=')[1]
          await win.webContents.executeJavaScript(
            `document.querySelector('[data-nav="${view}"]')?.click()`
          )
          await new Promise((r) => setTimeout(r, 900))
        }
        const image = await win.webContents.capturePage()
        await fsp.writeFile(targetPath, image.toPNG())
        app.quit()
      }, 1500)
    })
  }
}

// ---------------------------------------------------------------------------
// IPC: persistence (load/save) + export/import via native dialogs
// ---------------------------------------------------------------------------
ipcMain.handle('data:load', async () => {
  // daten.json first, then the backups in order. If the main file is corrupt
  // (JSON error after an aborted write), the newest readable backup is used.
  const candidates = [DATA_PATH]
  for (let i = 1; i <= MAX_BACKUPS; i++) candidates.push(`${DATA_PATH}.bak${i}`)

  let lastError = null
  for (const file of candidates) {
    try {
      const content = await fsp.readFile(file, 'utf8')
      const data = JSON.parse(content) // throws for a corrupt file
      return { ok: true, data, path: DATA_PATH, fromBackup: file !== DATA_PATH }
    } catch (error) {
      if (error.code === 'ENOENT') continue // file doesn't exist -> next one
      lastError = error // exists but is broken -> try a backup
    }
  }
  // None of the files existed -> genuine first start (not an error)
  if (!lastError) return { ok: true, data: null, path: DATA_PATH }
  // Existing files are all unreadable/corrupt
  return { ok: false, error: String(lastError), path: DATA_PATH }
})

ipcMain.handle('data:save', async (_ev, data) => {
  try {
    await writeData(JSON.stringify(data, null, 2))
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('data:export', async (_ev, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Daten exportieren',
    defaultPath: `berichtspilot-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (canceled || !filePath) return { ok: false, canceled: true }
  try {
    await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
    return { ok: true, path: filePath }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Daten importieren',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return { ok: false, canceled: true }
  try {
    const content = await fsp.readFile(filePaths[0], 'utf8')
    const data = JSON.parse(content)
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

// Export a single text block as .txt
ipcMain.handle('text:export', async (_ev, { fileName, content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Als .txt exportieren',
    defaultPath: fileName,
    filters: [{ name: 'Text', extensions: ['txt'] }],
  })
  if (canceled || !filePath) return { ok: false, canceled: true }
  try {
    await fsp.writeFile(filePath, content, 'utf8')
    return { ok: true, path: filePath }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

// Read the clipboard (for "Aus Zwischenablage" in the editor) — the sandboxed
// renderer has no reliable clipboard read access.
ipcMain.handle('clipboard:read', () => clipboard.readText())

// Show daten.json in the file manager (Settings -> Daten)
ipcMain.handle('path:reveal', () => shell.showItemInFolder(DATA_PATH))

// Generic native question dialog (e.g. import: merge/replace).
// Returns the index of the clicked button.
ipcMain.handle('dialog:ask', async (_ev, { title, message, detail, buttons, cancelId }) => {
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    title,
    message,
    detail,
    buttons,
    cancelId: cancelId ?? buttons.length - 1,
    defaultId: 0,
    noLink: true,
  })
  return response
})

// Window controls for the custom title bar
ipcMain.handle('window:minimize', () => win?.minimize())
ipcMain.handle('window:maximize', () => {
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.handle('window:close', () => win?.close())

// Allow only ONE instance: two instances running in parallel would overwrite
// each other's daten.json (last save wins). A second start hands focus to the
// existing window and quits.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
