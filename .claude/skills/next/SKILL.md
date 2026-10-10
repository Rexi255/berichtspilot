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
3. **Branch:** use the branch the session names; otherwise
   `feat/<short-step-name>` from current `main`.
4. **Plan briefly:** affected files + test strategy in 3–6 points. Split large
   steps and implement only the first part.
5. **Implement:** follow `CLAUDE.md` and the folder `CLAUDE.md` files. Pure logic
   first in `src/lib/` with tests, then IPC/main, then UI. Code and docs in
   English, UI text in German.
6. **Verify:** `npm run lint && npm test && npm run build:renderer`; for UI changes
   also a browser-mode smoke test (vite preview + Playwright) or an Electron
   screenshot.
7. **Finish:** run the `/wrap-up` skill.

Spike steps (research/prototype): record the result in `DECISIONS.md` (options,
measurements, recommendation) and set the entry to "accepted" once the user
agrees. Commit prototype code only if it becomes part of the final solution.
