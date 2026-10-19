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
- V2 is released (v2.0.0 on 2026-10-10, E-018). All work goes to the branch
  `development`; `main` only receives a merge per release (E-025); a release is
  a version bump + PR `development` → `main` + tag `vX.Y.Z` (E-017).

## Next step

**Branch workflow since 2026-10-17 (E-025):** every session works on
`development` (`git fetch origin development && git checkout development`, even
if the session names a `claude/…` branch) and pushes there. No PR between
releases; a release step opens the PR `development` → `main`. One exception
so far: on 2026-10-20 the user asked to bring both branches level after
v2.0.3 — the post-release docs and the dev-only `@eslint/js` bump (#17) went
to `main` by PR; the app code on `main` is still exactly v2.0.3.

**The user continues locally in VS Code (Claude Code extension) from
2026-10-17.** Locally git uses the user's own credentials — tag pushes and
branch deletions work there (the 403s were the cloud proxy only). Before
pushing a tag or merging into `main`, still ask the user.

**v2.0.3 is out** (2026-10-19, `latest.yml` = 2.0.3, an immutable release).
It ships Electron 44.7, the Dependabot PRs #7/#9 (8.5, 8.6) and phases 9–10
(fuses + asar integrity E-029, release workflow E-030, end-to-end tests
E-031). PR #16 merged as a merge commit (183a6e1, same tree as the dry-run
commit 21d4956), annotated tag `v2.0.3` on it, release run 39325719252 green
— the first real run of the new `release` job (draft → five files →
published, `isImmutable: true`). Feed checked via `/releases/latest/download/`:
both `latest*.yml` = 2.0.3, `sha512` + size match the published installer and
AppImage. `main` fast-forwarded back into `development`.
The user's installed app updated to 2.0.3 and works ("alles funktioniert",
2026-10-20).

**Release procedure** (as done for 2.0.3; the repository rules since
2026-10-19, 9.3b, enforce parts of it): `npm version X.Y.Z
--no-git-tag-version` (package.json + lock) → CHANGELOG `## [X.Y.Z] - <date>`
with an intro line → commit + push to `development` → dry run of exactly
that commit (`gh workflow run release.yml --ref development`) → PR
`development` → `main`; `main` only takes it once `pruefen` + `e2e` are green
and only as a merge commit (`gh pr merge <n> --merge`) → **ask the user** →
annotated tag `git tag -a vX.Y.Z <merge commit> -m "Berichtspilot X.Y.Z"` +
push (works because the user is admin: bypass of the `Release tags` ruleset)
→ watch the run, check the feed → fast-forward `development` to `main`.
Releases are immutable: a published release can't get new or replaced files,
a broken one is fixed with the next patch version — so the dry run right
before tagging matters.

**Next: the UI overhaul (v2.1)** — "Later / to-do" → its workflow step 1
(baseline: demo `daten.json` fixture + project skill `ui-shots`). The *what*
is still open: ask the user what bothers them in the current UI before step 2.

**Dependabot** (E-027) opens its PRs against `development` on Mondays. Merge
green ones with `gh pr merge <n> --squash` (the repo deletes merged branches
itself since 2026-10-17); Electron PRs only
after the checks in E-027, electron-builder/-updater after the checks named in
`.github/dependabot.yml`. Its config is read from `main` (current since the
v2.0.3 merge); dev-tool majors that still show up are closed with a short
comment (like #10–#12).
Dependabot **security** updates (on since 2026-10-19) target `main` instead:
merge those with `--merge` (the `main` ruleset allows nothing else), then
merge `main` back into `development`. SHA pinning is required since
2026-10-19; Dependabot's own update runs work with it (checked 2026-10-19
right after the v2.0.3 merge — they opened #17). Dependabot alert #1
(`sprintf-js` ≤ 1.1.3, moderate, no fix yet) sits in the dev-only chain
electron-builder → @electron/get → global-agent → roarr and doesn't ship
(`npm audit --omit=dev` = 0); it goes away with an electron-builder update.

Electron support window: 44.x stays supported until Electron 47 is out; 45
(beta on 2026-10-17) will come as a Dependabot PR — check it per E-027.

## Open questions (for the user)

1. **Step 9.3b — the account part is left for the user (no decision
   needed):** two-factor authentication is on (user, 2026-10-20); still
   open: a passkey or security key as the 2FA method if it isn't one yet,
   recovery codes stored offline, revoke unused tokens and OAuth/GitHub apps
   (`CONTRIBUTING.md` → "Maintainer checklist", first item). Claude's `gh`
   token can't read or change account settings.
   The repository part is done: on the user's request Claude set it via
   `gh api` on 2026-10-19 and read it back — rulesets `Release tags`
   (`refs/tags/v*`; creation/update/deletion/force push restricted; bypass
   Repository admin = the user, `current_user_can_bypass: always`), `main`
   (default branch; no deletion/force push; PR with 0 approvals, merge method
   *merge* only; checks `pruefen` + `e2e`, not strict; no bypass) and
   `development` (no deletion/force push); SHA pinning required; release
   immutability on; Dependabot alerts + security updates on. Already right
   before: workflow token read-only, Actions can't approve PRs, secret
   scanning + push protection on.

(Answered 2026-10-19: release v2.0.3 now — the user gave the go.)

(Answered 2026-10-17: code signing (9.4) — stay unsigned, E-028. v2.0.2 is released with 8.4 — phase 7 plus 8.1–8.3;
the user's update test to 2.0.2 works and "Automatically delete head
branches" is on (checked: `deleteBranchOnMerge: true`).
Dependabot: "calmer, and Electron 44 now" → E-027, 8.5, 8.6. Release tags from
cloud sessions: overtaken by the move to local sessions, which can push the
tag after the user's go — so 9.1 needs no tag-creating manual start; that
option only matters if releases ever come from cloud sessions again.)

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
- [x] Auto-update (electron-updater, GitHub Releases) — E-017: check on start,
      download + restart only on click; portable build dropped (2026-10-10)
  - [x] 5.1 Decision E-017, `build.publish` (GitHub), release workflow attaches
        `latest*.yml` + `.blockmap`, tag/version guard, allowlist rows (2026-10-10)
  - [x] 5.2 Main process: `electron/updater.js`, IPC `update:*`, schema v8 switch
        `settings.updateCheck`, start check from the store (2026-10-10; real
        check against GitHub: v1.2.0 → `none`, allowlist verified in Electron)
  - [x] 5.3 UI: sidebar card `src/ui/UpdateHint.jsx` (download → progress →
        install, one toast per version), Settings → "Updates", pure state
        mapping `src/lib/update.js` (2026-10-10)
  - [x] Review fixes (2026-10-10): refused install reported, single install
        call, staging-id header stripped, `win-unpacked` unsupported, 404 of
        `/releases/latest` = "no update"; unreadable `daten.json` + backups
        block loading instead of seeding over them (see E-017)
- [x] ~~Friday reminder if the current week is still a draft~~ — dropped by the
      user (2026-10-10): neither an in-app hint nor a system notification
- [x] Create the current week automatically on start — Mon–Fri only (E-016),
      schema v7 `settings.autoCreateWeek`, switch in Settings → Verhalten (2026-10-10)
- [x] README "100 % offline" badge → "local-first · online optional" (2026-10-10)

### Phase 6 — V2 release (E-018)
- [x] V2 scope closed by the user: no further additions, UI overhaul → v2.1 (2026-10-10)
- [x] README overhaul: "New in 2.0", updates + upgrading from 1.x, privacy &
      network table, new screenshots from fictional demo data (2026-10-10)
- [x] `package.json` + lock → 2.0.0, `CHANGELOG.md` `## [2.0.0] - 2026-10-10`,
      ARCHITECTURE diagram + DATA_MODEL example brought up to date (2026-10-10)
- [x] Own WebUntis address instead of the built-in school (user, E-019): address
      field in Settings → "Verbindungen", `parseWebuntisAddress()`, schema v9
      `settings.webuntis.host` + `school`, main accepts only `*.webuntis.com`,
      `webuntis:setEnabled` → `webuntis:configure` (2026-10-10; Electron screenshots
      with/without address + v8 → v9 migration checked; real login still open)
- [x] Setup wizard on a fresh install (user, E-020): `src/lib/setup.js` +
      `src/views/SetupWizard.jsx`, schema v10 `settings.setupDone`, re-run from
      Settings → Verhalten (2026-10-10; driven end to end in Electron via CDP:
      fresh install → all steps incl. errors → daten.json checked; skip + re-run)
- [x] Release dry run: local `build:win` → `Berichtspilot-Setup-2.0.0.exe` +
      `latest.yml` (version 2.0.0) (2026-10-10)
- [x] PR #1 merged into `main` (674cea3, CI green) (2026-10-10)
- [x] Tag `v2.0.0` → release workflow green → GitHub release "Berichtspilot 2.0.0"
      (Latest, not draft) with installer, `.blockmap`, AppImage, `latest.yml`,
      `latest-linux.yml`; `/releases/latest/download/latest.yml` = 2.0.0 (2026-10-10)
- [x] Installed by hand once; real in-app update test — done with 2.0.2
      (user, 2026-10-17)

### Phase 7 — Hardening (v2.0.2) · from the code review of 2026-10-15
The user asked for a review of the whole project and then for its "step 1":
close the security gap in the main window and make saving loss-proof before
anything new is built.
- [x] 7.1 Main window locked to the app: navigation (`will-navigate`) and
      foreign IPC senders refused (`electron/guard.js`), permission requests
      denied except clipboard writing, `data:save` checks the shape, dropped
      files are ignored, dev flags (`--screenshot`) only unpackaged, production
      CSP without `localhost` (2026-10-16; E-022; checked in Electron: navigation to
      a file is cancelled, copying works, notifications/geolocation denied,
      `saveData(null)` refused, dev server mode and `--screenshot` still work)
- [x] 7.2 Save pipeline (`electron/storage.js`): one write at a time (queue, newest
      state wins), rename retried on Windows lock errors, pending autosave
      flushed on close (handshake `app:flush`), writes finish before quit
      (2026-10-16; E-023; Electron: typed + closed at once → saved, the commit
      before lost it; failing write → window stays open and asks)
- [x] 7.3 Snapshots in `sicherungen/` next to `daten.json` (E-022): one per day
      (30 kept), plus before an app update (schema change), an import
      "Ersetzen" and a restore (10 each); restore in Settings → Daten; load
      falls back to the newest snapshot (2026-10-16; E-024; Electron: v10 file →
      daily + vor-update snapshot with the v10 state; browser mode: restore and
      import flows with a fake bridge)
- [x] 7.4 Error boundary around the views (title bar stays usable) + dialog on a
      renderer crash (2026-10-16; browser mode: a hand-broken week → message in
      the view, sidebar + window buttons work, Settings reachable; Electron:
      `Page.crash` → native dialog)
- [x] 7.5 Small bugs, each with a test: training progress off by one after the
      DST switch, holiday name always from SH, toast timers restarting, undo
      of AI/WebUntis resetting the whole week, template date math via
      `new Date('YYYY-MM-DD')`, load errors hanging at "Lade Daten …" (2026-10-16;
      `daysBetween()`, `trainingProgress()`, `withStatus()`, `restoreDays()`;
      tests now run in Europe/Berlin; browser mode: old build vs. new — undo
      kept the other day's edit, toast A left on time, broken file → error screen)
- [ ] 7.6 Release → moved to 8.4, so v2.0.2 also ships the Electron security
      update (see "Open questions" for an earlier release)

### Phase 8 — Maintenance automation
- [x] 8.1 Electron 43.0.0 → 43.8.0 (four Electron advisories, all fixed from
      43.4.2 on); `npm audit fix` without `--force`: `js-yaml` 4.3.2 inside
      electron-updater (prod audit now clean), electron-builder 26.17.0 and
      dev tools in the lock. Left: 8 moderate advisories in dev-only
      `sprintf-js` (electron-builder → `@electron/get` → `global-agent` →
      `roarr`), only "fixable" by downgrading electron-builder (2026-10-17;
      Electron via CDP: all views, file navigation cancelled, `window.open`
      denied, typed + closed at once → saved, restart → text back; `build:linux`
      → AppImage starts on 43.8.0, real update check → `none`)
- [x] 8.2 Node 24 LTS instead of the planned 22 (E-026: 22 is EOL 2027-04-30,
      Electron 43 runs Node 24, npm 11 matches the lock) in `ci.yml`,
      `release.yml`, `.nvmrc`; `engines` ≥ 22.12; CONTRIBUTING + README; CI also
      runs `npm run build:renderer` (2026-10-17; clean `npm ci` + lint/tests/build
      with Node 24.22 / npm 11.21)
- [x] 8.3 `.github/dependabot.yml`: npm + github-actions weekly (Monday,
      Europe/Berlin) against `development`, 7-day cooldown; groups: Electron
      (majors too), electron-builder, electron-updater (pinned, E-017) each on
      their own, everything else minor + patch together (2026-10-17; valid
      against the SchemaStore `dependabot-2.0` schema, a typo'd key fails it)
- [x] 8.4 Release v2.0.2 (phase 7 + 8.1–8.3, user 2026-10-17): version bump,
      CHANGELOG section, release notes from it, PR #6 merged into `main`
      (merge commit 885a4ca, E-025), tag `v2.0.2` pushed from the local session
      on the user's go → release workflow green, release "v2.0.2" Latest with
      installer, `.blockmap`, AppImage, `latest.yml`, `latest-linux.yml`;
      `/releases/latest/download/latest.yml` = 2.0.2 (2026-10-17; the user's real
      in-app update to 2.0.2 works)
- [x] 8.5 Dependabot calmer (user, E-027): semver majors ignored for every npm
      package except `electron` (pattern coverage checked against
      `package.json`, config valid against the SchemaStore schema); #10–#12
      (`@eslint/js` 10, `eslint` 10, `vitest` 5) closed with a comment; #7
      (checkout/setup-node v7, action-gh-release v3 — Node 24 runtimes, no
      input changes) and #9 (React 19.3, Vite 8.3, Tailwind 4.3.3 …) squashed
      into `development` (2026-10-17)
- [x] 8.6 Electron 43.8 → 44.7 (#8, rebased onto #9 first). Breaking changes
      read: `clipboard` gone from the renderer (we only use it in main) and
      async in main (`clipboard:read` returns the promise, `ipcMain.handle`
      awaits it — no code change); `net.request` frame destinations,
      ia32/armv7l, macOS 12 don't apply. Node inside: 24.21 (CI stays on 24).
      Checked on Windows (2026-10-17): lint/tests/build; Electron via CDP —
      wizard, all views, "Aus Zwischenablage" (two lines → two bullets, umlauts
      intact), "Kopieren" of block 1 (exact text incl. blank lines), file
      navigation cancelled, `window.open` → null, notifications denied,
      `saveData(null)` refused, typed + closed at once → saved, restart → text
      back; the real `electron/updater.js` against the live release (as 2.0.1
      → `available 2.0.2`, as 2.0.2 → `none`, redirects to
      `release-assets.githubusercontent.com` allowed, staging header not sent);
      `build:win` packs 44.7.0, the unpacked app starts from `app.asar`

### Phase 9 — Release hardening (supply chain)
- [x] 9.1 `release.yml`: `check` → `build` (read-only token, `persist-credentials:
      false`, packaged check, files as run artifacts) → `release` (tags only, the
      only job with `contents: write`, no checkout/npm, insists on exactly the
      five files); every action in `release.yml` + `ci.yml` pinned to a commit
      SHA with `# vX.Y.Z` (E-030) (2026-10-17; dry runs on `development`: the
      first found a test race on Linux, the second green — run 39063403845;
      its artifacts checked like the `release` job would: five files + notes,
      `sha512` matches. The `release` job itself ran green for the first time
      with v2.0.3 on 2026-10-19, run 39325719252)
- [x] 9.2 Electron fuses in `build.electronFuses`: `runAsNode`,
      `enableNodeOptionsEnvironmentVariable`, `enableNodeCliInspectArguments`
      off, `onlyLoadAppFromAsar` + asar integrity on (E-029) (2026-10-17;
      Windows: RUN_AS_NODE/NODE_OPTIONS/--inspect ignored, tampered asar →
      FATAL, `resources/app/` refused; dev mode + `npm start` unaffected — the
      probe uses the same unfused dev binary; Linux: packaged check in CI)
- [x] 9.3 Checklist for the user's GitHub settings in `CONTRIBUTING.md` →
      "Maintainer checklist" (2FA/passkey, tag ruleset `v*`, rulesets for
      `main`/`development`, SHA pinning required, release immutability,
      Dependabot alerts) + current state read via the API (2026-10-17)
- [ ] 9.3b Apply the checklist — repository settings done by Claude on the
      user's request (2026-10-19, rulesets + SHA pinning + release
      immutability + Dependabot alerts/security updates); account part
      (2FA/passkey, tokens) open for the user (see "Open questions" 1)
- [x] ~~9.4 Code signing for the Windows installer~~ — the user chose to stay
      unsigned (2026-10-17, E-028)

### Phase 10 — Tests beyond `src/lib`
- [x] 10.1 Playwright smoke test against `vite preview` (browser mode via
      `browserApi`): fresh start → skip wizard → create week → type a bullet →
      exact text in output block 1 (+ copied text, reload); `npm run test:e2e`,
      CI job `e2e` (E-031) (2026-10-17; green on Windows and in CI)
- [x] 10.2 Electron end-to-end via Playwright `_electron` under xvfb: close
      right after typing keeps the text, restart shows it; plus the
      `packaged` project the release workflow runs after each build (fuse
      wire + start from `app.asar` over CDP) (2026-10-17; mutation checks:
      flush disabled → fails, unfused binary → fuse check fails)

### Later / to-do
- [ ] Warning list for customer data: a local list of customer names / host
      names that the "Mit KI formulieren" check warns about (the regex
      patterns can't know names)
- [ ] Export of the whole record as PDF/archive (e.g. for the exam registration)
- [ ] Automatic entry into the IHK portal (deferred by the user, E-012)
- [ ] Rename `vite.config.js` → `vite.config.mjs`: Vite 8 warns that the
      config is ESM loaded as CommonJS (`configLoader: 'native'` will become
      the default in a future major)
- [ ] Release hardening, further (E-029/E-030 "considered"): `npm ci
      --ignore-scripts` in the release build jobs (check which install
      scripts the build needs first); serve the renderer from a custom
      `app://` protocol, then turn the `grantFileProtocolExtraPrivileges` fuse
      off; build provenance attestations
- [ ] Linux: set `desktopName` + `linux.syncDesktopName: true` in the
      electron-builder config so desktops link the running window to the
      AppImage's `.desktop` entry (hint printed by electron-builder 26.17)
- [ ] Ideas from the old README roadmap: light theme, "copy all 3 blocks",
      full export/PDF, copy a single day from the previous week, character counter
- [ ] **UI overhaul — planned for v2.1, not part of V2** (user, 2026-10-10).
      Workflow agreed in chat (the *how*; the *what* is still open):
  1. Baseline: demo `daten.json` fixture (no customer data, reusable for README
     screenshots) + project skill `.claude/skills/ui-shots/` that builds the
     renderer and screenshots every view/state/theme via `--screenshot` from a
     scratch folder (unset `ELECTRON_RUN_AS_NODE`).
  2. Explore 2–3 directions in Claude Design (claude.ai/design), seeded with the
     existing "Nordlicht" tokens + `src/ui/basics.jsx`; layout/workflow of the
     week editor first, colors later. Code stays the source of truth afterwards.
  3. Record the result in `docs/DESIGN.md` (principles, tokens, components,
     anti-patterns) + a DECISIONS entry; plan a light theme into the tokens.
  4. Implement inside-out, one commit per step: tokens → `basics.jsx` → shell
     (Titlebar/Sidebar/toast) → one view per step. Store API and `src/lib/` untouched.
  5. Review per view: `design:accessibility-review`, `design:design-critique`,
     `design:ux-copy` (German).
  - Tooling: one taste skill only (`design-taste` *or* the `frontend-design`
    plugin), no `ui-styling` (shadcn = new UI framework); Playwright MCP against
    `vite preview` + context7 (Tailwind v4); `ask` permission on
    `src/lib/format.js`, `format.test.js`, `docs/OUTPUT_FORMAT.md`; optional
    read-only `ui-reviewer` subagent.
  - Pitfalls: CSP → fonts only via `@fontsource`, no CDNs; every new token in
    every `data-theme` block; never change the output blocks' content.

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
| 2026-10-10 | Step 5.3: update UI — sidebar card + Settings → "Updates" (browser smoke test with mocked `window.api` through all states; `build:win` unpacked exe: v1.2.0, real GitHub check → "neueste Version"). User: overhaul ships as v2.0.0 (E-018) | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Code-review fixes (updater install/headers/support check, load-error guard; Electron screenshot with corrupt `daten.json` + backups: files untouched). Not fixed by choice: a deleted current week is auto-created again on the next start (would need a schema change) | branch `claude/intelligent-curie-yxizss` |
| 2026-10-10 | Phase 6: V2 release prepared — README + screenshots, version 2.0.0, CHANGELOG, docs check, local `build:win` dry run | PR #1 |
| 2026-10-10 | E-019: own WebUntis address (schema v9, `webuntis:configure`, only `*.webuntis.com`) | PR #1 |
| 2026-10-10 | E-020: setup wizard on a fresh install (schema v10 `setupDone`) | PR #1 |
| 2026-10-10 | v2.0.0 released: PR #1 merged, tag pushed, release workflow green, release notes from CHANGELOG | 674cea3, tag `v2.0.0` |
| 2026-10-10 | Fix: setup wizard scrolls again (`.aurora` overflow beat Tailwind's `overflow-y-auto`; scrolling moved to an inner element) | PR #2 (18e2325) |
| 2026-10-10 | E-021: one starter bullet per work day (schema v11) | PR #3 |
| 2026-10-10 | v2.0.1 released: PR #3 merged, tag pushed, release workflow green, release notes from CHANGELOG | 1c70518, tag `v2.0.1` |
| 2026-10-15 | Code review of the whole project (user request) → phases 7–10 planned | be62952 |
| 2026-10-16 | 7.1: main window locked to the app, IPC sender check, permissions, save shape check (E-022) | 6dfd44e |
| 2026-10-16 | 7.2: save queue + rename retry + flush on close (E-023) | 5f08126 |
| 2026-10-16 | 7.3: snapshots in `sicherungen/` + restore in Settings (E-024) | 5ef3ee4 |
| 2026-10-16 | 7.4: error boundaries + renderer crash dialog | e8b054f |
| 2026-10-16 | 7.5: DST progress, holiday state, scoped undo, toast timers, load errors (tests in Europe/Berlin) | 060447a |
| 2026-10-16 | Phase 7 delivered | PR #5 (merged, 3bdf5a3) |
| 2026-10-17 | 8.1: Electron 43.8.0 + `npm audit fix` (prod audit clean) | cd102cb |
| 2026-10-17 | E-025: long-lived `development` branch, `main` only per release; CI on `development` pushes; old `claude/…` branches merged → to be deleted by the user | 4209df9 |
| 2026-10-17 | 8.2: Node 24 in CI/release, CI builds the renderer (E-026) | 9a8bcad |
| 2026-10-17 | 8.3: Dependabot against `development` | bf13fce |
| 2026-10-17 | 8.4: v2.0.2 bump, release notes from CHANGELOG, dry runs green, PR #6 merged (tag pending) | 885a4ca |
| 2026-10-17 | v2.0.2 released: tag pushed from the local session, release workflow green, `latest.yml` = 2.0.2 | tag `v2.0.2` |
| 2026-10-17 | 8.5: Dependabot majors by hand except Electron (E-027); #7 + #9 merged, #10–#12 closed | 3bc816f, 7630e87 |
| 2026-10-17 | 8.6: Electron 44.7 (#8), checked in Electron + update check against the live release | 707bf41 |
| 2026-10-17 | 10.1 + 10.2: Playwright end-to-end tests (browser, Electron, packaged check), CI job `e2e` (E-031) | 3f8b3f2, bdc4ea7 |
| 2026-10-17 | 9.2: Electron fuses + asar integrity (E-029) | ab5bb91 |
| 2026-10-17 | 9.1: release job is the only writer, actions pinned to SHAs (E-030); dry run green | 4d4e58c, bdc4ea7 |
| 2026-10-17 | 9.3: maintainer checklist for the GitHub settings in CONTRIBUTING (applying it: user) + docs for phases 9–10 | 0c10bb4 |
| 2026-10-19 | 9.3b (repository part): rulesets `Release tags`/`main`/`development`, SHA pinning, release immutability, Dependabot alerts + security updates — set by Claude on the user's request; release dry run green (run 39316661700) | 07b0201 (docs) |
| 2026-10-19 | v2.0.3: bump + CHANGELOG, dry run green (run 39325088802), PR #16 merged, tag pushed, release run green (39325719252, first real `release` job), feed checked | 21d4956, 183a6e1, tag `v2.0.3` |
| 2026-10-20 | `main` and `development` brought level on the user's request (post-release docs + #17, no app code) | PR `development` → `main` |
