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
└──────────────▲───────────────────────────────────────────────────────────────┘
               │ IPC (ipcMain.handle ↔ ipcRenderer.invoke)
┌──────────────┴──── electron/preload.js (contextBridge) ──────────────────────┐
│  window.api = { loadData, saveData, … }  — the only bridge                   │
└──────────────▲───────────────────────────────────────────────────────────────┘
               │
┌──────────────┴──── Renderer (Chromium, sandboxed, strict CSP) ───────────────┐
│ src/main.jsx → App.jsx (shell: Titlebar, Sidebar, GSAP view transitions)     │
│ src/store.jsx  StoreProvider: loads on start, holds `data`, 400 ms autosave  │
│ src/views/*    Overview · WeekEditor · Profiles · Settings                   │
│ src/lib/*      pure logic: dates · holidays · format · model                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data flow

1. Start: `store.jsx` → `api.loadData()` → main reads `daten.json` (fallback: newest
   intact `.bakN`) → `migrateData()` upgrades old schemas → `setData`.
   No file ⇒ `seedData()`.
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

## Networking

**Currently: no network access at all** (CSP `connect-src` allows only localhost
for Vite HMR).

The overhaul (see `PLAN.md`) adds network targets. Rule: requests only from the
main process, only to hosts in this allowlist, each with a reason.

| Host | Purpose | Since |
|---|---|---|
| `bbz-dithmarschen.webuntis.com` | WebUntis: timetable + lesson topics (E-013). **Probe only so far** (`--webuntis-probe`), not used by the app | 2026-10 (step 4.1) |

`login.bbz-dithmarschen.de` (school SSO) is only *navigated to* inside the
isolated login window; the main process never sends requests there.

The renderer CSP is unchanged: WebUntis runs in its own window, never in the app
window.

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

Not wired to IPC or UI yet; the probe still uses `ses.fetch` directly.

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
