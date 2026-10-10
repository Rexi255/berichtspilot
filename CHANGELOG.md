# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Notes per day:** every day in the week editor has a collapsible "Notizen"
  field for raw text (e.g. dictated or quick keywords). Notes never appear in
  the output blocks but are included in the overview search. Schema v4 adds the
  field automatically to all existing weeks.
- **"In Stichpunkte übernehmen":** on work days, notes are split into bullets
  with one click — one bullet per line or sentence, bullet characters and
  numbering removed, German abbreviations like "z. B." or "ca." kept intact.
- **"Mit KI formulieren" (clipboard bridge):** builds a prompt from the week's
  notes (with your own earlier bullets as style examples), you paste it into any
  chat AI (Claude.ai, ChatGPT, Gemini — free plans work, no API key) and paste
  the answer back. The app reads the answer even with intros or formatting,
  shows a per-day preview and replaces the bullets on confirmation — undoable.
  Before copying, it warns about possible customer data (e-mail/IP/MAC
  addresses, ticket and phone numbers). No network access.
- **WebUntis probe (developer tool):** `npm run probe:webuntis` opens WebUntis
  in a separate, isolated window and records the anonymised structure of the
  school's API (no names, notes or passwords) — groundwork for the WebUntis
  import.
- **Settings → "Verbindungen":** new switch "WebUntis-Import" (off by default —
  then nothing is ever requested). When on, it shows the school (BBZ
  Dithmarschen), the login status and "Anmelden"/"Abmelden". The login happens
  in a separate window on the school's page; the app never sees the password.
  Switching off also logs out. Schema v5 adds the switch to existing data.
  The switch is a per-device opt-in: an import with "Ersetzen" keeps it as it
  is, and opening the settings while logged out sends no request.
- **Profiles → "WebUntis-Fächer"** (visible while the WebUntis import is on):
  map WebUntis abbreviations to your subjects (e.g. `kom` → Kommunikation) or
  ignore a WebUntis entry (e.g. a support teacher). Identical names like `LF07`
  need no entry. Schema v6 adds the (empty) list to existing profiles. Groundwork
  for "Woche aus WebUntis füllen".
- **Woche aus WebUntis füllen:** with the WebUntis import on, the week editor
  has a button "Aus WebUntis füllen". It loads the week's timetable incl. the
  lesson topics ("Lehrstoff") and shows a preview per school day: which subjects
  get filled, which are new, which already have text (never overwritten),
  cancelled lessons and school breaks. Wrong lessons can be unticked, unknown
  WebUntis subjects mapped or ignored right there (remembered in the profile).
  Applying is undoable. Logged out? The panel offers "Anmelden" and retries.

### Changed

- **Project structure for AI-assisted development:** `CLAUDE.md` is now a working
  guide (instead of the original build brief, archived under `docs/archive/`), a
  new knowledge base in `docs/` (architecture, data model, output format,
  glossary, decisions, overhaul plan), Claude Code skills `/next` and `/wrap-up`,
  and a SessionStart hook for cloud sessions.
- **English codebase:** code, identifiers, comments, documentation, AI
  instructions, changelog and templates are English now; the UI and the IHK
  output stay German.
- **Schema migration v2 → v3:** all `daten.json` field names and values are
  English now (e.g. `wochen` → `weeks`, `stichpunkte` → `bullets`). Existing files
  and imports of older exports are migrated automatically and losslessly on
  load; the file name stays `daten.json`.

## [1.2.0] - 2026-07-09

### Added

- **Autocomplete in the editor:** while typing, matching bullets from all previous
  weeks (work or per subject) are suggested — plus freely maintainable
  **snippets** in the settings.
- **Gap detection:** the overview shows missing weeks between the start of the
  apprenticeship and the previous week (individually or as a collapsible block)
  with one-click creation, plus the stat tiles "weeks missing" and "weeks in a
  row". The current week and weeks after the end of the apprenticeship don't count
  as missing.
- **Year heatmap** in the overview: one cell per ISO week (done/draft/missing);
  clicking opens the week.
- **Search & filters:** full-text search across bullets, subjects, instructions and
  holidays; status filter (all/drafts/done); year subheadings.
- **Periods (vacation/school breaks):** enter once — vacation marks empty days
  automatically (also retroactively), school breaks turn school days into work days
  when creating new weeks.
- **Duplicate profile** for the half-year switch + **validity check** (warnings
  for overlaps, gaps and missing ranges) + **"copy subjects from …"** between school
  days/profiles.
- **Import with merge:** on import you choose whether only missing weeks/profiles
  are added or everything is replaced; imported files are validated structurally
  first.
- **"Paste from clipboard":** lines from time tracking/WebUntis become bullets
  (bullet characters are stripped).
- **Keyboard shortcuts:** Ctrl+1–4 (views), Alt+←/→ (week), Ctrl+Shift+1/2/3
  (copy block), Ctrl+N (create week) — reference in the settings.
- **Undo on delete:** deleted weeks/profiles can be restored for 6 seconds via toast.
- **German spell checking** in all input fields incl. correction context menu and
  "add to dictionary".
- **Extended settings:** selectable start view, data location with "open folder",
  snippets, shortcut overview.
- **Tests + CI:** Vitest suite for format (real IHK examples), holiday, date and
  model logic; ESLint; a CI workflow checks lint + tests on every push, the release
  workflow before every build.

### Changed

- **Schema migration:** `daten.json` now carries version 2 (new: periods, start
  view, snippets). Old files are migrated automatically on load/import; files from
  newer app versions are not loaded, to prevent data loss.

### Fixed

- **Single-instance lock:** a second app instance could overwrite the first one's
  `daten.json`. Now a second start just focuses the existing window.

## [1.1.1] - 2026-07-08

### Fixed

- **Release workflow** never finished green: electron-builder triggered an implicit
  GitHub publish on a git tag and aborted without `GH_TOKEN` — although installer,
  portable `.exe` and AppImage were built successfully. The build scripts now call
  electron-builder with `--publish never`; uploading to the release is done solely
  by the `action-gh-release` step. App otherwise unchanged from 1.1.0.

## [1.1.0] - 2026-07-08

### Added

- **Windows installer** (NSIS) as the new main target: selectable install folder,
  start-menu/desktop shortcuts, per-user install without admin rights by default.
  The portable `.exe` remains available.
- **Rolling backups**: before every save the previous state is kept as
  `daten.json.bak1`–`.bak3`. If the main file is corrupted, the app restores the
  newest intact state on start (with a notice).

### Changed

- **Data location of installed builds** is now the user data folder
  (`%APPDATA%\Berichtspilot` / `~/.config/Berichtspilot`) instead of next to the
  executable. This fixes failing saves when the app is installed under
  `C:\Program Files` or `/usr/bin` (the OS blocks writes there without admin
  rights). The portable build keeps saving next to the app and falls back to the
  user data folder if that location is read-only.
- **Atomic saving** is additionally secured with `fsync` (force the temp file to
  disk, then rename atomically) — no data loss on a crash/power failure mid-write.

### Fixed

- The **Nordlicht** theme card preview in the settings took on the color of the
  currently active theme; it now always shows the Nordlicht colors.

## [1.0.0] - 2026-07-08

### Added

- Overview of all training weeks with ISO week, date range, status and progress line.
- Week editor with live preview of the three output blocks and copy buttons.
- Profiles per school half-year, selected automatically by the week's date.
- Offline holiday calculation for all 16 federal states (Gauss Easter formula).
- Day status normal / holiday (auto) / sick / vacation.
- Portable persistence in `daten.json` next to the executable, plus export/import.
- Frameless window with custom title bar, dark mode, GSAP transitions.
- Builds for Windows (portable `.exe`) and Linux (AppImage).
