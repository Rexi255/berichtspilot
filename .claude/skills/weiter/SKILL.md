---
name: weiter
description: Nächsten Schritt aus docs/PLAN.md umsetzen (Berichtspilot-Umbau). Verwenden, wenn der Nutzer "weiter", "nächster Schritt", "mach weiter mit dem Plan" o. ä. sagt.
---

# /weiter — nächsten Plan-Schritt umsetzen

1. **Kontext laden:** `docs/PLAN.md` lesen (Nächster Schritt, Offene Fragen,
   Leitplanken). Danach nur die Doku, die der Schritt braucht
   (`ARCHITEKTUR.md`, `DATENMODELL.md`, `AUSGABEFORMAT.md`, `ENTSCHEIDUNGEN.md`).
2. **Blocker prüfen:** Hängt der Schritt an einer offenen Frage oder an einer
   Entscheidung mit Status „vorgeschlagen"? → Nutzer gezielt fragen (konkrete
   Optionen + Empfehlung), nicht raten. Ist er blockiert, den nächsten
   unblockierten Schritt der Roadmap vorschlagen.
3. **Branch:** auf einem Feature-Branch arbeiten (vorgegebenen Branch nutzen, falls
   die Session einen nennt; sonst `feat/<schritt-kurzname>` von aktuellem `main`).
4. **Kurz planen:** betroffene Dateien + Teststrategie in 3–6 Punkten nennen.
   Bei großen Schritten in Teilschritte zerlegen und nur den ersten umsetzen.
5. **Umsetzen:** Regeln aus `CLAUDE.md` und den Ordner-`CLAUDE.md`s befolgen.
   Reine Logik zuerst in `src/lib/` mit Tests, dann IPC/Main, dann UI.
6. **Prüfen:** `npm run lint && npm test && npm run build:renderer`.
7. **Abschließen:** Skill `/abschluss` ausführen.

Spike-Schritte (Recherche/Prototyp): Ergebnis als Abschnitt in `ENTSCHEIDUNGEN.md`
festhalten (Optionen, Messwerte, Empfehlung) und den Eintrag auf „angenommen"
setzen, sobald der Nutzer zugestimmt hat. Prototyp-Code nur committen, wenn er
Teil der finalen Lösung wird.
