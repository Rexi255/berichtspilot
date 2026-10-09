# Berichtspilot — Arbeitshandbuch für die KI

Electron-Desktop-App, die das wöchentliche IHK-Berichtsheft eines Azubis
(Fachinformatiker Systemintegration, Schleswig-Holstein) erzeugt. Aktueller Stand:
v1.2.0 (manuelle Eingabe → drei exakt formatierte Textblöcke zum Kopieren).
**Ziel des laufenden Umbaus:** den Weg dorthin weitgehend automatisieren
(Spracheingabe, WebUntis, KI-Formulierung, IHK-Portal) — siehe `docs/PLAN.md`.

## Zu Beginn JEDER Session

1. `docs/PLAN.md` lesen → Abschnitt **„Nächster Schritt"** und **„Offene Fragen"**.
2. Nur die Doku lesen, die für die Aufgabe nötig ist (Tabelle unten).
3. Ist der nächste Schritt unklar oder eine offene Frage blockiert → den Nutzer
   fragen, nicht raten.

## Am Ende JEDER Session (vor dem Commit)

1. `npm run lint && npm test` müssen grün sein.
2. `docs/PLAN.md` aktualisieren: Erledigtes abhaken, **„Nächster Schritt"** so
   konkret neu schreiben, dass ein frischer Chat ohne Vorwissen weitermachen kann.
3. Neue Architektur-/Technikentscheidung → Eintrag in `docs/ENTSCHEIDUNGEN.md`.
4. Nutzerrelevante Änderung → `CHANGELOG.md` unter `## [Unreleased]`.
5. Schema geändert → `docs/DATENMODELL.md` mitpflegen.

Die Skills `/weiter` (nächsten Plan-Schritt umsetzen) und `/abschluss`
(obige Checkliste + Commit/PR) bilden genau diesen Ablauf ab.

## Wissensbasis

| Datei | Wann lesen |
|---|---|
| `docs/PLAN.md` | **immer** — Roadmap, nächster Schritt, offene Fragen |
| `docs/ARCHITEKTUR.md` | Arbeit über Prozessgrenzen (Main ↔ Preload ↔ Renderer), neue IPC-Kanäle, Netzwerk |
| `docs/DATENMODELL.md` | Änderungen an `daten.json`, Profilen, Wochen, Migration |
| `docs/AUSGABEFORMAT.md` | alles, was die drei Ausgabeblöcke berührt |
| `docs/ENTSCHEIDUNGEN.md` | bevor eine grundlegende Entscheidung (neu) getroffen wird |
| `docs/archiv/ursprungsauftrag.md` | nur historisch — der ursprüngliche Bauauftrag (v1.0) |

Ordnerspezifische Regeln stehen in `electron/CLAUDE.md` und `src/lib/CLAUDE.md`.

## Befehle

```bash
npm ci                 # Abhängigkeiten (Cloud: ELECTRON_SKIP_BINARY_DOWNLOAD=1 davor)
npm test               # Vitest — reine Logik in src/lib (schnell, <1 s)
npm run lint           # ESLint (CI-Pflicht)
npm run build:renderer # Vite-Build — prüft, dass der Renderer kompiliert
npm run dev            # Vite + Electron mit Hot-Reload (braucht Display)
electron . --screenshot=shot.png [--view=editor|profile|einstellungen]  # UI-Check headless
```

CI (`.github/workflows/ci.yml`) führt Lint + Tests bei jedem PR aus.
Release: Tag `vX.Y.Z` pushen → `.github/workflows/release.yml` baut NSIS + portable
.exe + AppImage.

## Projektkarte

```
electron/main.js     Fenster, Ablageort daten.json, atomares Speichern + Backups, alle IPC-Handler
electron/preload.js  contextBridge → window.api (einzige Brücke zum Renderer)
src/store.jsx        zentraler Zustand (React Context), Autosave 400 ms, alle Mutationen
src/lib/             REINE Logik, voll getestet: dates · holidays · format · model
src/views/           Uebersicht · WochenEditor · Profile · Einstellungen
src/ui/              Design-System: Titlebar, Sidebar, basics, toast, Logo
src/index.css        Tailwind v4 + Design-Tokens/Themes (data-theme am <html>)
docs/                Wissensbasis (s. o.)
```

## Harte Regeln (nie brechen)

1. **Ausgabeformat ist heilig.** `src/lib/format.js` muss exakt `docs/AUSGABEFORMAT.md`
   entsprechen (Leerzeilen-Regeln!). `src/lib/format.test.js` enthält echte IHK-Beispiele
   — diese Tests nie anpassen, damit sie grün werden.
2. **Keine Datenverluste.** `daten.json` enthält das komplette Berichtsheft des
   Nutzers. Schemaänderung ⇒ `DATEN_VERSION` erhöhen + Migration in `migriereDaten()`
   + Test. Atomares Schreiben/Backups in `electron/main.js` nicht aufweichen.
3. **Electron-Security.** `contextIsolation: true`, `nodeIntegration: false`,
   `sandbox: true`, strikte CSP. Renderer bekommt nie Node/`fs`/Netzwerk direkt —
   alles über einen benannten IPC-Kanal in `preload.js`.
4. **Netzwerk nur im Main-Prozess**, nur zu ausdrücklich erlaubten Zielen
   (s. `docs/ARCHITEKTUR.md`). Die CSP des Renderers bleibt ohne externe Hosts.
5. **Geheimnisse** (API-Keys, Passwörter, Tokens) **nie in `daten.json`** und nie im
   Repo — nur verschlüsselt über Electron `safeStorage` in einer separaten Datei.
   Grund: `daten.json` wird exportiert/geteilt.
6. **Kundendaten-Schutz.** Texte, die die App verlassen (z. B. an eine KI-API),
   vorher vom Nutzer sichtbar prüfen lassen; keine stillen Uploads.
7. **Datum:** ISO-Strings `YYYY-MM-DD`, immer lokal parsen über `parseISO()` —
   nie `new Date('YYYY-MM-DD')` (UTC-Versatz).
8. **„Easy to use" bleibt Produktprinzip:** herunterladen → installieren → läuft.
   Keine Pflicht-Zusatzinstallationen (Python, Docker, Ollama …) für Kernfunktionen.

## Code-Konventionen

- 2 Leerzeichen, **keine Semikolons**, einfache Anführungszeichen.
- **Deutsche Bezeichner, Kommentare und UI-Texte** (`wocheAnlegen`, `feiertagAm`).
  Umlaute in Bezeichnern ausschreiben (`ae`, `oe`, `ue`, `ss`).
- Zentrale Logik knapp kommentieren (warum, nicht was) — Ton der bestehenden Dateien.
- Neue Fachlogik als reine Funktion in `src/lib/` + Vitest-Test daneben (`*.test.js`).
- State-Änderungen immer immutabel über Mutationen in `src/store.jsx`.
- Design: bestehende Komponenten aus `src/ui/basics.jsx` und Tokens aus
  `src/index.css` nutzen; keine neuen UI-Frameworks.

## Git-Workflow

- Arbeit auf Feature-Branch, Abgabe als **Pull Request** gegen `main`; CI muss grün sein.
- Commit-Messages auf Deutsch, Präfix nach Conventional Commits
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Kleine, in sich fertige Schritte — lieber ein PR pro Plan-Schritt.

## Nutzer

Azubi FISI (seit 2025), arbeitet unter Arch Linux und Windows. Kommunikation auf
Deutsch. Technisches Vorwissen vorhanden — Erklärungen dürfen fachlich sein.
