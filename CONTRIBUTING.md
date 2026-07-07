# Beitragen

Danke fürs Interesse! Beiträge sind willkommen — egal ob Bugfix, Idee oder
Verbesserung an der Feiertags-/Formatlogik.

## Setup

Voraussetzung: **Node.js ≥ 20.19**.

```bash
git clone https://github.com/Rexi255/berichtspilot.git
cd berichtspilot
npm install
npm run dev
```

## Codestil

Der Code hält sich bewusst an ein paar einfache Konventionen:

- **2 Leerzeichen** Einrückung, **keine** Semikolons (Standard-JS-Stil).
- **Deutschsprachige** Bezeichner und Kommentare — passend zur Domäne.
- Zentrale Logik (Datum, Feiertage, Ausgabeformat, portabler Basispfad, IPC/preload)
  ist knapp kommentiert; bitte diesen Ton beibehalten.
- Kein neuer Renderer-Zugriff auf Node/`fs`. Datei-I/O läuft **nur** im Main-Prozess
  und wird über die Preload-Bridge (`electron/preload.js`) freigegeben.

## Worauf man achten sollte

- **Ausgabeformat** (`src/lib/format.js`) muss exakt bleiben — inkl. der
  Leerzeilen-Regeln (siehe README). Änderungen hier bitte an Beispielen prüfen.
- **Feiertage** (`src/lib/holidays.js`): Neue/geänderte Feiertage mit dem jeweiligen
  Bundesland belegen. Bewegliche Feiertage leiten sich vom Ostersonntag ab.
- **Datum** (`src/lib/dates.js`): ISO-Strings werden bewusst als *lokale* Daten
  geparst (kein UTC-Versatz). Bitte nicht auf `new Date("YYYY-MM-DD")` umstellen.

## Schneller UI-Check

Es gibt einen eingebauten Screenshot-Helfer, der die App unsichtbar rendert und ein
PNG speichert:

```bash
electron . --screenshot=shot.png [--view=editor|profile|einstellungen]
```

## Pull Requests

- Kleine, fokussierte PRs mit aussagekräftiger Beschreibung.
- Vor dem PR einmal `npm run build:renderer` laufen lassen (baut ohne Fehler durch?).
- Bei UI-Änderungen gern einen Screenshot anhängen.

## Bug melden

Am hilfreichsten sind: Schritte zum Reproduzieren, erwartetes vs. tatsächliches
Verhalten, Betriebssystem und App-Version. Bei Formatfehlern bitte den erzeugten
Text mitschicken.
