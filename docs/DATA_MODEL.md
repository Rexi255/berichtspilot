# Data model — `daten.json`

Current schema version: **8** (`DATA_VERSION` in `src/lib/model.js`).
One JSON file holds the configuration **and** every training week. It is also the
export/backup format. The file name stays German (`daten.json`) for compatibility
with existing installations (DECISIONS E-014); all field names are English.

## Structure

```jsonc
{
  "version": 7,
  "settings": {
    "trainingStart": "2025-08-01",   // optional; progress line + gap detection
    "trainingEnd": "2028-07-31",
    "theme": "northern-lights",      // a theme id from src/index.css
    "startView": "overview",         // overview | editor | profiles | settings
    "snippets": ["…"],               // user-defined autocomplete suggestions
    "webuntis": { "enabled": false }, // WebUntis import on/off (schema v5) — only
                                     // the switch: server/school are fixed by the
                                     // allowlist, login state lives in main
    "autoCreateWeek": true,          // schema v7: create the current week on start
                                     // (Mon–Fri, inside the training period)
    "updateCheck": true              // schema v8: look for a new app version on
                                     // start (E-017); checking by hand always works
  },
  "periods": [                       // vacation / school breaks
    { "id": "period-…", "type": "vacation" | "schoolBreak", "label": "", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }
  ],
  "profiles": [                      // one profile per school half-year
    {
      "id": "profile-…",
      "name": "Schulhalbjahr 2025/26 · 2",
      "state": "SH",                 // federal state code (STATES in holidays.js)
      "validFrom": "2026-02-02",
      "validTo": "2026-07-31",
      "defaultBulletCount": 2,       // empty bullets per work day on creation
      "weekdays": {
        "mon": { "type": "school", "subjects": ["LF02", "LF03", "Englisch", "WiPo"] },
        "tue": { "type": "work", "subjects": [] },
        "…": "…",
        "sat": { "type": "off", "subjects": [] }
      },
      "webuntisSubjects": {           // schema v6: WebUntis short name → subject label
        "kom": "Kommunikation",       // only for differing names (identical ones,
        "pfk": ""                     // incl. case/leading zeros, map automatically);
      }                               // "" = ignore this WebUntis subject on import
    }
  ],
  "weeks": [                         // sorted by id (ascending)
    {
      "id": "2026-04-20",            // Monday of the week = primary key
      "status": "draft" | "done",
      "instructions": "",            // output block 2, free text
      "days": [
        {
          "date": "2026-04-20",
          "type": "work" | "school",
          "status": "normal" | "holiday" | "sick" | "vacation",
          "holidayName": null,       // set when status = holiday
          "notes": "",               // raw text (dictation/AI input) — never in the output
          "bullets": ["…"],          // used when type = work
          "subjects": [{ "label": "LF02", "bullets": ["…"] }]  // used when type = school
        }
      ]
    }
  ]
}
```

## Rules

- **Profile selection:** `profileForDate()` with the **Wednesday** of the week; the
  first matching profile wins. No match ⇒ fallback Mon–Fri work.
- **Day status on creation:** holiday > vacation period > normal. School-break
  periods turn school days into work days.
- **Weeks are snapshots:** later profile edits don't change existing weeks.
- `off` days don't appear in `week.days` at all.
- Ids: `newId(prefix)` → `prefix-<time36>-<counter36>`; weeks use their Monday date.
  Ids are opaque — old ids with German prefixes (`profil-…`) stay valid.

## Migrations

`migrateData(raw)` in `model.js`:

| from → to | Change |
|---|---|
| 1 → 2 | added `zeitraeume: []`, `einstellungen.startAnsicht`, `einstellungen.textbausteine` |
| 2 → 3 | all field names and enum values German → English (full mapping in `GLOSSARY.md`) |
| 3 → 4 | `notes: ''` added to every day (existing values kept) |
| 4 → 5 | `settings.webuntis = { enabled: false }` (existing value kept); `validateData()` rejects a non-boolean `enabled` |
| 5 → 6 | `webuntisSubjects: {}` added to every profile (existing value kept); `validateData()` rejects non-string values |
| 6 → 7 | `settings.autoCreateWeek = true` (existing value kept); `validateData()` rejects a non-boolean value |
| 7 → 8 | `settings.updateCheck = true` (existing value kept); `validateData()` rejects a non-boolean value |

Defensive defaults after migration: `settings` that is not an object becomes `{}`;
`settings.webuntis` that is not an object, or whose `enabled` isn't `true`, becomes
"off" (`enabled: false`). `settings.autoCreateWeek` is only off for a real
`false` — missing or malformed values become `true` (the default); the same
holds for `settings.updateCheck`. Import "Ersetzen" (`replaceData()`) keeps the
device's current `settings.webuntis` and `settings.updateCheck` — opt-ins to
network access are not taken from a shared file. `profile.webuntisSubjects` that is not an object becomes `{}`, and
entries with non-string values are dropped. Keys are compared with
`subjectKey()` (`src/lib/webuntis.js`: case, spaces, leading zeros ignored);
`setMapping()` keeps one entry per key. The map is part of the shared record (no
secrets) — it travels with export/import like the rest of the profile.

Versions newer than `DATA_VERSION` are **rejected** (downgrade protection: otherwise
autosave would overwrite the file with an older structure).

**Schema change checklist:** `DATA_VERSION`++ → step in `migrateData()` → check
`validateData()` / `mergeData()` → test "old file → new structure" in
`model.test.js` → update this file + the table above → CHANGELOG.

## What does NOT belong in daten.json

API keys, passwords, session tokens (→ `safeStorage`, separate file), audio
recordings, caches, model files. `daten.json` gets exported and possibly shared.
