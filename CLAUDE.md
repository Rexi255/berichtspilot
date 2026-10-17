# Berichtspilot — Working Guide for AI Assistants

Electron desktop app that produces the weekly IHK training record ("Berichtsheft")
for an apprentice (IT specialist for system integration, Schleswig-Holstein,
Germany). Current release: v2.0.1 — entry by hand or from notes, WebUntis
import, AI phrasing via the clipboard, in-app updates → three exactly formatted
text blocks to copy into the IHK portal.
**Next:** hardening + maintenance (phases 7–10 from the 2026-10-15 code review,
release v2.0.2), then the UI overhaul (v2.1); voice dictation is parked — see `docs/PLAN.md`.

## Language rules

| What | Language |
|---|---|
| Code, identifiers, comments, `daten.json` field names, IPC channels, CSS tokens | **English** |
| Docs (`CLAUDE.md`, `docs/`, CONTRIBUTING), skills, CHANGELOG | **English** |
| `README.md` (for end users: short, plain, few emojis) | **German** |
| Commit messages, branch names, PR titles/bodies, issue templates | **English** |
| **UI text** (labels, buttons, toasts, dialogs, file names offered to the user) | **German** |
| **IHK output** (`src/lib/format.js` — weekday names, "den", "Feiertag: …") | **German** |
| Chat with the user | **German** |

German domain terms ↔ English code names: `docs/GLOSSARY.md`. Use those names
consistently; add new terms there.

## At the start of EVERY session

1. Read `docs/PLAN.md` → sections **"Next step"** and **"Open questions"**.
2. Read only the docs the task needs (table below).
3. If the next step is unclear or blocked by an open question → ask the user,
   don't guess.

## At the end of EVERY session (before committing)

1. `npm run lint && npm test && npm run build:renderer` must pass.
2. Update `docs/PLAN.md`: tick off what's done and rewrite **"Next step"** so that a
   fresh chat with zero context can continue.
3. New architectural/technical decision → entry in `docs/DECISIONS.md`.
4. User-facing change → `CHANGELOG.md` under `## [Unreleased]`.
5. Schema changed → update `docs/DATA_MODEL.md`.

The skills `/next` (implement the next plan step) and `/wrap-up` (the checklist
above + commit/PR) encode exactly this workflow.

## Knowledge base

| File | Read when |
|---|---|
| `docs/PLAN.md` | **always** — roadmap, next step, open questions |
| `docs/GLOSSARY.md` | naming anything; translating German domain terms |
| `docs/ARCHITECTURE.md` | crossing process boundaries (main ↔ preload ↔ renderer), new IPC channels, networking |
| `docs/DATA_MODEL.md` | touching `daten.json`, profiles, weeks, migrations |
| `docs/OUTPUT_FORMAT.md` | anything that affects the three output blocks |
| `docs/DECISIONS.md` | before making (or revisiting) a fundamental decision |
| `docs/archive/original-brief.md` | historical only — the original v1.0 build brief (German) |

Folder-specific rules live in `electron/CLAUDE.md` and `src/lib/CLAUDE.md`.

## Commands

```bash
npm ci                 # install (cloud sessions: prefix ELECTRON_SKIP_BINARY_DOWNLOAD=1)
npx -y npm@11 install … # lockfile changes: the lock has npm 11 `libc` fields, npm 10 strips them
npm test               # Vitest — src/lib + electron modules, in Europe/Berlin time (vite.config.js) (fast, ~2 s)
npm run lint           # ESLint (required by CI)
npm run build:renderer # Vite build — proves the renderer compiles
npm run dev            # Vite + Electron with hot reload (needs a display)
electron . --screenshot=shot.png [--view=editor|profiles|settings] [--scroll=<css selector>]  # headless UI check (unpacked runs only)
```

Dev mode keeps `daten.json` in the **current working directory** — run screenshot
checks from a scratch folder (`<repo>/node_modules/electron/dist/electron <repo> …`)
so the real data file isn't migrated/overwritten. In a VS Code terminal on
Windows `ELECTRON_RUN_AS_NODE` may be set; unset it (`env -u ELECTRON_RUN_AS_NODE …`)
or Electron starts as plain Node.

Cloud sessions can still fetch the Electron binary (`node node_modules/electron/install.js`)
and run it headless: `xvfb-run -a node_modules/electron/dist/electron --no-sandbox <dir>`
(the cloud proxy blocks most external hosts — test network code against a local server).
To drive the real app, add `--remote-debugging-port=9333` and talk CDP to the page
target from `http://127.0.0.1:9333/json` (Node 22 has `WebSocket` built in):
`Runtime.evaluate` (clicks, `window.api` calls), `Input.insertText` (typing),
`Page.captureScreenshot`. Native dialogs are invisible to CDP — start `Xvfb :99`
yourself and capture them with `import -display :99 -window root shot.png`.
`npm run build:linux` works in the cloud too; start the AppImage (no FUSE) with
`APPIMAGE_EXTRACT_AND_RUN=1 xvfb-run -a ./Berichtspilot-*.AppImage --no-sandbox`
from a scratch folder — it keeps `daten.json` next to the AppImage.

Without an Electron binary (cloud), the renderer also runs in a plain browser:
`npx vite preview` serves `dist/`, and `browserApi` in `src/store.jsx` swaps the
IPC bridge for `localStorage`. Playwright + Chromium are preinstalled in cloud
sessions for smoke tests (global `playwright` package under `/opt/node-tools`);
`page.addInitScript()` can install a fake `window.api` to test store flows such
as restore/import with dialogs answered.

CI (`.github/workflows/ci.yml`) runs lint + tests on every PR.
Release: push tag `vX.Y.Z` → `.github/workflows/release.yml` builds NSIS installer +
AppImage + auto-update metadata (`latest*.yml`); the tag must match `package.json`
`version` (E-017).

## Project map

```
electron/main.js     window, daten.json location, close flush, all IPC handlers
electron/storage.js  daten.json load + atomic save + backups, one write at a time (E-003, E-023)
electron/preload.js  contextBridge → window.api (the only bridge to the renderer)
electron/guard.js    main window guard: app URL only, trusted IPC senders, save shape check (E-022)
electron/net.js      network layer: host allowlist, timeout, German error texts (E-007)
electron/updater.js  auto-update via electron-updater (E-017): check / download / install, allowlist on its session
electron/webuntis-probe.js  dev spike `--webuntis-probe` (E-013); shape.js = JSON/URL anonymiser
src/store.jsx        central state (React context), 400 ms autosave, all mutations
src/lib/             PURE logic, fully tested: dates · holidays · format · model · notes · phrasing · webuntis · update · setup · backups
src/views/           screens: overview · week editor (+ PhrasingPanel, WebuntisPanel) · profiles · settings · setup wizard
src/ui/              design system: Titlebar, Sidebar, UpdateHint, ErrorBoundary, basics, toast, Logo
src/index.css        Tailwind v4 + design tokens/themes (data-theme on <html>)
docs/                knowledge base (see above)
```

## Hard rules (never break)

1. **The output format is sacred.** `src/lib/format.js` must match
   `docs/OUTPUT_FORMAT.md` exactly (blank-line rules!). `src/lib/format.test.js`
   holds real IHK examples — never edit those expectations to make tests pass.
2. **No data loss.** `daten.json` holds the user's entire training record.
   Schema change ⇒ bump `DATA_VERSION` + migration step + test. Never weaken the
   atomic write/backup logic in `electron/storage.js`.
3. **Electron security.** `contextIsolation: true`, `nodeIntegration: false`,
   `sandbox: true`, strict CSP. The renderer never gets Node/`fs`/network directly —
   everything goes through a named IPC channel exposed in `preload.js`.
4. **Network only in the main process**, only to explicitly allowed hosts
   (allowlist in `docs/ARCHITECTURE.md`). The renderer CSP stays free of external hosts.
5. **Secrets** (API keys, passwords, tokens) **never in `daten.json`** and never in
   the repo — only encrypted via Electron `safeStorage` in a separate file.
   Reason: `daten.json` gets exported and shared.
6. **Customer data protection.** Text leaving the machine must be visible to and
   confirmed by the user first; no silent uploads.
7. **Dates:** ISO strings `YYYY-MM-DD`, always parsed as local dates via
   `parseISO()` — never `new Date('YYYY-MM-DD')` (UTC offset bug). Day
   differences via `daysBetween()`, never milliseconds between local dates
   (23/25-hour days at the DST switch).
8. **"Easy to use" is a product principle:** download → install → it works. No
   mandatory extra installs (Python, Docker, Ollama …) for core features.

## Code conventions

- 2-space indent, **no semicolons**, single quotes.
- English identifiers in camelCase (`createWeek`, `holidayOn`); components in
  PascalCase. Domain terms per `docs/GLOSSARY.md`.
- Comment central logic briefly (why, not what) — match the tone of existing files.
- New domain logic = pure function in `src/lib/` + Vitest test next to it (`*.test.js`).
- State changes are always immutable, via mutations in `src/store.jsx`.
- Design: reuse components from `src/ui/basics.jsx` and tokens from `src/index.css`;
  no new UI frameworks.

## Git workflow

- **All work goes to the long-lived branch `development`** (user, E-025) — also
  when the session names its own `claude/…` branch: `git fetch origin development
  && git checkout development`, commit and push there (this is the user's
  standing permission). Never create a new branch per chat.
- `main` holds the released state. Only a release step merges: PR `development`
  → `main` (CI green, **merge commit**, not squash), then the tag. No PR between
  releases — CI runs on every push to `development`.
- Conventional Commits in English (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Small, self-contained steps — ideally one PR (or at least one commit) per plan step.

## The user

Apprentice IT specialist (since 2025), works on Arch Linux and Windows. Talk to them
in German; technical explanations are welcome.
