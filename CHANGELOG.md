# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung an [Semantic Versioning](https://semver.org/lang/de/).

## [1.2.0] - 2026-07-09

### Hinzugefügt

- **Autocomplete im Editor:** beim Tippen werden passende Stichpunkte aus allen
  bisherigen Wochen (Betrieb bzw. je Fach) vorgeschlagen — plus frei pflegbare
  **Textbausteine** in den Einstellungen.
- **Lücken-Erkennung:** die Übersicht zeigt fehlende Wochen zwischen
  Ausbildungsbeginn und der Vorwoche (einzeln oder als aufklappbarer Block) mit
  Ein-Klick-Anlegen, dazu die Stat-Kacheln „Wochen fehlen" und „Wochen in Serie".
  Die laufende Woche und Wochen nach dem Ausbildungsende zählen nicht als fehlend.
- **Jahres-Heatmap** in der Übersicht: eine Zelle pro Kalenderwoche
  (Fertig/Entwurf/Fehlt), Klick öffnet die Woche.
- **Suche & Filter:** Volltextsuche über Stichpunkte, Fächer, Unterweisungen und
  Feiertage; Statusfilter (Alle/Entwürfe/Fertig); Jahres-Zwischenüberschriften.
- **Zeiträume (Urlaub/Schulferien):** einmal eintragen — Urlaub markiert leere
  Tage automatisch (auch rückwirkend), Schulferien machen Schultage beim Anlegen
  neuer Wochen zu Betriebstagen.
- **Profil duplizieren** für den Halbjahreswechsel + **Gültigkeits-Prüfung**
  (Warnungen bei Überlappungen, Lücken und fehlenden Zeiträumen) +
  **„Fächer übernehmen von …"** zwischen Schultagen/Profilen.
- **Import mit Zusammenführen:** beim Import wählbar, ob nur fehlende
  Wochen/Profile ergänzt oder alles ersetzt wird; importierte Dateien werden
  vorab strukturell validiert.
- **„Aus Zwischenablage einfügen":** Zeilen aus Zeiterfassung/WebUntis werden als
  Stichpunkte übernommen (Aufzählungszeichen werden entfernt).
- **Tastaturkürzel:** Strg+1–4 (Ansichten), Alt+←/→ (Woche), Strg+Shift+1/2/3
  (Block kopieren), Strg+N (Woche anlegen) — Referenz in den Einstellungen.
- **Undo beim Löschen:** gelöschte Wochen/Profile lassen sich 6 Sekunden lang
  per Toast wiederherstellen.
- **Deutsche Rechtschreibprüfung** in allen Eingabefeldern inkl.
  Korrektur-Kontextmenü und „Zum Wörterbuch hinzufügen".
- **Einstellungen ausgebaut:** Start-Ansicht wählbar, Speicherort mit
  „Ordner öffnen", Textbausteine, Kürzel-Übersicht.
- **Tests + CI:** Vitest-Suite für Format- (exakte IHK-Beispiele), Feiertags-,
  Datums- und Modelllogik; ESLint; CI-Workflow prüft Lint + Tests bei jedem Push,
  der Release-Workflow vor jedem Build.

### Geändert

- **Schema-Migration:** `daten.json` trägt jetzt Version 2 (neu: Zeiträume,
  Start-Ansicht, Textbausteine). Alte Dateien werden beim Laden/Import
  automatisch migriert; Dateien aus neueren App-Versionen werden zum Schutz vor
  Datenverlust nicht geladen.

### Behoben

- **Single-Instance-Lock:** eine zweite App-Instanz konnte die `daten.json`
  der ersten überschreiben. Jetzt fokussiert ein zweiter Start nur noch das
  bestehende Fenster.

## [1.1.1] - 2026-07-08

### Behoben

- **Release-Workflow** lief nie grün durch: electron-builder löste bei einem
  Git-Tag ein implizites GitHub-Publishing aus und brach ohne `GH_TOKEN` ab —
  obwohl Installer, portable `.exe` und AppImage erfolgreich gebaut wurden. Die
  Build-Scripts rufen electron-builder jetzt mit `--publish never` auf; das
  Hochladen ans Release übernimmt allein der `action-gh-release`-Step. App
  ansonsten unverändert gegenüber 1.1.0.

## [1.1.0] - 2026-07-08

### Hinzugefügt

- **Windows-Installer** (NSIS) als neues Haupt-Target: frei wählbarer
  Installationsordner, Startmenü-/Desktop-Verknüpfung, standardmäßig ohne
  Adminrechte (Installation pro Benutzer). Die portable `.exe` bleibt zusätzlich
  erhalten.
- **Rollierende Backups**: vor jedem Speichern wird der vorherige Stand als
  `daten.json.bak1`–`.bak3` gesichert. Ist die Hauptdatei beschädigt, stellt die App
  beim Start automatisch den jüngsten intakten Stand wieder her (mit Hinweis).

### Geändert

- **Datenablage installierter Builds** liegt jetzt im nutzereigenen Datenordner
  (`%APPDATA%\Berichtspilot` / `~/.config/Berichtspilot`) statt neben der Executable.
  Das behebt fehlschlagendes Speichern, wenn die App unter `C:\Program Files` bzw.
  `/usr/bin` installiert ist (dort blockiert das OS Schreiben ohne Adminrechte).
  Die portable Version speichert weiter neben der App und weicht bei
  schreibgeschütztem Ort automatisch auf den nutzereigenen Datenordner aus.
- **Atomares Speichern** zusätzlich per `fsync` abgesichert (Temp-Datei vollständig
  auf die Platte zwingen, dann atomar umbenennen) — kein Datenverlust bei
  Absturz/Stromausfall mitten im Schreibvorgang.

### Behoben

- Vorschau der **Nordlicht**-Themekarte in den Einstellungen färbte sich in die
  Farbe des gerade aktiven Themes; sie zeigt jetzt immer die Nordlicht-Farben.

## [1.0.0] - 2026-07-08

### Hinzugefügt

- Übersicht aller Berichtswochen mit Kalenderwoche, Zeitraum, Status und
  Fortschrittsanzeige.
- Wochen-Editor mit Live-Vorschau der drei Ausgabeblöcke und Kopier-Buttons.
- Profile pro Halbjahr mit automatischer Auswahl anhand des Wochendatums.
- Offline-Feiertagsberechnung für alle 16 Bundesländer (Gaußsche Osterformel).
- Tagesstatus Normal / Feiertag (auto) / Krank / Urlaub.
- Portable Persistenz in `daten.json` neben der Executable, plus Export/Import.
- Rahmenloses Fenster mit eigener Titlebar, Dark Mode, GSAP-Übergänge.
- Builds für Windows (portable `.exe`) und Linux (AppImage).
