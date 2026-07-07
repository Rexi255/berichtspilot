# Prompt: Ausbildungsnachweis-Generator (IHK-Berichtsheft-Helfer)

Bau mir eine **portable Electron-Desktop-App**, die das wöchentliche Ausfüllen des
digitalen IHK-Berichtshefts vereinfacht. Sie soll **modern und hochwertig** aussehen,
wie eine echte native App — nicht wie ein 08/15-Web-Formular. Ich bin Azubi
Fachinformatiker Systemintegration in Schleswig-Holstein.

## Ziel

Die App erzeugt pro Berichtswoche drei fertig formatierte Textblöcke, die ich 1:1 in
die drei Eingabefelder des IHK-Berichtshefts kopiere:

1. **Betriebliche Tätigkeiten**
2. **Unterweisungen, betrieblicher Unterricht, sonstige Schulungen**
3. **Berufsschule (Unterrichtsthemen)**

Ich will nur noch die eigentlichen Tätigkeiten/Stichpunkte eintippen.
Wochentag, Datum und Überschriften (z. B. „Mittwoch, den 21.05.2026:", „LF03:")
werden automatisch bzw. aus einer konfigurierbaren Vorlage erzeugt.

Aktueller Ist-Zustand (den die App ersetzt): Ich tippe die Tätigkeiten manuell aus
der Zeiterfassung und aus WebUntis in .txt-Dateien und kopiere den Inhalt dann ins
IHK-Heft.

## Tech-Stack

- **Electron** als Shell. Frontend: **Vite + React + Tailwind CSS**, Animationen mit
  **GSAP** (View-Transitions, Micro-Interactions) und **Lenis** (smooth scroll in
  der Übersicht). Die komplette Fachlogik (Datum, Feiertage, Ausgabeformat) läuft im
  Renderer/JS.
- **Electron-Security korrekt aufsetzen:** `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`, ein **preload.js** mit
  `contextBridge.exposeInMainWorld` als schmale API. Datei-I/O passiert **nur im
  Main-Prozess** und wird über IPC (`ipcMain.handle` / `ipcRenderer.invoke`)
  angeboten. Strikte CSP im Renderer.
- **Portable Persistenz:** alle Daten (Konfiguration + sämtliche geschriebenen
  Ausbildungsnachweise) in **einer `daten.json` neben der Executable**, nicht in
  System-/AppData-Verzeichnissen. Basispfad im Main-Prozess ermitteln:
  1. `process.env.PORTABLE_EXECUTABLE_DIR` (Windows electron-builder portable), sonst
  2. `path.dirname(process.env.APPIMAGE)` (Linux AppImage), sonst
  3. Projekt-/CWD-Fallback im Dev-Modus.
  Ordner bzw. Datei kopieren = alle Daten wandern mit.
- Zusätzlich Export/Import der `daten.json` über einen nativen Dateidialog
  (`dialog.showSaveDialog` / `showOpenDialog`) als Extra-Backup.
- **Build mit electron-builder**, Targets: **Windows portable .exe** und
  **Linux AppImage**. Läuft auf Arch Linux und einem Windows-Notebook.
- **Feiertage komplett offline in JS berechnen** (keine API): feste Feiertage +
  bewegliche über die Osterformel (Gauß), inkl. landesspezifischer Feiertage je
  Bundesland. Default Schleswig-Holstein.
- **Kopieren-Buttons** legen den jeweiligen Block über `navigator.clipboard.writeText`
  in die Zwischenablage.
- Oberfläche auf **Deutsch**.

### Projektstruktur (Vorschlag)

```
package.json            (scripts: dev, build; electron-builder config)
electron/
  main.js               (Fenster, IPC, Datei-I/O, portabler Basispfad)
  preload.js            (contextBridge-API: load/save/exportData/importData)
src/
  App.jsx
  views/                (Uebersicht, WochenEditor, Profile)
  lib/dates.js          (Wochentag/Datum, Kalenderwoche)
  lib/holidays.js       (Feiertage je Bundesland, Osterformel)
  lib/format.js         (Erzeugung der 3 Ausgabeblöcke)
  ui/                   (Titlebar, Sidebar, Komponenten)
```

## Look & Feel (wichtig)

- **Rahmenloses Fenster** (`frame: false`) mit **eigener Titlebar** inkl.
  Fenstersteuerung (Minimieren/Maximieren/Schließen) — echter App-Charakter.
- **Dark Mode** als Default, moderne Typografie (z. B. Inter), klare Akzentfarbe,
  dezente Glass-/Blur-Effekte, weiche Schatten, abgerundete Ecken.
- **Sidebar-Navigation:** Übersicht · Woche bearbeiten · Profile.
- Flüssige Übergänge zwischen Views (GSAP), spürbare aber dezente Micro-Interactions
  (Buttons, Statuswechsel, Stichpunkt hinzufügen/löschen).
- Eigenständiges, konsistentes Design-System — bewusst gestaltet, keine Default-
  Bootstrap-/Framework-Optik.

## Konfiguration (pro Halbjahr anpassbar)

Meine Berufsschul- und Betriebstage ändern sich mit jedem Halbjahr. Es muss also
mehrere „Profile" geben, und die App zieht anhand des Wochendatums automatisch das
passende Profil. Ein Profil enthält:

- `bundesland` (Default: Schleswig-Holstein) — steuert die Feiertagsberechnung
- `gueltigVon` / `gueltigBis` (Datumsbereich des Halbjahrs)
- `wochentage`: für jeden Wochentag (Mo–Fr, optional Sa) ein Typ:
  - `betrieb` → landet im Block **Betriebliche Tätigkeiten**
  - `schule`  → landet im Block **Berufsschule**
  - `frei`    → wird ignoriert
- Für **Schultage**: pro Wochentag eine geordnete, frei editierbare Liste von
  Fächern/Lernfeldern (z. B. Mo: LF02, LF03, Englisch, WiPo — Di: LF04, LF05).
  Labels frei benennbar (LF-Nummern wechseln je Halbjahr).
- Für **Betriebstage**: Standard-Anzahl leerer Stichpunkte als Startvorlage (z. B. 2).
- Optional `ausbildungVon` / `ausbildungBis` (für die Fortschrittsanzeige).

Beispiel für den Halbjahreswechsel aus meinen echten Daten:
- Halbjahr A: Mo = Schule, Di–Fr = Betrieb
- Halbjahr B: Mo + Di = Schule, Mi–Fr = Betrieb

## Übersicht / Fortschritt (Startbildschirm)

- Liste **aller** bisher geschriebenen Berichtswochen, chronologisch, mit
  Kalenderwoche + Datumsbereich und Status (**Entwurf** / **Fertig**).
- Aktuelle Woche hervorgehoben; Klick öffnet sie im Editor (ansehen + bearbeiten).
- Kurze Fortschrittszeile, z. B. „14 Wochen dokumentiert · 2 Entwürfe offen".
  Falls `ausbildungVon`/`ausbildungBis` gesetzt: zusätzlich „Woche X von ca. Y".
- Buttons „Neue Woche anlegen" und „Struktur der Vorwoche übernehmen"
  (leere Kopie der letzten Wochenstruktur).

## Wochen-Editor (Hauptworkflow)

1. Berichtswoche über Kalenderwoche oder Montags-Startdatum wählen/anlegen. App wählt
   automatisch das passende Profil anhand des Datums.
2. Für jeden konfigurierten Wochentag werden konkretes Datum und deutscher
   Wochentagsname berechnet.
3. Feiertage im gewählten Bundesland werden automatisch erkannt, der Tag als
   „Feiertag: <Name>" markiert (keine Stichpunkte nötig).
4. Pro Tag ein Status: **Normal / Feiertag (auto) / Krank / Urlaub**.
   - Krank → Ausgabe „Krankheitstag"
   - Feiertag → „Feiertag: <Name>"
5. Eingabe:
   - Betriebstage: unter der Auto-Überschrift beliebig viele Stichpunkte
     (hinzufügen / löschen / verschieben).
   - Schultage: pro Fach/LF eigene Stichpunkte.
   - Unterweisungen: ein freies Textfeld (meist leer).
6. **Bearbeiten:** jede gespeicherte Woche (auch alte) jederzeit wieder öffnen,
   ändern, neu speichern und neu kopieren. Status Entwurf ↔ Fertig umschaltbar.
   Speichern schreibt sofort in `daten.json`.

## Ausgabe — EXAKTES Format ist Pflicht

Drei Textbereiche mit je einem „Kopieren"-Button. Das Format muss exakt den
folgenden Beispielen (aus echten Berichten) entsprechen.

### Block 1 — Betriebliche Tätigkeiten

Header `<Wochentag>, den TT.MM.JJJJ:`, darunter Bullets `- …`, eine Leerzeile
zwischen den Tagen:

```
Dienstag, den 20.01.2026:
- Fehlerdiagnose bei DHCP-Zuweisungsproblemen und Behebung von lokalen Netzwerkstörungen an mobilen Endgeräten.
- Verwaltung von WLAN-Zugangsdaten für Gäste sowie Bearbeitung von Support-Tickets im Bereich Telefonie

Mittwoch, den 21.01.2026:
- Aufbau und Inbetriebnahme eines neuen Mitarbeiter-Arbeitsplatzes inklusive Monitor-Setup und abschließendem Funktionstest der gesamten Peripherie
- Durchführung von Patch-Arbeiten an der Netzwerkdose sowie Konfiguration der zugehörigen Switch-Ports
```

Feiertag/Krank statt Bullets — nur die Statuszeile:

```
Freitag, den 01.05.2026:
- Feiertag: Tag der Arbeit
```

### Block 2 — Unterweisungen, betrieblicher Unterricht

Freier Text, meist leer.

### Block 3 — Berufsschule (Unterrichtsthemen)

Header, Leerzeile, dann je Fach `<Label>:` mit Bullets, eine Leerzeile zwischen
Fächern, **zwei** Leerzeilen zwischen den Tagen:

```
Montag, den 20.04.2026:

LF02:
- Wirtschaftssektoren
- Tarifverträge
- Betriebsrat

LF03:
- Server und Clients: Arbeiten mit Cisco PacketTracer

Englisch:
- Installing GUI components, explaining smartphone functions

WiPo:
- Nutzwertanalyse
- Übungsaufgabe


Dienstag, den 21.04.2026:

LF04:
- Klassenarbeit LF4

LF05:
- Weiterarbeit an Projekt (automatisierte Datenextraktion)
```

## Zusätzlich

- Export der drei Blöcke optional auch als einzelne .txt-Dateien.
- Kompakte, aufgeräumte UI. Klare Trennung: Übersicht/Fortschritt ·
  Woche bearbeiten · Profile/Halbjahre verwalten.

## Abnahmekriterien

- Datumsberechnung korrekt (Wochentag ↔ Datum), Feiertage für Schleswig-Holstein
  inkl. beweglicher (Karfreitag, Ostermontag, Christi Himmelfahrt, Pfingstmontag)
  stimmen.
- Kopieren-Buttons liefern **exakt** das gezeigte Zielformat (inkl. Leerzeilen-
  Regeln).
- Konfiguration pro Halbjahr getrennt speicherbar; je nach Wochendatum wird das
  richtige Profil gezogen.
- Alle geschriebenen Nachweise bleiben in `daten.json` erhalten, sind in der
  Übersicht gelistet und jederzeit editierbar.
- `daten.json` liegt neben der Executable; Kopieren auf anderen Rechner → Daten da.
- Baut per electron-builder zu Windows portable .exe und Linux AppImage.
- Electron-Security-Vorgaben eingehalten (contextIsolation, kein nodeIntegration im
  Renderer, preload-Bridge, IPC-basiertes Datei-I/O, CSP).

## Vorgehen

Frag nur nach, wenn wirklich etwas unklar ist. Bau in kleinen Schritten: erst
Grundgerüst (Fenster, Titlebar, Navigation, Persistenz), dann Profile, dann
Wochen-Editor, dann Ausgabe/Format, zuletzt der Feinschliff bei Look & Animationen.
Kommentiere zentrale Logik (Datum, Feiertage, Ausgabeformat, portabler Basispfad,
IPC/preload) knapp, damit ich es nachvollziehen kann.
