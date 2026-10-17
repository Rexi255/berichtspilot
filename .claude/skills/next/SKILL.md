---
name: next
description: Implement the next step from docs/PLAN.md (Berichtspilot overhaul). Use when the user says "weiter", "next", "nächster Schritt", "continue with the plan" or similar.
---

# /next — implement the next plan step

1. **Load context:** read `docs/PLAN.md` (Next step, Open questions, Guardrails).
   Then only the docs the step needs (`ARCHITECTURE.md`, `DATA_MODEL.md`,
   `OUTPUT_FORMAT.md`, `DECISIONS.md`, `GLOSSARY.md`).
2. **Check blockers:** does the step depend on an open question or a decision
   with status "proposed"? → ask the user precisely (concrete options +
   recommendation, in German), don't guess. If blocked, propose the next unblocked
   roadmap step.
3. **Branch:** always `development` (E-025) — `git fetch origin development &&
   git checkout development`, even if the session names a `claude/…` branch.
   Never start a new branch.
4. **Plan briefly:** affected files + test strategy in 3–6 points. Split large
   steps and implement only the first part.
5. **Implement:** follow `CLAUDE.md` and the folder `CLAUDE.md` files. Pure logic
   first in `src/lib/` with tests, then IPC/main, then UI. Code and docs in
   English, UI text in German.
6. **Verify:** `npm run lint && npm test && npm run build:renderer`; for changes
   to the renderer flow, `electron/` or the build also `npm run test:e2e`
   (Playwright, E-031 — CI runs it on every push anyway); for UI changes a look
   at the result (browser mode or an Electron screenshot).
7. **Finish:** run the `/wrap-up` skill.

Spike steps (research/prototype): record the result in `DECISIONS.md` (options,
measurements, recommendation) and set the entry to "accepted" once the user
agrees. Commit prototype code only if it becomes part of the final solution.
