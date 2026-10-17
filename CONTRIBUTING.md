# Contributing

Thanks for your interest! Contributions are welcome — bug fixes, ideas or
improvements to the holiday/format logic.

## Setup

Requires **Node.js ≥ 22.12**; recommended is **24 LTS** (`.nvmrc`) — CI and the
release builds use it, and it is the Node inside Electron 44. Change
dependencies with **npm 11** (bundled with Node 24; on Node 22 use
`npx -y npm@11 install …`): the lockfile carries npm 11's `libc` fields, which
npm 10 strips. `npm ci` works with both.

```bash
git clone https://github.com/Rexi255/berichtspilot.git
cd berichtspilot
npm install
npm run dev
```

## Docs & plan

- **[docs/PLAN.md](docs/PLAN.md)** — current overhaul, next step, open questions
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — processes, IPC channels, networking
- **[docs/DATA_MODEL.md](docs/DATA_MODEL.md)** — structure of `daten.json`, migrations
- **[docs/OUTPUT_FORMAT.md](docs/OUTPUT_FORMAT.md)** — binding target format
- **[docs/GLOSSARY.md](docs/GLOSSARY.md)** — German domain terms ↔ English code names
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — decision log
- **[CLAUDE.md](CLAUDE.md)** — rules and workflow for AI assistants (apply to humans too)

## Code style

- **2-space** indent, **no** semicolons, single quotes.
- **English** identifiers, comments, docs and commit messages. **The UI and the IHK
  output stay German** (see `docs/GLOSSARY.md` for the term mapping).
- Central logic (dates, holidays, output format, data location/safe saving,
  IPC/preload) is briefly commented; please keep that tone.
- No new renderer access to Node/`fs`. File I/O happens **only** in the main process
  and is exposed through the preload bridge (`electron/preload.js`).

## Things to watch out for

- **Output format** (`src/lib/format.js`) must stay exact — including the blank-line
  rules (see `docs/OUTPUT_FORMAT.md`). Verify changes against the examples.
- **Holidays** (`src/lib/holidays.js`): back new/changed holidays with the federal
  state. Movable holidays derive from Easter Sunday.
- **Dates** (`src/lib/dates.js`): ISO strings are deliberately parsed as *local*
  dates (no UTC offset). Don't switch to `new Date("YYYY-MM-DD")`.
- **Schema changes** need a migration step and a test (see `docs/DATA_MODEL.md`).

## Quick UI check

A built-in screenshot helper renders the app invisibly and saves a PNG:

```bash
electron . --screenshot=shot.png [--view=editor|profiles|settings]
```

## WebUntis probe (developer spike)

For the WebUntis import (DECISIONS E-013) a one-off probe records the
**structure** of the school's WebUntis API with a real login:

```bash
npm ci
npm run probe:webuntis    # = electron . --webuntis-probe (close Berichtspilot first)
```

The probe uses the WebUntis address saved in Settings → "Verbindungen" (it reads
it from `daten.json`); enter it there first.

A window opens: log in via the school portal, open the timetable (a week with
lessons), click one or two lessons that have a topic under **"Lehrstoff"**, close the window. The probe
writes `webuntis-probe.json` next to `daten.json` (in dev: the project folder;
git-ignored) containing only status codes, keys and value types — no names,
notes, ids, tokens or cookie values (see `electron/shape.js`). Look at it before
sharing it.

## Pull requests

- Work happens on the branch `development`; `main` holds the released state
  and only receives a merge per release. Open PRs against `development`.
- Small, focused PRs with a meaningful description.
- Run `npm run lint`, `npm test` and `npm run build:renderer` before opening a PR.
- For UI changes, a screenshot is appreciated.

## Reporting bugs

Most helpful: steps to reproduce, expected vs. actual behavior, operating system
and app version. For format errors, please include the generated text.
