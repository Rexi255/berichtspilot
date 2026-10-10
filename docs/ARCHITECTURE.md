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
| — | — | — |

## Security model

- Main window: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- CSP in `index.html`: `default-src 'self'`, no external scripts/hosts.
- Planned for the overhaul: secrets via `safeStorage` in a separate file (not in
  daten.json); any third-party page only in its own `BrowserWindow` with a separate
  session partition and a minimal preload; microphone permission granted only to
  the app's own window.
