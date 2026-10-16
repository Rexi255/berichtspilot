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

**Session handling (step 4.3, 2026-10-10):** `electron/webuntis-session.js`.
The bearer token never leaves the main process and is never written to disk —
it is cheap to re-fetch from the web session, so no `safeStorage` is needed for
W1 (only the partition's cookies persist, managed by Chromium). Login is
detected by polling `token/new` every 2 s while the login window is open; the
window closes itself on success. A 200 answer that is not a JWT counts as "not
logged in". Note: `token/new` sends the bare JWT labelled `application/json`
(not valid JSON) — it is read with `request(…, { expect: 'text' })`.
Tested with the real account (2026-10-10): login detected, window closes
itself, status returns the person id. **The login does not survive an app
restart** — WebUntis' web session is a session cookie, which Chromium drops on
exit even in a `persist:` partition. Accepted by the user: logging in again is
two clicks via SSO and only needed when importing; no workaround to keep
session cookies alive. W2 (QR code) stays the option if it becomes annoying. `logout()` bumps a generation counter so a token request still in
flight cannot re-populate the cache afterwards.

**Settings UI (step 4.4, 2026-10-10):** `daten.json` stores only
`settings.webuntis.enabled` (schema v5) — no server/school (fixed by the
allowlist, shown read-only), no user name, person id or token (rule 5). Off is
the default and means no WebUntis request at all; switching off also logs out
(wipes the partition locally).

**Enforcing the switch (review fixes, 2026-10-10):** the switch is enforced in
the main process, not in the Settings component — `src/store.jsx` mirrors the
flag via `webuntis:setEnabled` on load and on every change (toggle, import,
hand-edited file), and `webuntis-session.js` answers every token/status/login
call with `code: 'disabled'` while off. Switching off logs out there, and a
login window closed by that logout sends no final token check. Import
"Ersetzen" keeps the device's switch (`replaceData()`): the opt-in to network
access must not come from someone else's shared file. Since the web session
never survives a restart, the session starts as "known logged out" and
`status()` answers from memory until a login or token succeeds — opening the
settings sends no request; only "Anmelden" asks the server.

**Week fetch (step 4.5a, 2026-10-10):** `electron/webuntis.js` `fetchWeek()`.
The trimming happens in main: only subject short/long name, lesson times,
status and `teachingContent` cross IPC — teacher, class and room names,
`notesAll` and ids stay in the main process (customer/third-party data
minimisation, rule 6). A lesson carries `topics: []` (not one string): one block
can have several `teachingContent` values (`calendarEntries[]` and their
`singleEntries[]`). Detail calls run at most 3 at once; a failed one only leaves
that lesson's topics empty. The pure normaliser `schoolDaysFromWebuntis()`
merges **all** lessons of one subject on a day (not only adjacent double
periods), because the record lists each subject once per day; subjects whose
lessons were all cancelled are returned as `cancelledSubjects` for the import
preview. Checked with the real account (user, 2026-10-10): topics arrive;
`MY_TIMETABLE` can contain parallel lessons (group splits/courses) and
mixed-case short names (`kom`, `wipo`) — handled in 4.5b (case-insensitive
mapping, "ignore") and 4.6 (untick in the preview).

**Subject mapping (step 4.5b, 2026-10-10):** user: WebUntis mostly shows
abbreviations (`kom` = Kommunikation, `wipo` = Wirtschaft und Politik); `pfk` is
usually a support teacher attending the lesson (→ "ignore"); the parallel
`LF08`/`LF10` on Wednesdays is an error in the school's timetable (really only
`LF10`) — a one-off, so it is handled by unticking in the 4.6 preview, not by a
mapping. Matching order in `mapSubjects()`: saved entry in
`profile.webuntisSubjects` (`''` = ignore) → profile label equal to the
WebUntis short **or long** name under `subjectKey()` (case, spaces, leading
zeros ignored, so `kom`/"Kommunikation" and `LF7`/`LF07` match without an
entry) → otherwise reported as unmapped. The map lives in the profile (schema
v6) because subject labels are per half-year; it is shared data, not a secret.

**Fill rules (step 4.6a, 2026-10-10):** `fillWeekFromWebuntis()` only ever
*adds*: it touches only days that are `school` + `normal` in the week (WebUntis
shows work days as days without lessons, so it must never create a school day,
and it never overrides holiday/vacation/sick); a subject gets the topics only if
all its bullets are empty, a missing subject is appended, written text is never
replaced. A WebUntis school break (`HOLIDAY`) is only reported, not applied —
the profile/period data stays the source of truth for the day type. Unticking in
the preview is done by filtering the mapped days before the call, so the same
function produces the preview (`changes`) and the applied week.

**Preview UI (step 4.6b, 2026-10-10):** the panel fetches once per open and keeps
the normalised school days; mapping changes ("zuordnen") re-run `mapSubjects()`
on that cache, so no second request. A mapping chosen in the preview is saved to
the profile right away (it is a fact about the timetable, not about this import).
Only subjects of days that would actually be filled are offered for mapping.
"Übernehmen" recomputes `fillWeekFromWebuntis()` on the week as it is at click
time (via `dropSubjects()`), so edits made while the panel is open are respected.

**Topics per subject, not per time slot (2026-10-10, real-account check):** the
detail call asks for a time range and returns *every* calendar entry in that
slot. The school's timetable lists a stray `LF08` parallel to `LF10` (Wed 3rd
double period, a teacher who doesn't exist yet), so `LF08` got LF10's topic
"Aktuelles zur Politik". Fix in `electron/webuntis.js`: a lesson only takes the
`teachingContent` of entries whose `subject` (`shortName`/`longName`/
`displayName`, or a `subjects[]` list) matches its own subject; if the answer
names no subjects at all, every entry is used as before. The field name is
assumed from the WebUntis v2 API and confirmed by the user's re-run
(2026-10-10): `LF08` now shows only its own topic. Parallel lessons
with the same times now share one detail request.

### E-014 · Keep the file name `daten.json` · accepted
Field names became English in schema v3, but the file name stays: existing
installations, portable copies, backups (`.bak1–3`) and the README all rely on it.
Renaming would risk "lost" data for no functional gain.

### E-015 · Language policy · accepted
User (2026-10): everything programming-related is English (code, identifiers,
comments, `daten.json` fields, docs, skills, commits, PRs, changelog). Only the UI
and the IHK output stay German. Mapping in `GLOSSARY.md`.

### E-016 · Create the current week on start: Mon–Fri only · accepted
User (2026-10-10): the working week is Mon–Fri — nothing happens at the weekend,
so an automatic week there is unnecessary. `shouldAutoCreate()` (`src/lib/model.js`)
creates the running week once on start only on Mon–Fri, only inside
`trainingStart`/`trainingEnd` if those are set, and never twice. It uses
`newWeek()` (profile, holidays, periods), not the previous week as a template.
The switch `settings.autoCreateWeek` (schema v7, default on) is a plain preference
and travels with export/import (unlike the WebUntis opt-in).

### E-017 · Auto-update: check on start, download + install only on click; no portable build · accepted
User (2026-10-10), asked with three options — (a) check on start, show "Update
verfügbar", download + restart only after a click; (b) download silently, install
on quit; (c) only a link to the release page — picked **(a)**: nothing happens
behind the user's back, in line with E-009 – E-011. The portable `.exe` cannot
replace itself; offered "hint + download link" or "drop it", the user **dropped
the portable build**. Releases now ship the NSIS installer and the AppImage only.

- **Mechanics:** `electron-updater` with the GitHub provider (`build.publish` in
  `package.json` → `app-update.yml` in the app, `latest.yml` /
  `latest-linux.yml` next to the artifacts; checked locally with
  `npm run build:win`, 2026-10-10). `autoDownload = false`,
  `autoInstallOnAppQuit = false`: the user clicks "Herunterladen", then
  "Neu starten und installieren". NSIS updates are differential via the
  `.blockmap`; the AppImage carries its blockmap inside and is replaced in place
  (same folder, so a `daten.json` next to it stays where it is).
- **Hosts** (electron-updater 6.8 source, public repo): `github.com`
  (`/releases.atom`, `/releases/latest`, `/releases/download/<tag>/…`) and the
  download redirect target `release-assets.githubusercontent.com` (checked with
  `curl` on the v1.2.0 assets). `api.github.com` is **not** used (only for
  GitHub Enterprise/private repos). electron-updater does its own requests in
  the session partition `electron-updater`, not through `electron/net.js` — step
  5.2 enforces the allowlist on that partition.
- **When it checks:** only in the packaged app (never in dev), only for the NSIS
  install and the AppImage (`APPIMAGE` set). Extends E-007: like every network
  feature it gets a switch (planned: Settings, default on); "Nach Updates
  suchen" by hand always works. The request reveals only the IP address and the
  app version — no training data.
- **Releases:** the tag must equal `package.json` `version` (guard step in
  `release.yml`), otherwise `latest.yml` would announce the wrong version.
  v1.2.0 and older have no updater: the first release with this code has to be
  installed by hand once.
- **Former portable users:** E-004 is unchanged (a self-built portable copy still
  keeps `daten.json` next to the exe). Moving to the installer = export/import,
  or copy `daten.json` into `%APPDATA%\Berichtspilot`.
- **Implementation (step 5.2, 2026-10-10):** `electron-updater` pinned to
  6.8.9 (the source checked above). Details chosen while building:
  - A newest release **without** `latest*.yml` (v1.2.0, or assets still
    uploading) raises `ERR_UPDATER_CHANNEL_FILE_NOT_FOUND`; it counts as "no
    update", not as an error (checked against the real repo: v1.2.0 → `none`).
  - Install = `quitAndInstall(true, true)`: the NSIS installer runs **silently**
    into the existing folder and restarts the app — the assisted installer's
    wizard would otherwise reappear on every update. The click on "Neu starten
    und installieren" is the consent. The store saves `daten.json` before the
    call (the 400 ms autosave would be lost on quit).
  - The switch `settings.updateCheck` is a per-device opt-in like the WebUntis
    switch: import "Ersetzen" keeps the device's value.
  - The allowlist sits on the `electron-updater` partition (opened with the
    same `{ cache: false }` electron-updater uses); checked in real Electron
    that a non-allowlisted host ends as `code: 'blocked'`.
- **Review fixes (2026-10-10, after 5.3):**
  - electron-updater sends a random per-install UUID (`x-user-staging-id`,
    stored in `userData/.updaterId`) with every request — for staged rollouts,
    which we don't use. It is stripped via `webRequest.onBeforeSendHeaders` on
    the same partition, so "only IP + app version" above stays true.
  - "NSIS install" = packaged win32 **and** an `Uninstall *.exe` next to the
    exe. An unpacked folder (`release/win-unpacked`, a copied folder) is
    `unsupported` — the silent installer would otherwise install a second copy
    instead of updating that folder. A local update test therefore needs the
    installed build, not `win-unpacked`.
  - `quitAndInstall()` returns nothing and reports a refused install only via a
    synchronous `'error'` event — `install()` listens for it during the call
    and answers `{ ok: false }`; a second call after a successful one is a
    no-op (a refused repeat would reset electron-updater's own double-call
    guard). The renderer keeps the "installing" flag in the store, shared by
    the sidebar card and Settings.
  - GitHubProvider wraps the 404 of `/releases/latest` (no production release)
    as `ERR_UPDATER_INVALID_RELEASE_FEED`; it is recognised by its nested
    message and counts as "no update" (`ERR_UPDATER_LATEST_VERSION_NOT_FOUND`
    never surfaces).

### E-018 · The overhaul ships as v2.0.0; it stays on its branch until complete · accepted
User (2026-10-10): the overhaul is big enough for a major version — it becomes
**v2.0.0**, not 1.3.0. All work stays on `claude/intelligent-curie-yxizss`;
nothing is merged into `main` (and no release is tagged) until V2 is complete,
including the additions the user still wants to name. Consequences: v2.0.0 is
the first release with the updater and has to be installed by hand once (E-017);
the real in-app update test happens after it (e.g. v2.0.0 → v2.0.1).
`package.json` `version` is bumped to 2.0.0 only as part of the release step.

*Addendum (user, 2026-10-10):* the V2 scope is closed without further
additions. The planned UI overhaul becomes **v2.1** (workflow in `PLAN.md` →
"Later / to-do"); voice dictation stays parked until the model choice (E-010).
The release step is done on the branch (README, version 2.0.0, CHANGELOG); what
remains is merging into `main` and tagging `v2.0.0`.

### E-019 · WebUntis address entered by the user, only `*.webuntis.com` · accepted
User (2026-10-10, before the v2.0.0 release): the school must not be built into
the app — everyone enters their own WebUntis address. Settings → "Verbindungen"
has an address field; the user pastes the address of their school's WebUntis
login page, `parseWebuntisAddress()` keeps only the host and the `school`
parameter (schema v9: `settings.webuntis.host` + `school`).

Allowlist (E-007) without a fixed host: the configured host is the only one
WebUntis requests may reach, and it must match `<name>.webuntis.com` (one label —
the WebUntis cloud). Checked three times: when parsing in the renderer, in
`migrateData()`, and — the real boundary — in the main process (`cleanServer()`
/ `isWebuntisHost()`), which passes it per request to `request({ hosts })`;
`fetchWeek()` checks it once more before sending the token. Self-hosted
WebUntis servers outside `webuntis.com` are not supported (would need an
explicit, reviewed exception). Changing the address logs out (the session
belongs to the old school). Existing files get an empty address — entered once
by hand, no school is pre-filled. The probe reads the address from daten.json.
Considered: searching schools by name via Untis' school search service — nicer,
but another external host; possible later.

### E-020 · Setup wizard on a fresh install · accepted
User (2026-10-10, before the v2.0.0 release): a fresh install should open a
setup wizard that can be skipped or walked through, so nobody has to hunt
through Settings and Profiles first. Steps: welcome (start · import an export ·
skip) → training start/end (+ quick durations 2–3.5 years) and federal state →
current half-year profile (suggested Aug–Jan / Feb–Jul, weekdays work/school/off,
subjects) → WebUntis address (optional, E-019) → start behavior (auto-create
week, update check) → summary.

- Trigger: schema v10 `settings.setupDone` — `false` only in `seedData()`;
  migrated files get `true` (they are set up). Skipping sets it too, so the
  wizard never nags; Settings → Verhalten can open it again (UI state only).
- While it is open, no week is auto-created (it would get the seed's sample
  profiles); finishing creates the current week like a normal start would.
- Applying (`applySetup()`, pure, tested): on a fresh install the wizard's
  profile replaces the seed's sample profiles; on a re-run it edits the profile
  valid today in place, or is added in front. WebUntis off keeps a stored address.
- No WebUntis login inside the wizard: the main process only learns the address
  once it is saved; the login happens the first time "Aus WebUntis füllen" is
  used. Considered for later: filling school days + subjects straight from the
  WebUntis timetable during setup.

### E-021 · One starter bullet per work day · accepted
User (2026-10-10, right after v2.0.0): two empty bullets per work day get in
the way — Enter in the first bullet inserts a new one instead of moving to the
empty second one. The default `defaultBulletCount` drops from 2 to 1 (seed,
`newProfile()`, setup wizard, fallback in `newWeek()`/`weekFromTemplate()`).
Schema v11 lowers stored profiles from 2 to 1: 2 was the default nobody had a
reason to pick, so it is treated as "not chosen"; any other value is kept.
Weeks that already exist are left alone. Considered: Enter jumping into an
empty bullet below instead of inserting — possible later, but one bullet
already removes the problem.

### E-022 · The main window only shows the app; IPC only from the app page · accepted
Code review (2026-10-15, user asked for it): the main window had no navigation
guard and the IPC handlers didn't check the caller. A page the window navigated
to — Chromium opens a file dropped onto the window in place — got the full
`window.api` from the preload; a test page overwrote `daten.json` with
`saveData()` (shown in a scratch folder), and three more saves would have
rotated every `.bak` out. Fix (step 7.1):

- `will-navigate` / `will-redirect` only to the app URL (`createAppUrlCheck()`:
  the built `index.html` compared as a file path — Windows drive-letter case and
  percent-encoding can't cause a mismatch — or the dev server origin when
  unpacked); no `<webview>`.
- Every IPC handler goes through `handle()`: sender must be the main window's
  WebContents, top frame, app URL (`isTrustedSender()`), else `code: 'forbidden'`.
- `data:save` checks the record's shape (`checkSaveData()`), schema-version
  agnostic so a schema bump never needs a main-process change.
- Permission requests: only `clipboard-sanitized-write`; dictation adds `media`
  later. Checked in Electron: copying works, notifications/geolocation denied.
- Smaller items from the same review: the renderer ignores dropped files, the
  production CSP drops the dev server hosts, `VITE_DEV_SERVER_URL` and the
  screenshot flags only count in unpacked runs.

Considered: a navigation guard alone — rejected, the sender check is the safety
net if a navigation path is ever missed (iframes, future features).

### E-023 · Saving: one write at a time, flush before closing · accepted
Code review (2026-10-15): two overlapping saves (a save slower than the 400 ms
autosave delay — virus scanner, USB stick — or the save before an update
install) shared `daten.json.tmp`; in a simulation one of each pair failed with
`ENOENT` ("Fehler beim Speichern!") and `daten.json` briefly pointed at a file
still being written. Closing the window within 400 ms of the last keystroke
dropped that change (reproduced in Electron: typed, closed at once → text
missing). Extends E-003, nothing weakened (step 7.2):

- `electron/storage.js` (`createStorage()`, tested against a temp folder) owns
  load + save. Writes run one after another; while one runs, only the newest
  waiting state is kept, and superseded callers get the newer result. The
  steps stay tmp + fsync → `.bak1–3` → atomic rename.
- The final rename is retried on `EPERM`/`EBUSY`/`EACCES` (Windows scanners and
  indexers lock fresh files briefly): 50, 100, 200, 400, 800 ms, then error.
- Close handshake: the window's `close` is held, main sends `app:flush`, the
  store's `flush()` writes a pending (or previously failed) save, the preload
  answers `app:flushed`. A failed save asks "Trotzdem schließen?"; a crashed
  renderer or no answer within 3 s doesn't block closing. `will-quit` waits for a
  running write. Checked in Electron: typed + closed at once → saved; failing
  write → window stays open with the question.
