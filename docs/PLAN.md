# Overhaul plan: automating Berichtspilot

> **The baton between chats.** Every session reads "Next step" and "Open questions"
> first and updates both at the end. Tick off done items `[x]` with date/commit.
> Decisions → `DECISIONS.md`.

## Vision

Today: type activities from time tracking and WebUntis → app formats → copy three
blocks into the IHK portal.

Goal: **dictate a few sentences per day (customer details left out while
speaking), school topics come from WebUntis automatically, an AI turns the notes
into clean bullets** — the user only reviews and copies.

```
dictation (local, bundled model) ─┐
                                   ├─► raw notes per day ─► AI phrasing ─► week (as today) ─► copy to IHK
WebUntis lesson notes ────────────┘    (daten.json)         (E-011)        editable, exact     (portal automation
                                                                            output format        deferred, E-012)
```

## Guardrails

- "Easy to use": installer → works. No mandatory extra software (E-006).
- Local first; network only in the main process + allowlist (E-007).
- Nothing leaves the machine without the user seeing it (E-009 – E-011).
- Without network/accounts everything works like v1.2 (every automation is optional).
- Output format and `daten.json` safety stay untouched.

## Next step

**Step 1.1 — English identifiers + schema v3** (requested by the user, E-015)

Goal: all code names and `daten.json` fields in English, existing user data migrates
losslessly. UI texts and IHK output stay German.

- Rename identifiers in `src/lib/*`, `src/store.jsx`, `src/App.jsx`, `src/views/*`,
  `src/ui/*`, `electron/*` per `docs/GLOSSARY.md`; view files become
  `Overview.jsx`, `WeekEditor.jsx`, `Profiles.jsx`, `Settings.jsx`.
- IPC channels + preload API per the table in `docs/ARCHITECTURE.md`
  (`data:load` / `loadData()` …); IPC result fields `{ ok, data, path, fromBackup, error, canceled }`.
- CSS design tokens and theme ids in English (`--color-ink`, `northern-lights` …).
- `model.js`: `DATA_VERSION = 3`, migration step 2 → 3 maps every field/enum per the
  GLOSSARY table; `validateData()` and `mergeData()` work on v3; imports of v1/v2
  files keep working (migrate first, then validate).
- Tests: migration v1 → v3 and v2 → v3 (full fixture incl. periods, profiles,
  weeks, all enum values), unknown extra fields survive, newer version rejected.
  Format tests unchanged and green.
- Smoke test in browser mode (vite preview + Playwright): all four views render
  without console errors; a v2 dataset in localStorage is migrated and displayed.

Then: step 1.2.

## Open questions (for the user)

1. **AI phrasing (E-011):** Option A "clipboard bridge" (works with any chat AI you
   already use, no key, no cost, 2 pastes per week), option B "bundled local model"
   (fully automatic and offline, but weaker and +2–3 GB installer), or both?
   Recommendation: start with A, evaluate B in a spike.
2. **WebUntis:** name of the school / WebUntis server (e.g. `xyz.webuntis.com`) — no
   password. For the spike I'd write a small probe script you run locally that
   prints the (anonymised) structure of what WebUntis returns for one lesson.
3. **Installer size:** the speech model adds roughly 150–500 MB (depending on the
   model) to installer and portable .exe — acceptable?

## Roadmap

### Phase 0 — AI groundwork
- [x] Repo structure for AI work: `CLAUDE.md`, `docs/` knowledge base, skills,
      SessionStart hook (2026-10-09)
- [x] Docs, AI instructions and skills switched to English; glossary (2026-10-10)

### Phase 1 — Foundation for automation (not blocked)
- [ ] 1.1 English identifiers + `daten.json` fields, schema v3 with migration + tests
- [ ] 1.2 Schema v4: `notes` (raw text) per day + collapsible "Notizen" field in the
      week editor; `format.js` ignores notes
- [ ] 1.3 Network layer in main: `electron/net.js` — `fetch` wrapper with host
      allowlist, timeout, readable errors; Vitest for the allowlist
- [ ] 1.4 Secret store: `electron/secrets.js` (safeStorage, separate file), IPC
      `secret:set|has|delete` (values never go back to the renderer)
- [ ] 1.5 Settings → new section "Verbindungen & Automatik" (per feature on/off,
      status, credentials)

### Phase 2 — Dictation (offline, model bundled — E-010)
- [ ] 2.1 Spike: choose the Whisper variant (German accuracy, size, speed,
      packaging for NSIS/portable/AppImage, CSP) → finalize E-010
- [ ] 2.2 Microphone: `setPermissionRequestHandler` grants only `media` to the app window
- [ ] 2.3 Transcription in a utility process/worker, IPC `speech:transcribe`
- [ ] 2.4 UI: dictate button per day (recording state, level meter, cancel) → `notes`
- [ ] 2.5 Without AI: split notes into bullets with one click (sentence/line split)

### Phase 3 — AI phrasing (E-011)
- [ ] 3.1 User picks the option(s) (open question 1) → finalize E-011
- [ ] 3.2 Pure lib `src/lib/phrasing.js`: build the prompt (style rules from
      `OUTPUT_FORMAT.md`, few-shot examples from the user's own finished weeks) and
      parse a strictly formatted answer back into bullets per day; tests
- [ ] 3.3 Lightweight safety check before anything leaves the app: warn about
      patterns like IPs, e-mail addresses, phone and ticket numbers
- [ ] 3.4 Provider "clipboard bridge" (option A): copy prompt → paste answer →
      preview → accept/reject per day
- [ ] 3.5 Spike provider "local model" (option B): node-llama-cpp + small German-capable
      model; measure quality/speed on the notebook
- [ ] 3.6 School days: polish topic keywords per subject

### Phase 4 — WebUntis import (E-013)
- [ ] 4.1 Spike with a real account (probe script run by the user): login, timetable,
      where the lesson notes live → finalize E-013
- [ ] 4.2 `electron/webuntis.js` + mapping WebUntis subject → learning-field label (per profile)
- [ ] 4.3 "Woche aus WebUntis füllen": school days + subjects + topics from lesson
      notes; detect breaks/cancelled lessons

### Phase 5 — Comfort
- [ ] Auto-update (electron-updater, GitHub Releases)
- [ ] Friday reminder (tray/notification) if the current week is still a draft
- [ ] Create the current week automatically on start
- [ ] Ideas from the old README roadmap: light theme, "copy all 3 blocks",
      full export/PDF, copy a single day from the previous week, character counter
- [ ] Update the README "100 % offline" badge once network features exist

### Later / to-do
- [ ] Automatic entry into the IHK portal (deferred by the user, E-012)

## Done log

| Date | Step | Commit/PR |
|---|---|---|
| 2026-10-09 | Phase 0: AI groundwork | b32a115 |
| 2026-10-10 | Docs + AI instructions in English | branch `claude/intelligent-curie-yxizss` |
