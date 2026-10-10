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
WebUntis "Lehrstoff" ─────────────┘    (daten.json)         (E-011)        editable, exact     (portal automation
                                                                            output format        deferred, E-012)
```

## Guardrails

- "Easy to use": installer → works. No mandatory extra software (E-006).
- Local first; network only in the main process + allowlist (E-007).
- Nothing leaves the machine without the user seeing it (E-009 – E-011).
- Without network/accounts everything works like v1.2 (every automation is optional).
- Output format and `daten.json` safety stay untouched.

## Next step

**A) Manual check of step 4.6b with the real account (user, ~5 min)** — the
WebUntis panel is built and smoke-tested against a mocked `window.api` only.
Ask the user to run `npm run dev`, switch WebUntis on (Einstellungen →
Verbindungen), open a past school week in the editor and click "Aus WebUntis
füllen". Check: login prompt when logged out ("Anmelden" → retry), preview per
day, unticking the wrong Wed `LF08` lesson, "zuordnen" for an unknown subject
(saved in the profile, preview updates without a new fetch), apply → toast with
"Rückgängig", written text untouched. Record the result (and what the real
"Lehrstoff" texts look like — terse? teacher shorthand?) in the Done log, fix
anything found as `fix:` commits.

**B) Then: step 3.5 or Phase 5** — depends on the open question below. If the
raw topics are good enough, skip 3.5 and take Phase 5 "Create the current week
automatically on start": in `src/store.jsx` after loading, if
`settings.autoCreateWeek` (schema v7, default `true`, toggle in Settings →
Allgemein) and the current Monday has no week → `newWeek(monday, profiles,
periods)` once per start; pure helper `shouldAutoCreate(data, todayISO)` in
`src/lib/model.js` + tests (not on Sat/Sun? — decide with the user), migration
test v6 → v7, `DATA_MODEL.md`, CHANGELOG.

## Open questions (for the user)

- After the first real "Aus WebUntis füllen" run: are the "Lehrstoff" texts good
  enough as bullets, or should step 3.5 polish them (e.g. include school days in
  the clipboard-bridge prompt)? Options: (a) keep raw, edit by hand; (b) extend
  "Mit KI formulieren" to school subjects. Recommendation: decide on real data.

Parked by the user (2026-10-10), not to be asked now: which speech model to
bundle (E-010 has the measurements; real-voice recordings belong to that
decision).

## Roadmap

### Phase 0 — AI groundwork
- [x] Repo structure for AI work: `CLAUDE.md`, `docs/` knowledge base, skills,
      SessionStart hook (2026-10-09)
- [x] Docs, AI instructions and skills switched to English; glossary (2026-10-10)

### Phase 1 — Foundation
- [x] 1.1 English identifiers + `daten.json` fields, schema v3 with migration + tests (2026-10-10)
- [x] 1.2 Schema v4: `notes` (raw text) per day + collapsible "Notizen" field, searchable (2026-10-10)

### Phase 2 — Dictation (offline, model bundled — E-010) · on hold (model choice parked by the user)
- [x] 2.1 Notes → bullets without AI (pure `splitNotes()` + button) (2026-10-10)
- [x] 2.2 Spike: whisper.cpp CLI with whisper base/small/large-v3-turbo and
      parakeet v3 measured → E-010 (2026-10-10); model choice parked
- [ ] 2.3 Microphone: `setPermissionRequestHandler` grants only `media` to the app window
- [ ] 2.4 Transcription in a utility process/worker, IPC `speech:transcribe`
- [ ] 2.5 UI: dictate button in the notes area (recording state, level meter, cancel) → `notes`

### Phase 3 — AI phrasing (E-011)
- [x] 3.1 User picked option A, the clipboard bridge → E-011 accepted (2026-10-10)
- [x] 3.2 Pure lib `src/lib/phrasing.js`: prompt with style rules + the user's own
      bullets as examples, tolerant answer parser; tests (2026-10-10)
- [x] 3.3 Safety check before copying: warns about e-mail/IP/MAC/ticket/phone
      patterns (2026-10-10)
- [x] 3.4 Clipboard bridge UI ("Mit KI formulieren"): copy prompt → paste answer →
      preview per day → apply, undoable (2026-10-10)
- [ ] 3.5 School days: polish topic keywords per subject (after WebUntis delivers them)

### Phase 4 — WebUntis import (E-013)
- [x] 4.1 Spike with the real account: probe `npm run probe:webuntis` +
      anonymiser `electron/shape.js`; W1 works, endpoints for week + lesson
      topics found, W2 (QR code) available → E-013 accepted (2026-10-10)
- [x] 4.2 Network layer in main: `electron/net.js` — `fetch` wrapper with host
      allowlist, timeout, readable errors; Vitest for the allowlist (2026-10-10)
- [x] 4.3 Session handling: `electron/webuntis-session.js` (login window in
      partition `persist:webuntis`, token cache with renewal, status, logout) +
      `electron/jwt.js`; IPC `webuntis:status|login|logout` (2026-10-10)
- [x] 4.4 Settings → new section "Verbindungen": WebUntis on/off (schema v5
      `settings.webuntis.enabled`), school read-only, status, login/logout (2026-10-10)
- [x] 4.5a `electron/webuntis.js` week fetch (timetable + "Lehrstoff" per block) + pure
      normaliser `schoolDaysFromWebuntis()`; IPC `webuntis:week` (2026-10-10, real account checked)
- [x] 4.5b Mapping WebUntis subject → profile label: `mapSubjects()` (auto by short/long
      name, case/leading zeros ignored), schema v6 `profile.webuntisSubjects`, list in
      Profiles → "WebUntis-Fächer" (2026-10-10)
- [x] 4.6 "Woche aus WebUntis füllen": school days + subjects + topics from lesson
      topics ("Lehrstoff" = `teachingContent`); detect breaks/cancelled lessons
  - [x] 4.6a pure merge logic `fillWeekFromWebuntis()` (only fills empty subjects of
        normal school days, appends missing ones, reports the rest) (2026-10-10)
  - [x] 4.6b UI: `src/views/WebuntisPanel.jsx` — preview per day with untick/assign,
        login retry, apply + undo (2026-10-10; real-account check pending)

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
| 2026-10-10 | Step 1.2: notes per day, schema v4 | 446a8f3 |
| 2026-10-10 | Step 2.1: notes → bullets without AI | 62a3932 |
| 2026-10-10 | Steps 3.1–3.4: clipboard bridge | d83e940 |
| 2026-10-10 | Step 4.1a: WebUntis probe | 49967e2, 6200d15 |
| 2026-10-10 | Step 4.1b: probe evaluated, E-013 accepted | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Step 2.2: speech spike (model parked) | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Step 4.2: network layer `electron/net.js` | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Step 4.3: WebUntis session handling (real login tested by the user 2026-10-10: window closes itself, `loggedIn: true` + person id; login does not survive an app restart — accepted) | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Step 4.4: Settings → "Verbindungen" (WebUntis), schema v5 | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Step 4.4 review fixes: switch enforced in main, import keeps it | 3fb95f7 |
| 2026-10-10 | Step 4.5a: WebUntis week fetch + normaliser (real account checked by the user) | f9c4b79 |
| 2026-10-10 | Step 4.5b: WebUntis subject mapping, schema v6 | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Step 4.6a: `fillWeekFromWebuntis()` merge logic | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Step 4.6b: "Aus WebUntis füllen" panel (browser smoke test with mocked API; real account pending) | branch `claude/intelligent-curie-yxizss` |
