---
name: ui-shots
description: Screenshot Berichtspilot's views with the fictional demo record (browser build or the real Electron app) in dark and light, for visual self-checks while working on the UI, before/after comparisons and README images. Use after every visible UI change, when the user asks for screenshots, or when checking a design step.
---

# /ui-shots: look at the UI yourself

The user wants every visible UI change checked by Claude with Playwright, not only at the end of a
step (2026-11-07). This skill is that loop.

## The data

`e2e/fixtures/demo-daten.json` is a **fictional** training record: no customer data, no real names. It runs
from September 2025 to KW 45/2026 and has done, draft and missing weeks, holidays, vacation, sick days,
school days and raw notes. "Today" for it is **2026-11-04** (Wed, KW 45); the script freezes the clock
there. Regenerate it after a schema or model change with:

```bash
node --no-warnings e2e/fixtures/make-demo.mjs
```

`src/demo-fixture.test.js` keeps it valid (loads like an import) and free of anything `findSensitive()`
would flag.

## Taking screenshots

```bash
npm run build:renderer                              # browser mode serves dist/
node .claude/skills/ui-shots/shots.mjs --label=step-11-4 --views=overview,editor
node .claude/skills/ui-shots/shots.mjs --label=step-11-4-app --electron --widths=1280
```

| Option | Meaning |
|---|---|
| `--label=name` | output folder `scratch/shots/<name>` (gitignored) |
| `--views=a,b` | `overview,editor,profiles,settings` (dev: `styleguide`) |
| `--modes=dark,light` | color modes, written to `settings.appearance.mode` (schema v12) |
| `--accents=blue,coral,lilac,green` | accents, `settings.appearance.accent` |
| `--widths=1440,940` | window widths (`--height=900`); 940 is the app's `minWidth` |
| `--electron` | the real unpacked app, daten.json in a temp folder (never the real one) |
| `--hook=file.mjs` | `export default async (page, ctx) => {}` runs before each shot: clicks, typing, scrolling |
| `--set='{"layout":{"previewVisible":false}}'` | merged into `settings` (objects one level deep) |
| `--today=YYYY-MM-DD` | another frozen "today" |

The script prints the files and a **problems** list: page errors, console errors and warnings, and
horizontal overflow of the page or `<main>`. A problem means exit code 1.

## The check loop (after each edit block)

1. `npm run build:renderer`, then the script for the views you touched. When colors changed, run both
   modes and all four accents.
2. **Read every PNG** and compare it with `docs/DESIGN.md` and the "before" shot:
   - spacing on the 4 px grid, alignment
   - contrast, clipped text
   - accent only where DESIGN.md allows it
   - status shown never by color alone
3. Play through the shortcuts you touched with a `--hook` (e.g. `page.keyboard.press('Alt+3')`).
4. Fix, shoot again. Only commit when the shots and the problems list are clean.
5. End of a step: run once with `--electron` (title bar, native date field, clipboard over IPC).

Checks that should keep holding (exact preview text, shortcuts, persistence) go into `e2e/` as real tests.
