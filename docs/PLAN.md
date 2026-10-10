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

**Waiting for the user:** run the WebUntis probe (step 4.1) and send
`webuntis-probe.json`. Steps for the user (German in chat):

```bash
git fetch && git checkout claude/intelligent-curie-yxizss   # or main once merged
npm ci
npm run probe:webuntis      # close Berichtspilot first
```

Log in via the school portal → open the timetable (a week **with** lessons, e.g.
before the autumn break) → click one or two lessons that have notes → close the
window → check the file (only keys/types/lengths) → send it.

**When `webuntis-probe.json` arrives → step 4.1b (evaluate):**
- `captured[]`: find the call whose response shape contains the lesson notes
  (look for text fields that only appear after clicking a lesson, e.g. in a
  `calendar-entry/detail`-like call); note its URL pattern and required params.
- `candidates[]`: which of REST entries / public weekly / JSON-RPC
  `getTimetable` / homeworks work with the web session (status 200 + JSON).
- `session`: cookie lifetimes + `token.lifetimeSeconds` → how often the user
  must log in again.
- Record all of it in E-013 (set it to "accepted" with the chosen endpoint),
  add the SSO host from `navigatedHosts` to the ARCHITECTURE notes, and refine
  steps 4.3–4.6.

**Meanwhile (unblocked): step 4.2 — network layer `electron/net.js`.**
CommonJS module: `fetch` wrapper around `session.fetch` with a host allowlist
(only hosts listed in `docs/ARCHITECTURE.md`; start with
`bbz-dithmarschen.webuntis.com`), timeout (AbortController, ~15 s), readable
German error texts (offline, timeout, 401/403 → "Bitte erneut anmelden", 5xx);
pure parts (allowlist check, error mapping) tested with Vitest like
`electron/shape.test.mjs`. Not wired into any UI yet. The probe may then switch
to it.

When the speech recordings arrive: step 2.2 (speech spike) takes priority.

## Open questions (for the user)

1. **Sample recordings** for the speech spike (step 2.2): 2–3 short recordings
   (~20 s) describing a work day with IT terms — user will provide them later.
2. **Installer size:** the speech model adds roughly 150–500 MB (depending on the
   model) to installer and portable .exe — acceptable?
3. **WebUntis (E-013):** does the WebUntis profile offer data access for
   "Untis Mobile" (QR code / key under "Freigaben" or "Profil")? Does the Untis
   Mobile app work for you? Determines whether path W2 is possible.

## Roadmap

### Phase 0 — AI groundwork
- [x] Repo structure for AI work: `CLAUDE.md`, `docs/` knowledge base, skills,
      SessionStart hook (2026-10-09)
- [x] Docs, AI instructions and skills switched to English; glossary (2026-10-10)

### Phase 1 — Foundation
- [x] 1.1 English identifiers + `daten.json` fields, schema v3 with migration + tests (2026-10-10)
- [x] 1.2 Schema v4: `notes` (raw text) per day + collapsible "Notizen" field, searchable (2026-10-10)

### Phase 2 — Dictation (offline, model bundled — E-010)
- [x] 2.1 Notes → bullets without AI (pure `splitNotes()` + button) (2026-10-10)
- [ ] 2.2 Spike: choose the Whisper variant (German accuracy, size, speed,
      packaging for NSIS/portable/AppImage, CSP) → finalize E-010
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
- [ ] 4.1 Spike with the real account: SSO login in an embedded window (path W1),
      find the endpoint that returns lesson notes; check whether path W2 is available
      → finalize E-013
  - [x] 4.1a Probe built: `npm run probe:webuntis`, anonymiser `electron/shape.js`
        + tests (2026-10-10)
  - [ ] 4.1b User runs the probe → evaluate `webuntis-probe.json` → E-013
- [ ] 4.2 Network layer in main: `electron/net.js` — `fetch` wrapper with host
      allowlist, timeout, readable errors; Vitest for the allowlist
- [ ] 4.3 Session handling: login window (partition `persist:webuntis`), "logged
      in?" check, logout; secret store via safeStorage only if path W2 is used
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
| 2026-10-10 | Step 1.2: notes per day, schema v4 | 446a8f3 |
| 2026-10-10 | Step 2.1: notes → bullets without AI | 62a3932 |
| 2026-10-10 | Steps 3.1–3.4: clipboard bridge | d83e940 |
| 2026-10-10 | Step 4.1a: WebUntis probe | branch `claude/intelligent-curie-yxizss` |
