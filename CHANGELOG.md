# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung an [Semantic Versioning](https://semver.org/lang/de/).

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
