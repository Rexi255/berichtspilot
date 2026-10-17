# src/lib/ — pure domain logic

- **Pure functions only:** no React, no `window`, no `api`, no side effects.
  Everything must run in Vitest without a DOM.
- **Every file has a test next to it** (`foo.js` → `foo.test.js`). New function ⇒
  new test. Bug fix ⇒ first a test that reproduces the bug.
- `format.test.js` contains the **real IHK examples** from `docs/OUTPUT_FORMAT.md`.
  Those expected strings are the spec — change the code, never the test.
  Output strings stay German (weekday names, "den", "Feiertag: …", "Krankheitstag").
- Dates: only via the helpers in `dates.js` (`parseISO`, `toISO`, `addDays`,
  `daysBetween` …). Tests run in `Europe/Berlin` (`test.env` in `vite.config.js`)
  so DST bugs show up; date tests around the clock change (end of March / end
  of October) are welcome.
- Holidays: back new/changed holidays with state + source in a comment and test at
  least two years.
- `model.js`: schema change ⇒ bump `DATA_VERSION`, add a step to `migrateData()`,
  adapt `validateData()`, add a test "old file → new structure", update
  `docs/DATA_MODEL.md`.
- New modules for the overhaul (dictation parsing, WebUntis mapping, AI prompt
  building/response parsing) belong here as long as they are pure.
