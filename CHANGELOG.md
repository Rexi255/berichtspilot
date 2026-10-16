# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Daily backups you can restore:** Berichtspilot now keeps a copy of your
  data for each day (the last 30 days) in the folder `sicherungen` next to
  `daten.json`, plus one before every app update, import and restore. Settings →
  Daten → "Sicherungen" lists them; "Wiederherstellen" brings an older state
  back — the current one is saved first, so you can always go back.

### Fixed

- **An error in one view no longer blanks the whole window:** Berichtspilot
  shows a message with "Neu laden" and "Fehlerdetails kopieren" instead; the
  window buttons and the other views keep working (e.g. to restore a backup).
  If the display crashes completely, a dialog offers to reload it.
- **Closing right after typing no longer loses the last change:** the app now
  saves before the window closes. If saving fails, it asks before closing
  instead of silently dropping the change.
- **"Fehler beim Speichern!" from two saves at once:** saves now run one after
  another, and a file briefly locked by a virus scanner (Windows) is retried.

### Security

- **The app window only shows Berichtspilot:** a file dragged onto the window
  (or any other page) can no longer replace the app — before, such a page could
  have used the app's functions, including overwriting `daten.json`. Only the
  app's own page may talk to the background process, and the window only gets
  the permission it needs (copying to the clipboard).

## [2.0.1] - 2026-10-10

### Changed

- **One empty bullet per work day instead of two:** with two, Enter in the
  first bullet added a third one instead of moving to the second. New weeks
  now start with one bullet. Existing profiles still set to 2 are switched to
  1 automatically; any other count you chose in Profile → "Leere Stichpunkte"
  stays.

### Fixed

- **Setup wizard scrolls again:** when a step grew taller than the window
  (e.g. many subjects in "Aktuelles Schulhalbjahr"), the page could not be
  scrolled and the "Weiter" button was out of reach.

## [2.0.0] - 2026-10-10

The automation release: setup wizard, notes per day, AI phrasing via the
clipboard, WebUntis import and in-app updates. Upgrading from 1.x: install this version by hand once
(1.x has no updater); `daten.json` is migrated automatically.

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
  then nothing is ever requested). When on, you paste the address of your
  school's WebUntis login page (e.g.
  `https://schulname.webuntis.com/WebUntis/?school=schulname`) — the app keeps
  only the server and the school name; only WebUntis cloud addresses
  (`….webuntis.com`) are accepted. Below it: the login status and
  "Anmelden"/"Abmelden". The login happens in a separate window on the
  school's page; the app never sees the password. Switching off or changing
  the address logs out. Schema v5 adds the switch, schema v9 the (empty)
  address to existing data. Switch and address are per-device settings: an
  import with "Ersetzen" keeps them as they are, and opening the settings
  while logged out sends no request.
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
  Two lessons at the same time (e.g. a stray entry in the school's timetable)
  each get only the topic of their own subject.
- **Current week created on start:** if the running week doesn't exist yet,
  the app creates it on start (Monday to Friday, inside the training period) —
  with profile, holidays and vacation like "Woche anlegen" — and shows a short
  hint "KW n angelegt". Switch "Aktuelle Woche beim Start anlegen" under
  Settings → Verhalten (on by default; schema v7 adds it to existing files).
- **Setup wizard ("Einrichtung"):** on a fresh install, a short wizard opens
  instead of sample data: training start and end (with quick picks for 2 to
  3.5 years), federal state, the current school half-year with school and work
  days and the subjects per school day, optionally the WebUntis address, and
  the start behavior — then a summary. It can be skipped (it won't ask again),
  an existing export can be imported right from the first screen, and
  Settings → Verhalten → "Einrichtungsassistent starten" runs it again later
  (it edits the half-year valid today). Existing data isn't affected: schema
  v10 marks it as set up.
- **In-app updates:** the installed app (setup `.exe` or AppImage) asks GitHub
  once per start whether a newer version exists — only the app version and your
  IP address reach GitHub, no training data. A found update shows up quietly as
  a card at the bottom of the sidebar ("Update auf vX.Y.Z", plus one short hint
  per version): "Herunterladen" → progress bar → "Jetzt installieren" (saves
  your data, installs silently and restarts the app). Nothing is downloaded or
  installed without a click. Settings → "Updates" shows the current version,
  "Nach Updates suchen" with the result inline, and the switch "Beim Start nach
  Updates suchen" (schema v8 adds it, on by default; an import with "Ersetzen"
  keeps this device's value). Versions up to 1.2.0 have no updater — the first
  version with it has to be installed by hand once.

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
- **Releases carry update metadata:** every release now also contains
  `latest.yml` / `latest-linux.yml` (and the installer's `.blockmap`), which the
  in-app update reads. The release build stops if the tag doesn't match the app
  version.

### Fixed

- **Unreadable data is never overwritten:** if `daten.json` and all three
  backups exist but can't be read, the app no longer starts with empty sample
  data (whose autosave would have pushed the originals out of the backups). It
  shows "Daten können nicht geladen werden" with a button to open the data
  folder and leaves every file untouched.

### Removed

- **Portable Windows build:** there is no `…-portable.exe` any more — it can't
  update itself. Use the installer (`Berichtspilot-Setup-<version>.exe`, no
  admin rights needed). To keep your data, import an export or copy `daten.json`
  from next to the old portable `.exe` into `%APPDATA%\Berichtspilot`.

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
