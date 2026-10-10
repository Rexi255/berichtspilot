# electron/ — main process & preload

Everything with system access lives here. The renderer is deliberately "dumb" and
may only do what `preload.js` exposes.

## Rules

- **A new channel touches three places:** `ipcMain.handle('area:action', …)` in
  `main.js`, a named function in `preload.js`, and a fallback in `browserApi` in
  `src/store.jsx` (so `vite` in a plain browser doesn't crash). Then add it to the
  channel table in `docs/ARCHITECTURE.md`.
- Channel names: `area:action` in English (`data:save`, `window:close`).
- Handlers return `{ ok: true, … }` or `{ ok: false, error: '…' }` — don't throw
  (errors lose their type across IPC). User-facing error texts are German.
- **Validate renderer input** (type, length, allowed values). Never take paths,
  URLs or shell commands from the renderer unchecked.
- Never expose raw `ipcRenderer` or a generic "invoke(channel)" bridge.
- Don't change the main window's `webPreferences` (`contextIsolation`,
  `nodeIntegration: false`, `sandbox`). Additional windows get their **own session
  partition** and their own minimal preload.
- **Network:** only here, only to hosts in the allowlist in `docs/ARCHITECTURE.md`.
- **Secrets:** only via `safeStorage.encryptString()` in a dedicated file next to
  `daten.json` (never inside it). Never log them, never send them back to the
  renderer unless the user explicitly asks to see them.

## Storage logic (do not weaken)

`resolveDataDir()` (dev → CWD, portable → next to the executable if writable,
otherwise `userData`) and `writeData()` (tmp + fsync → rotate backups → atomic
rename) are acceptance criteria. Change them only with a written rationale in
`docs/DECISIONS.md`.

## Testing

Logic that should be testable (parsers, mappers, validation) goes into its own
CommonJS module under `electron/` with a Vitest test next to it, instead of being
buried in `main.js`. Name the test `*.test.mjs` (ESM `import` from vitest; the
`electron/**/*.js` lint block is CommonJS) — example: `shape.js` / `shape.test.mjs`.
