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

**Phase 5 — auto-update, step 5.3: UI.** The main process is done (5.2): read
E-017 (incl. "Implementation") and the `update:*` rows in `ARCHITECTURE.md`.
Everything the UI needs is already in the store (`src/store.jsx`, `useStore()`):

- `update` — status `{ ok, state, current, version?, percent?, code?, error? }`,
  kept current by `update:changed` events (`null` until the first answer);
  `state` = `idle` | `checking` | `available` | `none` | `downloading` | `ready` |
  `error` | `unsupported` (dev, portable, browser mode — `error` holds a German
  reason). On `error`, `version` is set if a download failed (retry = download
  again), otherwise the check failed (retry = check again).
- `checkForUpdate()`, `downloadUpdate()` → resolve with the new status;
  `installUpdate()` saves `daten.json` first, then quits → `{ ok, error? }`.
- The start check already runs (store, once after load, only while
  `settings.updateCheck` is on).

Build:

- **Hint:** quiet, not modal. Proposal: an entry in the sidebar footer
  (`src/ui/Sidebar.jsx`, next to the storage badge) that appears only for
  `available` / `downloading` / `ready` / download `error`: "Update auf vX.Y.Z" →
  button "Herunterladen" → progress bar (`percent`) → "Neu starten und
  installieren". Plus one toast when `available` first appears (not on every
  start-check repeat in the same session).
- **Settings:** new section "Über" (or inside "Verhalten") in
  `src/views/Settings.jsx`: current version (`update.current`), switch "Beim
  Start nach Updates suchen" (`updateSettings({ updateCheck })`), button "Nach
  Updates suchen" with the result inline ("Du hast die neueste Version" /
  "Version X verfügbar" / German error / `unsupported` reason, button disabled
  then). Reuse `Switch`, `Button`, `Pill`, `Panel` from `src/ui/basics.jsx`.
- Verify: lint/test/build + browser smoke test (vite preview; mock
  `window.api` update functions in the page to walk through all states incl.
  progress) and `npm run build:win` + start the unpacked exe with
  `--user-data-dir=<scratch>` (otherwise it uses `%APPDATA%\Berichtspilot`):
  Settings must show v1.2.0 and "neueste Version". A scratch helper that
  evaluates JS in the running app via `--remote-debugging-port` + CDP worked
  well in 5.2.
- Then ask the open question below (real update test).

## Open questions (for the user)

- Real update test (after 5.3): tag a release with the updater (e.g. `v1.3.0`),
  install it, then publish a small follow-up (`v1.3.1`) and update in-app — or
  first a pre-release? Ask when 5.3 is done.

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
- [x] ~~3.5 School days: polish topic keywords per subject~~ — dropped by the user
      (2026-10-10): the raw "Lehrstoff" texts are good enough

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
        login retry, apply + undo (2026-10-10; real account checked by the user)

### Phase 5 — Comfort
- [ ] Auto-update (electron-updater, GitHub Releases) — E-017: check on start,
      download + restart only on click; portable build dropped
  - [x] 5.1 Decision E-017, `build.publish` (GitHub), release workflow attaches
        `latest*.yml` + `.blockmap`, tag/version guard, allowlist rows (2026-10-10)
  - [x] 5.2 Main process: `electron/updater.js`, IPC `update:*`, schema v8 switch
        `settings.updateCheck`, start check from the store (2026-10-10; real
        check against GitHub: v1.2.0 → `none`, allowlist verified in Electron)
  - [ ] 5.3 UI: update hint + Settings row
- [x] ~~Friday reminder if the current week is still a draft~~ — dropped by the
      user (2026-10-10): neither an in-app hint nor a system notification
- [x] Create the current week automatically on start — Mon–Fri only (E-016),
      schema v7 `settings.autoCreateWeek`, switch in Settings → Verhalten (2026-10-10)
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
| 2026-10-10 | Step 4.6b: "Aus WebUntis füllen" panel (browser smoke test with mocked API; real account checked by the user: works, one wrong topic from a parallel lesson) | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Fix: WebUntis topics matched per subject (stray parallel lesson), one detail call per time range — re-run by the user: LF08 correct | abbe2bb |
| 2026-10-10 | Phase 5: current week created on start (Mon–Fri, schema v7; browser smoke test with fixed clock Wed/Sat/Mon + v6 migration) | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Step 5.1: auto-update decision E-017, release plumbing, portable build dropped (local `build:win` writes `latest.yml` + `.blockmap` + `app-update.yml`) | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Step 5.2: `electron/updater.js` + IPC `update:*`, schema v8 `settings.updateCheck` (packaged build checked against the real repo → `none`; non-allowlisted host → `blocked`) | branch `claude/intelligent-curie-yxizss` |
