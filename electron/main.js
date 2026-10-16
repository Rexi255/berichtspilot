// Electron main process: window, data location + safe saving, file I/O via IPC.
// User-facing strings (dialogs, menus) are German.
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu, MenuItem, session } = require('electron')
const path = require('path')
const fs = require('fs')
const fsp = fs.promises
const { createWebUntisSession, cleanServer, PARTITION: WEBUNTIS_PARTITION } = require('./webuntis-session')
const { fetchWeek } = require('./webuntis')
const { createUpdater } = require('./updater')
const { ALLOWED_PERMISSIONS, createAppUrlCheck, isTrustedSender, checkSaveData } = require('./guard')
const { createStorage } = require('./storage')

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

// Loading, atomic saving and backups: electron/storage.js (E-003, step 7.2)
const storage = createStorage({ dataPath: DATA_PATH })

let win = null

// The app's own page (step 7.1): the dev server only in an unpacked dev run —
// a packaged app never loads a URL from the environment
const DEV_SERVER_URL = app.isPackaged ? null : process.env.VITE_DEV_SERVER_URL || null
const INDEX_FILE = path.join(__dirname, '..', 'dist', 'index.html')
const isAppUrl = createAppUrlCheck({ devServerUrl: DEV_SERVER_URL, indexFile: INDEX_FILE })

/**
 * ipcMain.handle for the app page only: calls from any other page (the window
 * navigated away, an iframe, another window) are refused before `fn` runs.
 */
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event, { webContents: win?.webContents, isAppUrl })) {
      return { ok: false, code: 'forbidden', error: 'Anfrage abgelehnt.' }
    }
    return fn(event, ...args)
  })
}

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

  // Closing writes the renderer's pending autosave first (step 7.2): the close
  // is held back, the renderer flushes and answers, then the window closes for
  // real. A failed save asks before anything is lost; a renderer that crashed
  // or doesn't answer in time doesn't block closing.
  let closeAllowed = false
  win.on('close', (event) => {
    if (closeAllowed || win.webContents.isCrashed()) return
    event.preventDefault()
    if (flushWaiter) return // already asking
    flushRenderer().then(async (result) => {
      if (win.isDestroyed()) return
      if (result.ok === false) {
        const { response } = await dialog.showMessageBox(win, {
          type: 'warning',
          title: 'Nicht gespeichert',
          message: 'Die letzten Änderungen konnten nicht gespeichert werden.',
          detail: `${result.error || ''}\n\nBeim Schließen gehen sie verloren.`.trim(),
          buttons: ['Trotzdem schließen', 'Abbrechen'],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
        })
        if (response !== 0) return
      }
      closeAllowed = true
      win.close()
    })
  })

  // The window shows the app and nothing else (step 7.1): no navigation away
  // (a file dropped onto the window, a link without target), no <webview>.
  // External links open in the browser via the window open handler below.
  const stayOnApp = (event, url) => {
    if (!isAppUrl(event.url ?? url)) event.preventDefault()
  }
  win.webContents.on('will-navigate', stayOnApp)
  win.webContents.on('will-redirect', stayOnApp)
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())
  // Only the permissions the app needs, only for its own page
  win.webContents.session.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(
      contents === win.webContents &&
        ALLOWED_PERMISSIONS.has(permission) &&
        isAppUrl(details?.requestingUrl ?? contents.getURL())
    )
  })

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

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL)
  } else {
    win.loadFile(INDEX_FILE)
  }

  // Dev helper: `electron . --screenshot=path.png [--view=editor] [--scroll=selector]`
  // renders the app, saves a screenshot and quits (for UI checks without a
  // display). `--scroll` brings an element below the fold into view first.
  // Unpacked runs only — the installed app ignores these flags.
  const shotArg = !app.isPackaged && process.argv.find((a) => a.startsWith('--screenshot='))
  if (shotArg) {
    const targetPath = shotArg.slice('--screenshot='.length)
    const viewArg = process.argv.find((a) => a.startsWith('--view='))
    const scrollArg = process.argv.find((a) => a.startsWith('--scroll='))
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (viewArg) {
          const selector = JSON.stringify(`[data-nav="${viewArg.split('=')[1].replace(/[^\w-]/g, '')}"]`)
          await win.webContents.executeJavaScript(`document.querySelector(${selector})?.click()`)
          await new Promise((r) => setTimeout(r, 900))
        }
        if (scrollArg) {
          const selector = JSON.stringify(scrollArg.slice('--scroll='.length))
          await win.webContents.executeJavaScript(
            `document.querySelector(${selector})?.scrollIntoView({ block: 'start' })`
          )
          await new Promise((r) => setTimeout(r, 300))
        }
        const image = await win.webContents.capturePage()
        await fsp.writeFile(targetPath, image.toPNG())
        app.quit()
      }, 1500)
    })
  }
}

// ---------------------------------------------------------------------------
// Flush on close (step 7.2): main asks with `app:flush`, the preload answers
// with `app:flushed` once the renderer's pending save is written
// ---------------------------------------------------------------------------
const FLUSH_TIMEOUT_MS = 3000
let flushWaiter = null

/** Ask the renderer to save now → `{ ok, error? }` (`ok` also on timeout). */
function flushRenderer() {
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish({ ok: true, timedOut: true }), FLUSH_TIMEOUT_MS)
    function finish(result) {
      clearTimeout(timer)
      flushWaiter = null
      resolve(result && typeof result === 'object' ? result : { ok: true })
    }
    flushWaiter = finish
    win.webContents.send('app:flush')
  })
}

handle('app:flushed', (_ev, result) => {
  flushWaiter?.({ ok: result?.ok !== false, error: typeof result?.error === 'string' ? result.error : undefined })
  return { ok: true }
})

// ---------------------------------------------------------------------------
// IPC: persistence (load/save) + export/import via native dialogs
// ---------------------------------------------------------------------------
handle('data:load', () => storage.load())

handle('data:save', async (_ev, data) => {
  const invalid = checkSaveData(data)
  if (invalid) return { ok: false, error: invalid }
  return storage.save(JSON.stringify(data, null, 2))
})

handle('data:export', async (_ev, data) => {
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

handle('data:import', async () => {
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
handle('text:export', async (_ev, { fileName, content }) => {
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
handle('clipboard:read', () => clipboard.readText())

// Show daten.json in the file manager (Settings -> Daten)
handle('path:reveal', () => shell.showItemInFolder(DATA_PATH))

// Generic native question dialog (e.g. import: merge/replace).
// Returns the index of the clicked button.
handle('dialog:ask', async (_ev, { title, message, detail, buttons, cancelId }) => {
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

// WebUntis (E-013, path W1). The bearer token stays in main; the renderer only
// gets status objects and the trimmed week. Renderer input: switch + address
// (checked by cleanServer(): only *.webuntis.com hosts, E-019) and a Monday date
// (validated in fetchWeek).
const webuntis = createWebUntisSession()
handle('webuntis:status', () => webuntis.status())
handle('webuntis:login', () => webuntis.openLogin({ parent: win }))
handle('webuntis:logout', () => webuntis.logout())
handle('webuntis:configure', (_e, config) =>
  webuntis.configure({ enabled: config?.enabled === true, host: config?.host, school: config?.school })
)
handle('webuntis:week', (_e, mondayISO) =>
  fetchWeek(webuntis, mondayISO, { ses: session.fromPartition(WEBUNTIS_PARTITION) })
)

// Auto-update (E-017): check only when asked (renderer on start if
// settings.updateCheck is on, or by hand), download + install only on click.
// No renderer input besides the call itself.
const updater = createUpdater({
  app,
  onChange: (status) => {
    if (win && !win.isDestroyed()) win.webContents.send('update:changed', status)
  },
})
handle('update:status', () => updater.status())
handle('update:check', () => updater.check())
handle('update:download', () => updater.download())
handle('update:install', () => updater.install())

// Window controls for the custom title bar
handle('window:minimize', () => win?.minimize())
handle('window:maximize', () => {
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
handle('window:close', () => win?.close())

// Dev spike: `electron . --webuntis-probe` runs the WebUntis probe instead of
// the app (DECISIONS E-013). It only reads the WebUntis address from
// daten.json (E-019) and writes webuntis-probe.json next to it.
const PROBE_MODE = process.argv.includes('--webuntis-probe')

async function startWebUntisProbe() {
  let server = null
  try {
    server = cleanServer(JSON.parse(await fsp.readFile(DATA_PATH, 'utf8'))?.settings?.webuntis)
  } catch {
    // no or unreadable daten.json → no address
  }
  if (!server) {
    dialog.showErrorBox(
      'WebUntis-Probe',
      'Keine WebUntis-Adresse gefunden. Bitte zuerst in Berichtspilot unter Einstellungen → Verbindungen eintragen.'
    )
    return app.quit()
  }
  const { runWebUntisProbe } = require('./webuntis-probe')
  return runWebUntisProbe({ outFile: path.join(path.dirname(DATA_PATH), 'webuntis-probe.json'), server })
}

// Allow only ONE instance: two instances running in parallel would overwrite
// each other's daten.json (last save wins). A second start hands focus to the
// existing window and quits.
if (!app.requestSingleInstanceLock()) {
  if (PROBE_MODE) console.error('Berichtspilot läuft bereits — bitte schließen und die Probe erneut starten.')
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
    if (PROBE_MODE) {
      return startWebUntisProbe()
    }
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// A write still running when the last window closed finishes before the app
// exits (step 7.2) — quitting mid-write would drop the newest state
app.on('will-quit', (event) => {
  if (!storage.busy()) return
  event.preventDefault()
  storage.idle().then(() => app.quit())
})
