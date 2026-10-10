---
name: wrap-up
description: Finish a work session cleanly — verify, update PLAN/CHANGELOG/docs, commit, push, PR. Use at the end of a unit of work or when the user says "abschließen", "wrap up", "fertig machen" or similar.
---

# /wrap-up — hand over to the next chat

Goal: a fresh chat with zero context can continue seamlessly using only the repo.

1. **Verify:** `npm run lint && npm test && npm run build:renderer` — all green,
   otherwise fix first. Read your own diff (`git diff`) critically: format tests
   untouched? No secrets / `daten.json` in the diff? Security rules respected?
   Code/docs English, UI German?
2. **`docs/PLAN.md`:**
   - tick off finished items `[x]`, add a row to the "Done log" (date, step, commit/PR)
   - rewrite **"Next step"**: concrete files, acceptance criteria, tests — as
     precise as the current entry
   - add new questions for the user under "Open questions", remove answered ones
     (record the answer in `DECISIONS.md` or in the plan)
3. **`docs/DECISIONS.md`:** add new/changed decisions.
4. **Other docs:** schema → `DATA_MODEL.md` (+ `GLOSSARY.md` for new terms);
   IPC/network → `ARCHITECTURE.md`; new commands/rules → `CLAUDE.md`.
5. **`CHANGELOG.md`:** user-facing changes under `## [Unreleased]`
   (Added / Changed / Fixed).
6. **Commit** (English, Conventional Commits), **push**, and — if the user wants
   it — open a **PR against `main`** following `.github/pull_request_template.md`.
7. **Short report to the user (German):** what's done, what comes next, which
   questions are open.
