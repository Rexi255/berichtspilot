# Architecture

Keep this file in sync when changing process boundaries, IPC or networking.

## Processes

```
┌──────────────────────────── Main process (Node) ─────────────────────────────┐
│ electron/main.js                                                             │
│  · frameless window, context menu + spell check (de-DE)                      │
│  · resolve daten.json location, atomic save, rolling backups .bak1–3         │
│  · native dialogs (export/import/ask), clipboard, reveal in file manager     │
│  · single-instance lock                                                      │
│ electron/net.js         network layer: allowlist, timeout, German errors     │
│ electron/webuntis-*.js  WebUntis login window, token, week fetch (E-013)     │
│ electron/updater.js     auto-update via electron-updater (E-017)             │
└──────────────▲───────────────────────────────────────────────────────────────┘
               │ IPC (ipcMain.handle ↔ ipcRenderer.invoke)
┌──────────────┴──── electron/preload.js (contextBridge) ──────────────────────┐
│  window.api = { loadData, saveData, … }  — the only bridge                   │
└──────────────▲───────────────────────────────────────────────────────────────┘
               │
┌──────────────┴──── Renderer (Chromium, sandboxed, strict CSP) ───────────────┐
│ src/main.jsx → App.jsx (shell: Titlebar, Sidebar, GSAP view transitions)     │
│ src/store.jsx  StoreProvider: loads on start, holds `data`, 400 ms autosave  │
│ src/views/*    Overview · WeekEditor (+ PhrasingPanel, WebuntisPanel) ·      │
│                Profiles · Settings · SetupWizard                             │
│ src/ui/*       Titlebar · Sidebar · UpdateHint · basics · toast              │
│ src/lib/*      pure logic: dates · holidays · format · model · notes ·       │
│                phrasing · webuntis · update · setup                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data flow

1. Start: `store.jsx` → `api.loadData()` → main reads `daten.json` (fallback: newest
   intact `.bakN`) → `migrateData()` upgrades old schemas → `setData`.
   No file ⇒ `seedData()` with `settings.setupDone: false` ⇒ `App.jsx` shows
   `SetupWizard` instead of the shell (also when opened from Settings, store
   flag `setupOpen`); the current week is auto-created only after it (E-020).
2. Every store mutation produces a new `data` object (immutable updates).
3. A debounced effect (400 ms) → `api.saveData(data)` → main writes
   `daten.json.tmp` + fsync → rotates backups → `rename` onto `daten.json`.
4. Output: `WeekEditor` calls `formatAll(week)` from `src/lib/format.js` → copy via
   `navigator.clipboard.writeText`.
5. AI phrasing (clipboard bridge, E-011): `PhrasingPanel` builds a prompt from the
   days' `notes` (`buildPrompt()` in `src/lib/phrasing.js`), the user copies it into
   a chat AI of their choice and pastes the answer back; `parseResponse()` maps it
   to bullets per day, the user reviews and applies (undoable). **No network
   access** — the user moves the text; `findSensitive()` warns about e-mail/IP/
   ticket/phone patterns before copying.

In a plain browser (`vite` without Electron), `browserApi` in `store.jsx` replaces
the bridge with `localStorage` stubs — handy for smoke tests.

## IPC channels

| Channel | preload function | Purpose / result |
|---|---|---|
| `data:load` | `loadData()` | read daten.json (or a backup) → `{ ok, data, path, fromBackup, error }` |
| `data:save` | `saveData(data)` | atomic write → `{ ok, error }` |
| `data:export` | `exportData(data)` | save dialog, write JSON → `{ ok, path, canceled, error }` |
| `data:import` | `importData()` | open dialog, read JSON (validated in renderer) → `{ ok, data, canceled, error }` |
| `text:export` | `exportText(fileName, content)` | save one output block as .txt |
| `clipboard:read` | `readClipboard()` | clipboard text |
| `path:reveal` | `revealDataFile()` | show daten.json in the file manager |
| `dialog:ask` | `askDialog(opts)` | native question dialog → button index |
| `window:minimize` / `window:maximize` / `window:close` | `minimize()` / `maximize()` / `close()` | custom title bar |
| `window:maximized` (event main → renderer) | `onMaximized(cb)` | maximized state |
| `webuntis:configure` | `webuntisConfigure({ enabled, host, school })` | mirror `settings.webuntis` into main (synced by `src/store.jsx` on load and every change). `cleanServer()` accepts only a `<name>.webuntis.com` host (E-019); off = `code: 'disabled'`, no valid address = `code: 'no-server'`, both without a request. Switching off or changing the address logs out → `{ ok, error? }` |
| `webuntis:status` | `webuntisStatus()` | WebUntis session → `{ ok, loggedIn, personId?, code?, error? }` (never the token) |
| `webuntis:login` | `webuntisLogin()` | open the isolated login window; resolves on detected login or window close → same shape as status |
| `webuntis:logout` | `webuntisLogout()` | wipe the `persist:webuntis` partition + token → `{ ok, error? }` |
| `update:status` | `updateStatus()` | auto-update status (`electron/updater.js`) → `{ ok, state, current, version?, percent?, code?, error? }`; `state` = `idle`/`checking`/`available`/`none`/`downloading`/`ready`/`error`/`unsupported`, `ok` is false only for `error` |
| `update:check` | `updateCheck()` | ask GitHub for a newer release (never downloads) → status. `unsupported` (dev, portable, Linux without AppImage) answers without a request. Called by `src/store.jsx` once after load while `settings.updateCheck` is on; by hand always |
| `update:download` | `updateDownload()` | download the release found by the last check (only after a click) → status; progress via `update:changed` |
| `update:install` | `updateInstall()` | `quitAndInstall(silent, runAfter)` — only in state `ready` → `{ ok, error? }`. The renderer calls it through `installUpdate()` in the store, which saves `daten.json` first |
| `update:changed` (event main → renderer) | `onUpdateChanged(cb)` | every status change incl. whole-percent download progress |
| `webuntis:week` | `webuntisWeek(mondayISO)` | timetable Mon–Sat + "Lehrstoff" per lesson block (`electron/webuntis.js`; ≤ 3 detail calls at once, a failed one leaves `topics` empty) → `{ ok, days: [{ date, holiday, lessons: [{ start, end, status, subjectShort, subjectLong, topics[] }] }] }` or `{ ok: false, code, error }` — no teacher/class/room names, no `notesAll`, no ids. Normalised by `schoolDaysFromWebuntis()` in `src/lib/webuntis.js`. Renderer calls it only while `settings.webuntis.enabled`; main enforces the switch anyway (`code: 'disabled'`) |

## Networking

The renderer has **no network access** (CSP `connect-src` allows only localhost
for Vite HMR). Rule (E-007): requests only from the main process, only to hosts
in this allowlist, each with a reason; every network feature can be switched off.

| Host | Purpose | Since |
|---|---|---|
| the user's WebUntis host — only `<name>.webuntis.com` | WebUntis: timetable + lesson topics (E-013). Entered in Settings → "Verbindungen" (`settings.webuntis.host`, E-019), checked by `isWebuntisHost()` in `electron/net.js` and passed per request (`hosts`), nothing built in. Session handling (`electron/webuntis-session.js`: token from `/api/token/new`), week fetch (`electron/webuntis.js`: `timetable/entries`, `calendar-entry/detail`) + the probe (`--webuntis-probe`, reads the address from daten.json) | 2026-10 (step 4.1; own address since E-019) |
| `github.com` | Auto-update (E-017): electron-updater reads `/Rexi255/berichtspilot/releases.atom`, `/releases/latest` and `/releases/download/<tag>/latest*.yml` + the installer/AppImage. Public repo, no token. `UPDATE_HOSTS` in `electron/net.js`, enforced on the `electron-updater` partition | 2026-10 (step 5.2) |
| `release-assets.githubusercontent.com` | Auto-update (E-017): GitHub redirects every release download there (checked 2026-10-10). Only reached via that redirect | 2026-10 (step 5.2) |

A school's SSO portal (e.g. a separate login host) is only *navigated to* inside
the isolated login window; the main process never sends requests there.

The renderer CSP is unchanged: WebUntis runs in its own window, never in the app
window.

**WebUntis session (E-013, W1):** `createWebUntisSession()` in
`electron/webuntis-session.js` owns the login window (partition
`persist:webuntis`, sandbox, no preload, https-only navigation, pop-ups stay in
the partition, all permission requests denied) and the 15-min bearer token
(cached in memory, renewed 60 s before `exp`, concurrent callers share one
request). Only main-process code may call `getToken()`; the renderer sees just
`loggedIn` and `personId`. `logout()` clears the partition's storage.

**Settings → "Verbindungen" (step 4.4):** the renderer calls
`webuntisStatus()` only while `settings.webuntis.enabled` is true. The switch
and the address are enforced in main: `src/store.jsx` mirrors them via
`webuntisConfigure()`, and while off (or without a valid address) every
token/status/login call answers `code: 'disabled'` (`'no-server'`) without a
request; switching off or changing the address logs out (wipes the local
partition). The address field parses what the user pastes with
`parseWebuntisAddress()` (`src/lib/webuntis.js`): host + `school` from the query
or hash route; the login window opens `https://<host>/WebUntis/?school=<school>`. The login does
not survive an app restart (session cookie), so "Nicht angemeldet" is the
normal state after start — and `status()` answers it from memory, without a
request, until a login succeeds.

**Week fetch (step 4.5a):** `fetchWeek(session, mondayISO, { ses })` in
`electron/webuntis.js` validates the Monday, asks `session.getToken()` before
every call (headers `Authorization: Bearer` + `Tenant-Id`), loads
`timetable/entries` for Mon–Sat, then `calendar-entry/detail` for every
non-cancelled lesson block (exact block times, at most 3 in flight). It returns
only subject short/long name, times, status and `teachingContent` topics — the
raw answers (teachers, rooms, classes, `notesAll`) never cross IPC.

**Auto-update (step 5.2, E-017):** `createUpdater()` in `electron/updater.js`
wraps electron-updater's `autoUpdater` (`autoDownload` and
`autoInstallOnAppQuit` off, logger off). electron-updater sends its requests
through its own session partition `electron-updater`, not through `net.js`; before
the first request, `webRequest.onBeforeRequest` on that partition cancels every
URL that isn't https to `UPDATE_HOSTS` (redirects included — a cancelled request
surfaces as `code: 'blocked'`); `onBeforeSendHeaders` strips electron-updater's
per-install `x-user-staging-id`. Only the packaged NSIS install (uninstaller next
to the exe) and the AppImage can update (`updateSupport()`); everything else is
`unsupported` and never loads electron-updater. A newest release without `latest*.yml`
(`ERR_UPDATER_CHANNEL_FILE_NOT_FOUND`, e.g. v1.2.0) counts as "no update", not as
an error. Errors get German texts via `describeUpdateError()` (network cases
reuse `describeFailure()`).

### Network layer `electron/net.js` (step 4.2)

All app requests go through `request(url, { ses, method, headers, body, expect, timeoutMs })`:

- refuses anything that is not `https://` to a host in `ALLOWED_HOSTS` (kept in
  sync with the table above) — no credentials in the URL, default port only;
- uses the given Electron session's `fetch` (cookies of e.g. `persist:webuntis`,
  `credentials: 'include'`), aborts after 15 s;
- `redirect: 'manual'` — redirects are never followed (they could leave the
  allowlist); Electron rejects them with "Redirect was cancelled", which counts
  as "session expired" because WebUntis redirects to its login page. With
  `expect: 'json'`, an HTML answer counts the same way;
- never throws: `{ ok: true, status, data }` (JSON parsed, otherwise text) or
  `{ ok: false, code, error, status? }` with codes `blocked · timeout · offline ·
  tls · network · auth · not-found · rate-limit · server · http · parse` and a
  German `error` text ready for the UI.

Used by the WebUntis session and week fetch; the probe still uses `ses.fetch` directly.

### WebUntis probe (dev spike, step 4.1)

`electron . --webuntis-probe` runs `electron/webuntis-probe.js` **instead of** the
app (no app window, no IPC, daten.json untouched):

- a `BrowserWindow` with partition `persist:webuntis`, `sandbox: true`, no preload
  shows the WebUntis login; SSO pop-ups stay in the same partition;
- the main process polls `GET /WebUntis/api/token/new` with that session
  (`ses.fetch`, `credentials: 'include'`) to detect the login;
- the window's `webContents.debugger` (Chrome DevTools protocol, `Network.*`)
  records the web UI's XHR/fetch calls to the WebUntis host incl. response
  bodies — in memory only;
- on close, a few candidate endpoints are called with the session + bearer
  token; then `webuntis-probe.json` is written next to daten.json containing only
  anonymised shapes (`electron/shape.js`: keys, types, string lengths, enum-like
  values; URLs with ids replaced).

## Security model

- Main window: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- CSP in `index.html`: `default-src 'self'`, no external scripts/hosts.
- Planned for the overhaul: secrets via `safeStorage` in a separate file (not in
  daten.json); any third-party page only in its own `BrowserWindow` with a separate
  session partition and a minimal preload; microphone permission granted only to
  the app's own window.
