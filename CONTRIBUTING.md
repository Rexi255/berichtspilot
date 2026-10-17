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

## Tests

```bash
npm test                 # Vitest: src/lib + electron modules (~2 s)
npm run test:e2e         # Playwright: builds the renderer, then end-to-end tests
```

`test:e2e` runs two projects (`playwright.config.mjs`): **browser** — the built
renderer in Chromium via `vite preview`, from a fresh start to the exact text
of output block 1 — and **electron** — the real app with `daten.json` in a temp
folder: closing right after typing keeps the text, a restart shows it. Once per
machine: `npx playwright install --only-shell chromium`. On Linux without a
display: `xvfb-run -a npm run test:e2e`. The third project, **packaged**,
checks a built app (fuses, start from `app.asar`) and only runs with
`PACKAGED_APP` set — the release workflow does that after each build:

```bash
npm run build:win
PACKAGED_APP=release/win-unpacked/Berichtspilot.exe npx playwright test --project=packaged
```

The packaged app normally opens your real data folder; the test points it at
a temp folder (`--user-data-dir`). Start `release/win-unpacked` by hand only
with `PORTABLE_EXECUTABLE_DIR=<scratch folder>` set, or it uses your own
`daten.json`.

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
- Run `npm run lint`, `npm test` and `npm run build:renderer` (CI also runs
  `npm run test:e2e`) before opening a PR.
- For UI changes, a screenshot is appreciated.

## Maintainer checklist: GitHub security settings

The Windows installer is unsigned (DECISIONS E-028), so an update is trusted
because it comes from this repository's GitHub releases: whoever can push a
`v*` tag or publish a release ships code to every installation. The release
workflow only lets its last job write (E-030); these settings close the doors
around it (step 9.3). Set them once and check them again after changing
anything in the repository settings.

- [ ] **Account:** two-factor authentication with a passkey or security key
      (github.com/settings/security), recovery codes stored offline. Revoke
      personal access tokens and OAuth/GitHub apps you no longer use
      (github.com/settings/tokens, …/applications).
- [ ] **Release tags** — Settings → Rules → Rulesets → New ruleset → *New tag
      ruleset*: name `Release tags`, enforcement *Active*, target *Include by
      pattern* `v*`; rules *Restrict creations*, *Restrict updates*, *Restrict
      deletions*, *Block force pushes*; bypass list: *Repository admin*
      (always). Only you can create or move a release tag — no workflow, no
      Dependabot, no leaked token without admin rights.
- [ ] **`main`** — *New branch ruleset*: name `main`, enforcement *Active*,
      target *Include default branch*; rules *Restrict deletions*, *Block force
      pushes*, *Require a pull request before merging* (required approvals 0,
      allowed merge methods: *Merge* only — E-025) and *Require status checks
      to pass* with `pruefen` and `e2e` (from GitHub Actions); no bypass. The
      release PR `development` → `main` then needs green CI.
- [ ] **`development`** — branch ruleset `development`: *Restrict deletions*
      and *Block force pushes* only (direct pushes stay allowed, E-025).
- [ ] **Actions** — Settings → Actions → General: tick *Require actions to be
      pinned to a full-length commit SHA* (every workflow is pinned); keep
      *Workflow permissions* at "Read repository contents and packages
      permissions" and "Allow GitHub Actions to create and approve pull
      requests" off.
- [ ] **Releases** — Settings → General → Releases: *Enable release
      immutability*. A published release's files and tag can't be changed any
      more; a broken release is fixed with a new version. The release workflow
      uploads all files before it publishes, so it works with this.
- [ ] **Code security** — Settings → Advanced Security: *Dependabot alerts*
      and *Dependabot security updates* on (their PRs target `main`: merge
      `main` back into `development` afterwards, E-025); keep *Secret
      scanning* and *Push protection* on.

## Reporting bugs

Most helpful: steps to reproduce, expected vs. actual behavior, operating system
and app version. For format errors, please include the generated text.
