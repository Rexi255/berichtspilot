# Berichtspilot — Working Guide for AI Assistants

Electron desktop app that produces the weekly IHK training record ("Berichtsheft")
for an apprentice (IT specialist for system integration, Schleswig-Holstein,
Germany). Current release: v1.2.0 — manual entry → three exactly formatted text
blocks to copy into the IHK portal.
**Ongoing overhaul:** automate as much of that as possible (voice dictation,
WebUntis import, AI phrasing) — see `docs/PLAN.md`.

## Language rules

| What | Language |
|---|---|
| Code, identifiers, comments, `daten.json` field names, IPC channels, CSS tokens | **English** |
| Docs (`CLAUDE.md`, `docs/`, README, CONTRIBUTING), skills, CHANGELOG | **English** |
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
npm test               # Vitest — pure logic in src/lib (fast, <1 s)
npm run lint           # ESLint (required by CI)
npm run build:renderer # Vite build — proves the renderer compiles
npm run dev            # Vite + Electron with hot reload (needs a display)
electron . --screenshot=shot.png [--view=editor|profiles|settings]  # headless UI check
```

Without an Electron binary (cloud), the renderer also runs in a plain browser:
`npx vite preview` serves `dist/`, and `browserApi` in `src/store.jsx` swaps the
IPC bridge for `localStorage`. Playwright + Chromium are preinstalled in cloud
sessions for smoke tests.

CI (`.github/workflows/ci.yml`) runs lint + tests on every PR.
Release: push tag `vX.Y.Z` → `.github/workflows/release.yml` builds NSIS installer +
portable .exe + AppImage.

## Project map

```
electron/main.js     window, daten.json location, atomic save + backups, all IPC handlers
electron/preload.js  contextBridge → window.api (the only bridge to the renderer)
src/store.jsx        central state (React context), 400 ms autosave, all mutations
src/lib/             PURE logic, fully tested: dates · holidays · format · model
src/views/           screens: overview · week editor · profiles · settings
src/ui/              design system: Titlebar, Sidebar, basics, toast, Logo
src/index.css        Tailwind v4 + design tokens/themes (data-theme on <html>)
docs/                knowledge base (see above)
```

## Hard rules (never break)

1. **The output format is sacred.** `src/lib/format.js` must match
   `docs/OUTPUT_FORMAT.md` exactly (blank-line rules!). `src/lib/format.test.js`
   holds real IHK examples — never edit those expectations to make tests pass.
2. **No data loss.** `daten.json` holds the user's entire training record.
   Schema change ⇒ bump `DATA_VERSION` + migration step + test. Never weaken the
   atomic write/backup logic in `electron/main.js`.
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
   `parseISO()` — never `new Date('YYYY-MM-DD')` (UTC offset bug).
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

- Work on a feature branch; deliver via **pull request** against `main`; CI must be green.
  If the session names a branch, use it.
- Conventional Commits in English (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Small, self-contained steps — ideally one PR (or at least one commit) per plan step.

## The user

Apprentice IT specialist (since 2025), works on Arch Linux and Windows. Talk to them
in German; technical explanations are welcome.
