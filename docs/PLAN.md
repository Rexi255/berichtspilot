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

**Step 2.1 — Notes → bullets without AI**

Goal: notes (typed, pasted or — later — dictated) become bullets with one click.
Useful right away and the fallback whenever no AI is used.

- New pure module `src/lib/notes.js` with `splitNotes(text)` → `string[]`:
  split on line breaks and on sentence ends (`.`, `!`, `?` followed by space +
  capital letter or end), strip bullet characters/numbering (same regex as
  `pasteFromClipboard` in `WeekEditor.jsx` — move that regex into the module and
  reuse it there), trim, drop empty items, keep abbreviations like "z. B.",
  "u. a.", "ca.", "Nr." and decimal numbers intact.
- Tests `src/lib/notes.test.js`: multi-line input, run-on sentences, bullet
  characters, numbering, abbreviations, empty input.
- UI (`DayCard` in `WeekEditor.jsx`, inside the open notes area): button
  "In Stichpunkte übernehmen" (work days: append to `bullets`, replacing empty
  placeholders; school days: hidden for now — subjects need mapping, phase 4).
  Keep the notes (user may delete them manually); toast with the count.
- Verify: lint, tests, build, browser smoke test; update CHANGELOG.

Then: step 2.2 (speech engine spike).

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

### Phase 1 — Foundation
- [x] 1.1 English identifiers + `daten.json` fields, schema v3 with migration + tests (2026-10-10)
- [x] 1.2 Schema v4: `notes` (raw text) per day + collapsible "Notizen" field, searchable (2026-10-10)

### Phase 2 — Dictation (offline, model bundled — E-010)
- [ ] 2.1 Notes → bullets without AI (pure `splitNotes()` + button)
- [ ] 2.2 Spike: choose the Whisper variant (German accuracy, size, speed,
      packaging for NSIS/portable/AppImage, CSP) → finalize E-010
- [ ] 2.3 Microphone: `setPermissionRequestHandler` grants only `media` to the app window
- [ ] 2.4 Transcription in a utility process/worker, IPC `speech:transcribe`
- [ ] 2.5 UI: dictate button in the notes area (recording state, level meter, cancel) → `notes`

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
- [ ] 4.2 Network layer in main: `electron/net.js` — `fetch` wrapper with host
      allowlist, timeout, readable errors; Vitest for the allowlist
- [ ] 4.3 Secret store: `electron/secrets.js` (safeStorage, separate file), IPC
      `secret:set|has|delete` (values never go back to the renderer)
- [ ] 4.4 Settings → new section "Verbindungen" (WebUntis on/off, server, school,
      user, status)
- [ ] 4.5 `electron/webuntis.js` + mapping WebUntis subject → learning-field label (per profile)
- [ ] 4.6 "Woche aus WebUntis füllen": school days + subjects + topics from lesson
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
| 2026-10-10 | Docs + AI instructions in English | a81b351 |
| 2026-10-10 | Step 1.1: English identifiers, schema v3 | 33a971f |
| 2026-10-10 | Step 1.2: notes per day, schema v4 | branch `claude/intelligent-curie-yxizss` |
