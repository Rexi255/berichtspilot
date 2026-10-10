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

**Step 2.2 — Spike: choose the local speech engine** (finalizes E-010)

Goal: a measured decision, not a guess. Model ships with the installer (user
decision). Candidates (see E-010 for details):

| Engine | Integration | Model sizes (German-capable) |
|---|---|---|
| whisper.cpp | native binary or Node addon in a utility process | base ~140 MB · small ~470 MB (q5 ~180 MB) · large-v3-turbo q5 ~550 MB |
| transformers.js (ONNX Whisper) | Web Worker in the renderer, WASM/WebGPU | similar sizes; CSP needs `'wasm-unsafe-eval'` |
| Vosk | Node binding | small German ~45 MB (noticeably weaker accuracy) |

Rejected up front: the browser Web Speech API (doesn't work in Electron without
a Google key and sends audio to Google anyway).

Tasks:
1. Prototype each viable engine in `scratch/` (not committed) with 3–4 German
   test recordings typical for the user (IT jargon: "DHCP", "Switch-Ports",
   "VLAN", "Active Directory"). Ask the user for 2–3 short sample recordings or
   use public-domain German speech if none are available.
2. Measure: word error rate on the jargon, real-time factor on the cloud CPU,
   RAM, size added to installer / portable .exe / AppImage, cold-start time.
3. Check packaging: electron-builder `extraResources` / `asarUnpack` for the
   binary + model on Windows (NSIS + portable) and Linux (AppImage).
4. Write the result table + recommendation into E-010 (DECISIONS.md), ask the
   user to confirm (and ideally to run the prototype once on the Windows notebook
   for speed), then set E-010 to accepted.

Then: steps 2.3–2.5 (mic permission, transcription IPC, dictate button).

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
- [ ] 3.2 Pure lib `src/lib/phrasing.js`: build the prompt (style rules from
      `OUTPUT_FORMAT.md`, few-shot examples from the user's own finished weeks) and
      parse a strictly formatted answer back into bullets per day; tests
- [ ] 3.3 Lightweight safety check before anything leaves the app: warn about
      patterns like IPs, e-mail addresses, phone and ticket numbers
- [ ] 3.4 Provider "clipboard bridge" (option A): copy prompt → paste answer →
      preview → accept/reject per day
- [ ] 3.5 School days: polish topic keywords per subject (after WebUntis delivers them)

### Phase 4 — WebUntis import (E-013)
- [ ] 4.1 Spike with the real account: SSO login in an embedded window (path W1),
      find the endpoint that returns lesson notes; check whether path W2 is available
      → finalize E-013
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
| 2026-10-10 | Step 2.1: notes → bullets without AI | branch `claude/intelligent-curie-yxizss` |
