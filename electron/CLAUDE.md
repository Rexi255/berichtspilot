# electron/ — main process & preload

Everything with system access lives here. The renderer is deliberately "dumb" and
may only do what `preload.js` exposes.

## Rules

- **A new channel touches three places:** `handle('area:action', …)` in
  `main.js` (never `ipcMain.handle` directly — `handle()` refuses callers that
  aren't the app page, `electron/guard.js`), a named function in `preload.js`,
  and a fallback in `browserApi` in `src/store.jsx` (so `vite` in a plain
  browser doesn't crash). Then add it to the channel table in
  `docs/ARCHITECTURE.md`.
- Channel names: `area:action` in English (`data:save`, `window:close`).
- Handlers return `{ ok: true, … }` or `{ ok: false, error: '…' }` — don't throw
  (errors lose their type across IPC). User-facing error texts are German.
- **Validate renderer input** (type, length, allowed values). Never take paths,
  URLs or shell commands from the renderer unchecked.
- Never expose raw `ipcRenderer` or a generic "invoke(channel)" bridge.
- Don't change the main window's `webPreferences` (`contextIsolation`,
  `nodeIntegration: false`, `sandbox`) and keep its guards: navigation only to
  the app URL, permissions only from `ALLOWED_PERMISSIONS` (E-022). Additional
  windows get their **own session partition** and their own minimal preload.
- **Network:** only here, only to hosts in the allowlist in `docs/ARCHITECTURE.md`.
- **Secrets:** only via `safeStorage.encryptString()` in a dedicated file next to
  `daten.json` (never inside it). Never log them, never send them back to the
  renderer unless the user explicitly asks to see them.

## Storage logic (do not weaken)

`resolveDataDir()` in `main.js` (dev → CWD, portable → next to the executable if
writable, otherwise `userData`) and `createStorage()` in `storage.js` (writes one
at a time; tmp + fsync → rotate backups → atomic rename, retried on Windows file
locks) are acceptance criteria. Change them only with a written rationale in
`docs/DECISIONS.md` (E-003, E-023). The close flush (`app:flush` → renderer saves
→ `app:flushed`) and the `will-quit` wait for running writes belong to it.

## Testing

Logic that should be testable (parsers, mappers, validation) goes into its own
CommonJS module under `electron/` with a Vitest test next to it, instead of being
buried in `main.js`. Name the test `*.test.mjs` (ESM `import` from vitest; the
`electron/**/*.js` lint block is CommonJS) — example: `shape.js` / `shape.test.mjs`.

The whole app (window, preload, close flush, `daten.json`) is covered by
`e2e/electron.spec.mjs` (`npm run test:e2e`, E-031) — keep it green when
touching `main.js`, `preload.js` or `storage.js`. A new fuse goes into
`build.electronFuses` in `package.json`; the packaged check compares the
built binary against that list (E-029).
