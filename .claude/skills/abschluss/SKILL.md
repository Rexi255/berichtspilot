---
name: abschluss
description: Session sauber abschließen — prüfen, PLAN/CHANGELOG/Doku pflegen, committen, pushen, PR. Verwenden am Ende einer Arbeitseinheit oder wenn der Nutzer "abschließen", "fertig machen" o. ä. sagt.
---

# /abschluss — Übergabe an den nächsten Chat

Ziel: Ein frischer Chat ohne Vorwissen kann allein mit dem Repo nahtlos weitermachen.

1. **Prüfen:** `npm run lint && npm test && npm run build:renderer` — alles grün,
   sonst erst beheben. Eigenen Diff (`git diff`) kritisch lesen: Format-Tests
   unverändert? Keine Geheimnisse/`daten.json` im Diff? Security-Regeln eingehalten?
2. **`docs/PLAN.md`:**
   - erledigte Punkte `[x]`, Zeile im „Erledigt-Log" (Datum, Schritt, PR/Branch)
   - **„Nächster Schritt"** neu schreiben: konkrete Dateien, Akzeptanzkriterien,
     Tests — so präzise wie der aktuelle Eintrag
   - neue Fragen an den Nutzer unter „Offene Fragen", beantwortete entfernen
     (Antwort in `ENTSCHEIDUNGEN.md` oder im Plan festhalten)
3. **`docs/ENTSCHEIDUNGEN.md`:** neue/geänderte Entscheidungen eintragen.
4. **Weitere Doku:** Schema → `DATENMODELL.md`; IPC/Netzwerk → `ARCHITEKTUR.md`;
   neue Befehle/Regeln → `CLAUDE.md`.
5. **`CHANGELOG.md`:** nutzerrelevante Änderungen unter `## [Unreleased]`
   (Hinzugefügt / Geändert / Behoben).
6. **Commit** (Deutsch, Conventional-Commit-Präfix), **push**, und — falls vom
   Nutzer gewünscht/üblich — **PR gegen `main`** nach `.github/pull_request_template.md`.
7. **Kurzbericht an den Nutzer:** was erledigt ist, was als Nächstes kommt, welche
   Fragen offen sind.
