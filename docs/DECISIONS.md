# Decisions (ADR log)

Short log of fundamental decisions so they aren't re-discussed in every chat.
Append new entries at the bottom; never delete — mark outdated ones as
"superseded by E-xxx".

Status: **accepted** · **proposed** (waiting for a spike or the user) · **deferred** · **superseded**

---

### E-001 · Electron + Vite + React + Tailwind · accepted (v1.0)
Native desktop app for Windows + Arch Linux from one codebase. GSAP/Lenis for animation.

### E-002 · A single `daten.json` as the database · accepted (v1.0, reconfirmed 2026-10)
Configuration + all weeks in one JSON file: trivial export/import, human-readable,
portable. No SQLite — the data volume (~150 weeks) is tiny. The user reconfirmed for
the overhaul: "simple export of the database" stays mandatory.

### E-003 · Safe saving · accepted (v1.1)
tmp file + fsync → rolling backups `.bak1–3` → atomic `rename`; on load, automatic
fallback to the newest intact backup.

### E-004 · Data location · accepted (v1.1)
Dev → CWD; portable → next to the executable if writable; otherwise `userData`.

### E-005 · Offline holidays · accepted (v1.0)
Gauss Easter formula + per-state tables, no API.

---

## Overhaul "automation" (from 2026-10)

### E-006 · Keep Electron · accepted
The user allows a stack change only if the app stays "easy to use" (download,
install, works). Electron satisfies that; existing data, tests and UI remain usable.
No rewrite.

### E-007 · Local first, network only where unavoidable · accepted
Network only for WebUntis and (optionally) AI phrasing. Requests only from the main
process, host allowlist in `ARCHITECTURE.md`. Renderer CSP stays free of external
hosts. Every network feature can be switched off; without network the app works
like v1.2.

### E-008 · Secrets via `safeStorage` · accepted
API keys/passwords encrypted (OS keychain / DPAPI / libsecret) in a separate file
next to `daten.json`, never inside it (it gets exported). Linux without a keyring:
disable the feature with a hint instead of storing plaintext.

### E-009 · Work activities via dictation, no time-tracking import · accepted
User (2026-10): they keep short notes/sentences anyway; copying from the
time-tracking tool is cumbersome because of customer data. Instead they **speak**
their activities per day and leave out customer-specific details while talking.
Dictation → raw `notes` per day → AI turns them into clean bullets. **No
time-tracking import** is planned.

### E-010 · Local speech recognition, model bundled in the installer · deferred (spike done)
Audio never leaves the machine. User (2026-10): the model ships **with the
installer** (no download on first use). Engine still to be chosen in a spike:
whisper.cpp binary vs. ONNX/transformers.js in a worker/utility process. Criteria:
German accuracy, model size (installer and portable .exe size!), speed on the
Windows notebook, packaging for NSIS/portable/AppImage, CSP compatibility (WASM).
Candidates: whisper.cpp (binary/addon in a utility process), transformers.js
(ONNX Whisper in a worker), Vosk (small but weaker). Rejected: the Web Speech API
(no service in Electron without a Google key; audio would go to Google).
User (2026-10): installer growth of 150–500 MB is acceptable. **Reopened:** the
user asked whether the OS dictation (Windows: Win+H voice typing, works in any
text field incl. the "Notizen" field) is enough — that would make step 2.2–2.5
unnecessary. Waiting for the user to try it (see PLAN open questions).
**Answer (user, 2026-10-10):** Win+H is buggy on their home PC — the OS tool is
no substitute; other speech-to-text tools should be considered.

**Spike (step 2.2, 2026-10-10)** — whisper.cpp nightly `b5454` CLI (prebuilt
`whisper-bin-x64.zip`, 9 MB; `whisper-bin-ubuntu-x64.tar.gz` exists for Linux),
3 German clips (56 s total, synthetic voice "Hedda", IT jargon: Active
Directory, VLAN, Veeam, WSUS, PowerShell …), i9-9900K limited to 4 threads.
WER = word error rate after lower-casing and stripping punctuation/hyphens.

| Model (ggml) | Size | Time for 56 s | WER | Notes |
|---|---|---|---|---|
| whisper base q5_1 | 60 MB | 8 s | 18.6 % | "Hektiv-Direktary", "Pauers-Hells-Kript" |
| whisper small q5_1 | 190 MB | 22 s | 7.7 % | |
| whisper small q5_1 + vocabulary prompt | 190 MB | 17 s (greedy) | 4.2 % | `--prompt` with IT terms fixes most jargon |
| whisper large-v3-turbo q5_0 (± prompt) | 574 MB | 62–75 s | 1.8 % | slower than real time even on the i9 |
| parakeet-tdt-0.6b-v3 q4_0 (`parakeet-cli`) | 356 MB | 8 s | 9.4 % | very fast, no prompt support; CC-BY-4.0 |

Findings: the engine question is settled independently of the model — the
**whisper.cpp CLI as a child process of main** (prebuilt binary per platform,
no native Node addon, no WASM, no CSP change; whisper and parakeet models run
on the same binaries). Input: WAV/FLAC/MP3/OGG, so the renderer would capture
16 kHz PCM and encode WAV. A vocabulary prompt (could be built from the user's
own earlier bullets) is the cheapest accuracy gain. Synthetic speech is easier
than a real voice — re-check with real recordings before choosing.
Recommendation was whisper small (+~200 MB installer).

**Decision (user, 2026-10-10): leave the speech model out for now** and decide
later. Phase 2 (steps 2.3–2.5) is on hold; notes are typed for the time being.

### E-011 · AI phrasing without an own API key · accepted (option A)
User (2026-10): preferably cloud quality, but **not via an API** (no key/billing).
Research result (2026-10):

| Option | Cloud? | Key/cost | Automation | Notes |
|---|---|---|---|---|
| A · **Clipboard bridge**: app builds the prompt, user pastes it into any chat AI (Claude.ai, ChatGPT, Gemini — free plans work), copies the answer back; app parses it | yes | none | semi (2 pastes per week) | ToS-compliant; user sees exactly what is sent; works with whatever AI they already use |
| B · **Bundled local LLM** (e.g. node-llama-cpp + 3–4B GGUF model, ~2–3 GB) | no | none | full, offline | quality lower than cloud but adequate for rephrasing short notes; installer gets much larger; CPU speed on the notebook to be measured |
| C · Free API tiers (Gemini free tier, Mistral "Experiment") | yes | free key, one-time setup | full | still an API key; Gemini free tier may use content to improve Google products; Mistral free tier trains on data unless opted out |
| D · Paid API (Claude/OpenAI) | yes | key + pay-per-use (cents/week) | full | ruled out by the user |
| E · Use the user's chat subscription programmatically / script the web UI | yes | — | — | **rejected**: Anthropic forbids subscription OAuth in third-party apps; scripting web UIs violates ToS and breaks easily |

Recommendation: build a provider abstraction; ship **A** first (zero setup, cloud
quality, fits "easy to use"), evaluate **B** as the fully automatic offline option
in a spike. C/D can be added later as optional providers.

**Decision (user, 2026-10): option A, the clipboard bridge.** Only work days for
now; the prompt and the answer format are built/parsed by the pure module
`src/lib/phrasing.js`. B stays a possible later upgrade, not planned.

### E-012 · Automatic entry into the IHK portal · deferred
User (2026-10): leave it out for now, keep it on the to-do list. Previous idea
kept for later: an embedded `BrowserWindow` (separate partition, minimal preload),
user logs in, app fills the three fields, user clicks submit.

### E-013 · WebUntis import via the main process · accepted (path W1)
User (2026-10): the lesson topics are written in the **notes of each lesson** in
WebUntis. Plan: fetch the timetable incl. lesson notes from the main process,
map WebUntis subjects → learning-field labels per profile.

School: `https://bbz-dithmarschen.webuntis.com/WebUntis/?school=bbz-dithmarschen`.
**Login runs via the school's SSO portal** ("BBZconnect", authentik) — there is
probably no WebUntis password, so the classic JSON-RPC `authenticate`
(username/password) is unlikely to work. Two candidate auth paths:

| Path | How | Pros | Cons |
|---|---|---|---|
| W1 · **Embedded SSO login** | app opens WebUntis in its own `BrowserWindow` (partition `persist:webuntis`, no preload, no Node); user logs in via the school portal; main process then calls the WebUntis web API with that session's cookies | works with any SSO; app never sees the password | user must log in again when the session expires |
| W2 · **"Untis Mobile" access key** | WebUntis profile → data access ("Freigaben") shows a QR code / secret for the mobile app; app stores user + secret via `safeStorage` and logs in with one-time codes | fully automatic, no repeated login | only if the school enables mobile access; reverse-engineered, unofficial protocol |

Recommendation: W1 first (most likely to work with SSO), W2 as an optional
comfort upgrade if the school allows it. Still to verify in the spike with the
real account: which endpoint returns the lesson notes for student accounts (the
web UI's internal REST API is the likely source; JSON-RPC `getTimetable` only has
short texts).

**Probe (step 4.1, 2026-10-10):** `npm run probe:webuntis` (see CONTRIBUTING)
records, with the real login, which API calls the web UI makes and what
structure the responses have — anonymised (`electron/shape.js`). Deviation from
the plan: instead of `webRequest.onCompleted` (URLs only) the probe attaches the
DevTools protocol (`webContents.debugger`) to the probe window, because only
that sees response **bodies** — so we learn which call carries the lesson notes
without guessing endpoints. Bodies stay in memory; only their shape is written.

**Probe result (2026-10-10, user's account, Windows):**
- **W1 works.** SSO login runs via `login.bbz-dithmarschen.de` (only navigated in
  the login window, never fetched by the main process). Afterwards the session
  gets a bearer token from `GET /WebUntis/api/token/new` (JWT, **15 min**
  lifetime, renewable via the same call while the web session lives; payload has
  `person_id`, `tenant_id`, `roles: ["STUDENT"]`). The web session cookie's
  lifetime is unknown (the probe queried cookies for path `/`, the session cookie
  lives under `/WebUntis`) → the app must simply detect an expired session
  (token/new no longer returns a JWT) and offer a new login.
- **Week overview:** `GET /WebUntis/api/rest/view/v1/timetable/entries?start=&end=
  &format=4&resourceType=STUDENT&resources=<person_id>&periodTypes=&timetableType=MY_TIMETABLE`
  with `Authorization: Bearer` → `days[]` with `date`, `status`
  (`REGULAR`/`NO_DATA`), `gridEntries[]` (`duration.start/end`, `type`
  `NORMAL_TEACHING_PERIOD`/`EXAM`, `status` `REGULAR`/`CANCELLED`/`CHANGED`,
  `position2[].current` = subject with `shortName`/`longName`, `lessonInfo`,
  `notesAll`, `texts[]` typed `LESSON_INFO`/`NOTES_FOR_ALL`) and `backEntries[]`
  (`type: HOLIDAY` → school break).
- **Lesson topics:** `GET /WebUntis/api/rest/view/v2/calendar-entry/detail?elementId=<person_id>
  &elementType=5&startDateTime=<lesson start>&endDateTime=<lesson end>&homeworkOption=DUE`
  — called per lesson block with the exact times from `gridEntries[].duration`
  (a whole-week range returns nothing) → `calendarEntries[].teachingContent`
  ("Lehrstoff", up to ~60 chars, also per period in `singleEntries[]`) and
  `notesAll` ("Notizen", short). This is the source for the school block.
  **User (2026-10-10): the lesson topic is in "Lehrstoff"** → import
  `teachingContent` only; `notesAll` is not used for topics.
- Also working but not needed: JSON-RPC `getTimetable` with the web session (no
  topic texts), `/api/public/timetable/weekly/data` (`periodText`),
  `/api/homeworks/lessons`.
- **W2** (Untis Mobile QR code) is available for the user's account (2026-10) —
  kept as an optional comfort upgrade if logging in again turns out to be
  annoying; not planned now.

**Network layer (step 4.2, 2026-10-10):** `electron/net.js` — `request()` with
host allowlist (https only, no credentials/odd ports), 15 s timeout, no redirects
followed, `{ ok, … }` results with German error texts. Checked against the real
server: without a session, `/WebUntis/api/token/new` answers 302 → `index.do`;
Electron's `session.fetch` rejects that under `redirect: 'manual'` with
"Redirect was cancelled", which `net.js` maps to "Bitte erneut anmelden."

### E-014 · Keep the file name `daten.json` · accepted
Field names became English in schema v3, but the file name stays: existing
installations, portable copies, backups (`.bak1–3`) and the README all rely on it.
Renaming would risk "lost" data for no functional gain.

### E-015 · Language policy · accepted
User (2026-10): everything programming-related is English (code, identifiers,
comments, `daten.json` fields, docs, skills, commits, PRs, changelog). Only the UI
and the IHK output stay German. Mapping in `GLOSSARY.md`.
