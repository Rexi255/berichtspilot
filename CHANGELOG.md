# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung an [Semantic Versioning](https://semver.org/lang/de/).

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
