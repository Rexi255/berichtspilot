<div align="center">

# 📓 Berichtspilot

**Generator for the German IHK apprenticeship training record ("Berichtsheft")**

Produces, per training week, the three formatted text blocks that go 1:1 into the
digital IHK training record. Dates, headings and public holidays are filled in
automatically, school topics can come straight from WebUntis, and an AI of your
choice can turn quick notes into clean bullets — you review and copy.
The app's user interface is German.

[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](LICENSE)
![Platform](https://img.shields.io/badge/Platform-Windows%20%C2%B7%20Linux-2ea043.svg)
![Electron](https://img.shields.io/badge/Electron-43-47848F.svg?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)
![Local first](https://img.shields.io/badge/local--first-online%20optional-blue.svg)

<img src="docs/screenshots/overview.png" alt="Overview with stats, year heatmap and a missing week" width="820">

</div>

---

## What is it?

Apprentices in Germany must keep a weekly training record. The digital IHK portal
has three input fields for it. This app takes over the tedious part:

- **Dates & weekdays** are derived from the ISO week.
- **Public holidays** are detected fully offline (Gauss Easter formula, per federal state).
- **School and work days** come from a configurable **profile per school half-year**.
- **School topics** can be imported from **WebUntis** ("Lehrstoff" per lesson).
- **Raw notes** per day become bullets — split automatically, or phrased by a chat AI
  via the clipboard (no API key, nothing is sent without your click).
- The three **output blocks** are generated live in exactly the required format —
  including every blank-line rule — and copied to the clipboard with one click.

Everything runs locally. The online features (WebUntis import, update check) are
optional and can be switched off — without them, no cloud, no account and no
internet connection are needed.

## New in 2.0

- 🧭 **Setup wizard** — a fresh install walks you through training dates, federal
  state, your current school half-year (school/work days, subjects) and WebUntis
  in a few steps. Skippable, and available again under Settings → Verhalten.
- 📝 **Notes per day** — a collapsible raw-text field per day (keywords, dictated
  text). Never part of the output, but included in the search.
- ✂️ **"In Stichpunkte übernehmen"** — splits notes into bullets without any AI
  (one per line or sentence; abbreviations like "z. B." stay intact).
- 🤖 **"Mit KI formulieren"** — builds a prompt from the week's notes, with your own
  earlier bullets as style examples. Paste it into any chat AI (Claude.ai, ChatGPT,
  Gemini — free plans work), paste the answer back, review a per-day preview and
  apply it — undoable. Before copying, the app warns about possible customer data
  (e-mail/IP/MAC addresses, ticket and phone numbers).
- 🏫 **"Aus WebUntis füllen"** — for any school on the WebUntis cloud (enter your
  school's WebUntis address once). Loads the week's timetable incl. lesson topics and
  shows a preview per school day: what gets filled, what's new, cancelled lessons,
  school breaks. Existing text is never overwritten; applying is undoable.
  WebUntis abbreviations can be mapped to your subjects per profile
  (Profiles → "WebUntis-Fächer").
- 🗓️ **Current week created on start** (Monday to Friday, inside the training period).
- ⬆️ **In-app updates** — the installed app asks GitHub once per start for a new
  version; download and install only happen when you click.
- 🛡️ **Unreadable data is never overwritten** — if `daten.json` and all backups are
  damaged, the app stops with a notice instead of starting empty.

Full list: [CHANGELOG.md](CHANGELOG.md).

## Features

- 🗂️ **Overview** of all training weeks with ISO week, date range, status
  (draft/done), progress line, **year heatmap** and **gap detection** (missing
  weeks with one-click creation).
- 🔎 **Full-text search & filters** across bullets, notes, subjects and holidays —
  also handy as a lookup ("when did I configure that switch?").
- ✍️ **Week editor** with live preview of the three output blocks, copy buttons,
  **autocomplete** from all previous bullets + your own **snippets**, and
  **paste from clipboard** (time tracking/WebUntis).
- 🧑‍🏫 **Profiles per school half-year** — picked automatically by date,
  **duplicate** for the half-year switch, warnings for overlaps/gaps, subject
  lists copyable between days/profiles.
- 🏖️ **Periods:** enter vacations and school breaks once — vacation marks the days
  automatically; during school breaks, school days become work days.
- 🎉 **Offline holidays** for all 16 federal states, including movable holidays.
- 🏷️ **Day status** normal / holiday (auto) / sick / vacation.
- ⌨️ **Keyboard shortcuts** (Ctrl+1–4, Alt+←/→, Ctrl+Shift+1/2/3 to copy, Ctrl+N)
  and **German spell checking** in all input fields.
- 💾 **Robust storage:** all data in **one `daten.json`** with **atomic writes**,
  rolling **backups** (`.bak1`–`.bak3`), **single-instance lock**, versioned schema
  with automatic migration, and export/import with **merge or replace**.
  Deleting can be undone via toast.
- 🎨 Frameless window with custom title bar, 6 dark color themes, smooth GSAP transitions.

## Screenshots

| Week editor: notes, WebUntis & AI, live output | Profiles / half-years |
| :---: | :---: |
| ![Week editor](docs/screenshots/editor.png) | ![Profiles](docs/screenshots/profiles.png) |

Type (or paste notes) on the left; the finished target format appears instantly on
the right with a copy button. *(Screenshots use fictional demo data.)*

## Installation (prebuilt app)

Builds are available under **[Releases](https://github.com/Rexi255/berichtspilot/releases)**:

- **Windows (recommended):** `Berichtspilot-Setup-<version>.exe` — the installer.
  Creates start-menu and desktop shortcuts; the install folder is selectable and the
  default install is per user, **without admin rights**. The installer isn't
  code-signed, so Windows SmartScreen may warn on the first run: "Weitere
  Informationen" → "Trotzdem ausführen".
- **Linux:** `Berichtspilot-<version>.AppImage` — make it executable (`chmod +x`) and run it.

### Updates

From 2.0 on, the installed app (setup `.exe` or AppImage) checks GitHub once per
start for a newer release. A found update appears as a small card at the bottom of
the sidebar: **"Herunterladen" → "Jetzt installieren"** — the app saves your data,
installs and restarts. Nothing is downloaded or installed without a click.
Settings → "Updates" has "Nach Updates suchen" and the switch to turn the start
check off.

### Upgrading from 1.x

Versions up to 1.2.0 have no updater, so **install 2.0 by hand once**:

- **Windows installer (1.1 / 1.2):** run the new setup — it replaces the old version
  and keeps your data.
- **Portable `.exe` (up to 1.2.0):** there is no portable build any more. Install
  the setup and either import your export, or copy the `daten.json` from next to the
  old portable `.exe` into `%APPDATA%\Berichtspilot` (app closed).
- **Linux:** replace the old AppImage with the new one in the same folder.

Your `daten.json` is migrated automatically on the first start. After that, older
versions can no longer open it (downgrade protection) — make an export first if you
want to keep a 1.x copy.

### Where is my data?

- **Windows (installer):** in the user data folder `%APPDATA%\Berichtspilot`. It is
  **always writable** — even when the app lives under `C:\Program Files`.
  Uninstalling keeps the data.
- **Linux (AppImage):** in `daten.json` **next to the AppImage** — move the folder and
  the data moves with it. If that folder is read-only, the app falls back to
  `~/.config/Berichtspilot` instead of crashing.

The exact path is shown in the bottom-left of the sidebar (tooltip). Up to three
rolling backups (`.bak1`–`.bak3`) live next to `daten.json`; if the main file is
ever corrupted, the app restores the newest intact backup on start. For manual
backups/moves there is also **export/import**.

## Privacy & network

Your training record never leaves your computer on its own. Only these optional
features go online — all from the main process, only to fixed hosts:

| Feature | Talks to | What is sent | Off switch |
|---|---|---|---|
| WebUntis import | your school's WebUntis server (`<name>.webuntis.com`) | your WebUntis login (in a separate window on the school's page — the app never sees the password), then timetable requests | Settings → "Verbindungen" (off by default) |
| Update check | `github.com`, `release-assets.githubusercontent.com` | the request for the latest release (app version, IP address) — no training data | Settings → "Updates" |

- **WebUntis works with any school on the WebUntis cloud:** paste the address of
  your school's WebUntis login page (e.g.
  `https://schulname.webuntis.com/WebUntis/?school=schulname`) under Settings →
  "Verbindungen". Only `….webuntis.com` addresses are accepted, and the app talks
  to no other WebUntis host.
- **"Mit KI formulieren"** makes no network request at all: *you* copy the prompt into
  a chat AI and paste the answer back, so you see every word that leaves the app.
- The app window itself has no network access (strict Content Security Policy).

## Development

Requires **Node.js ≥ 20.19**.

```bash
npm install
npm run dev            # Vite dev server + Electron with hot reload
npm start              # build renderer + start Electron on the build
npm test               # Vitest: output format (real IHK examples), holidays, dates,
                       # data model/migrations, notes, AI prompt, WebUntis, updater
npm run lint           # ESLint (also runs in CI on every push/PR)
npm run build:renderer # Vite build — proves the renderer compiles
```

In dev mode `daten.json` lives in the current working directory.
Contributor and AI-assistant guidelines: [CONTRIBUTING.md](CONTRIBUTING.md) and
[CLAUDE.md](CLAUDE.md). Architecture, data model and decisions live in [`docs/`](docs/).

## Build & release

```bash
npm run build:win    # Windows: installer (.exe) + latest.yml + .blockmap  -> release/
npm run build:linux  # Linux AppImage + latest-linux.yml                   -> release/ (run on Linux)
npm run build        # both platforms
```

With [CI](.github/workflows/release.yml): pushing a version tag builds both
artifacts and attaches them, together with the update metadata (`latest*.yml`), to
a GitHub release. The tag must match `version` in `package.json`:

```bash
git tag v2.0.0 && git push origin v2.0.0
```

## Output format

The format is mandatory and matches real IHK reports exactly (the output is
German). Full specification: [docs/OUTPUT_FORMAT.md](docs/OUTPUT_FORMAT.md).

**Block 1 — Betriebliche Tätigkeiten** (one blank line between days):

```
Mittwoch, den 08.07.2026:
- Fehlerdiagnose bei DHCP-Zuweisungsproblemen und Behebung lokaler Netzwerkstörungen
- Verwaltung von WLAN-Zugangsdaten für Gäste sowie Bearbeitung von Support-Tickets
```

Holiday/sick/vacation replace the bullets with a status line
(`- Feiertag: Tag der Arbeit`, `- Krankheitstag`, `- Urlaub`).

**Block 2 — Unterweisungen:** free text, usually empty.

**Block 3 — Berufsschule** (header, blank line, subjects with bullets; one blank
line between subjects, **two** between days):

```
Montag, den 06.07.2026:

LF02:
- Kaufvertrag und Leistungsstörungen

Englisch:
- Explaining a network diagram in English
```

## Project structure

```
electron/
  main.js             # window, data location + safe saving, all IPC handlers
  preload.js          # narrow contextBridge API for the renderer
  net.js              # network layer: host allowlist, timeout, German error texts
  webuntis-session.js # WebUntis login window + token handling
  webuntis.js         # WebUntis week fetch (timetable + lesson topics)
  updater.js          # auto-update via electron-updater
src/
  store.jsx           # central state, autosave, all mutations
  lib/                # pure, tested logic: dates · holidays · format · model ·
                      # notes · phrasing · webuntis · update
  views/              # Overview · WeekEditor (+ PhrasingPanel, WebuntisPanel) ·
                      # Profiles · Settings
  ui/                 # title bar, sidebar, update hint, design-system components
docs/                 # architecture, data model, output format, glossary, decisions, plan
CLAUDE.md             # working guide for AI assistants (Claude Code)
```

## Technology & security

- **Electron + Vite + React + Tailwind CSS**, animations with GSAP & Lenis,
  updates via electron-updater.
- **Electron hardening:** `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`. The renderer only gets a narrow API via the preload bridge; file
  I/O and every network request happen exclusively in the main process (IPC).
  Strict CSP in the renderer.
- **Network allowlist:** requests only over https to the hosts listed above (for
  WebUntis: exactly the one `*.webuntis.com` host you entered);
  redirects are not followed off the list. WebUntis runs in its own isolated window
  and session.
- **Holidays offline:** computed locally, no external service.

## Roadmap

Next on the list: local voice dictation into the notes (model choice still open)
and a UI overhaul (planned for 2.1). Status, order and open questions:
**[docs/PLAN.md](docs/PLAN.md)**.

## Contributing

Pull requests and issues are welcome — see **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Disclaimer

Unofficial, private helper tool. **Not** affiliated with or endorsed by any IHK,
the IHK portal or Untis GmbH. Always review the generated texts before
submitting — every apprentice is responsible for the correctness and completeness
of their training records. Use at your own risk, without warranty.

## License

[MIT](LICENSE)
