# Architektur

Stand: v1.2.0. Bei Änderungen an Prozessgrenzen, IPC oder Netzwerk diese Datei
mitpflegen.

## Prozesse

```
┌──────────────────────────── Main-Prozess (Node) ─────────────────────────────┐
│ electron/main.js                                                             │
│  · Fenster (frameless), Kontextmenü + Rechtschreibprüfung (de-DE)            │
│  · Ablageort daten.json ermitteln, atomar speichern, Backups .bak1–3         │
│  · native Dialoge (Export/Import/Frage), Zwischenablage, Dateimanager         │
│  · Single-Instance-Lock                                                      │
└──────────────▲───────────────────────────────────────────────────────────────┘
               │ IPC (ipcMain.handle ↔ ipcRenderer.invoke)
┌──────────────┴──── electron/preload.js (contextBridge) ──────────────────────┐
│  window.api = { datenLaden, datenSpeichern, … }  — einzige Brücke            │
└──────────────▲───────────────────────────────────────────────────────────────┘
               │
┌──────────────┴──── Renderer (Chromium, sandboxed, strikte CSP) ──────────────┐
│ src/main.jsx → App.jsx (Shell: Titlebar, Sidebar, GSAP-Viewwechsel)          │
│ src/store.jsx  StoreProvider: lädt beim Start, hält `daten`, Autosave 400 ms │
│ src/views/*    Uebersicht · WochenEditor · Profile · Einstellungen           │
│ src/lib/*      reine Logik: dates · holidays · format · model               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Datenfluss

1. Start: `store.jsx` → `api.datenLaden()` → Main liest `daten.json` (Fallback: jüngstes
   intaktes `.bakN`) → `migriereDaten()` hebt alte Schemata an → `setDaten`.
   Keine Datei ⇒ `seedDaten()`.
2. Jede Mutation im Store erzeugt ein neues `daten`-Objekt (immutabel).
3. `useEffect` entprellt 400 ms → `api.datenSpeichern(daten)` → Main schreibt
   `daten.json.tmp` + fsync → rotiert Backups → `rename` auf `daten.json`.
4. Ausgabe: `WochenEditor` ruft `formatAlle(woche)` aus `src/lib/format.js` →
   Kopieren über `navigator.clipboard.writeText`.

Im reinen Browser (`vite` ohne Electron) ersetzt `browserApi` in `store.jsx` die
Brücke durch `localStorage`-Stubs.

## IPC-Kanäle

| Kanal | preload-Funktion | Zweck |
|---|---|---|
| `daten:laden` | `datenLaden()` | daten.json (oder Backup) lesen → `{ ok, daten, pfad, ausBackup }` |
| `daten:speichern` | `datenSpeichern(d)` | atomar schreiben → `{ ok }` |
| `daten:exportieren` | `datenExportieren(d)` | Speichern-Dialog, JSON schreiben |
| `daten:importieren` | `datenImportieren()` | Öffnen-Dialog, JSON lesen (Validierung im Renderer) |
| `text:exportieren` | `textExportieren(name, inhalt)` | einen Ausgabeblock als .txt speichern |
| `zwischenablage:lesen` | `zwischenablageLesen()` | Text aus Zwischenablage |
| `pfad:oeffnen` | `pfadOeffnen()` | Ordner der daten.json im Dateimanager |
| `dialog:frage` | `frageDialog(opts)` | nativer Frage-Dialog → Button-Index |
| `fenster:minimieren` / `maximieren` / `schliessen` | gleichnamig | eigene Titlebar |
| `fenster:maximiert` (Event Main→Renderer) | `onMaximiert(cb)` | Maximiert-Status |

## Netzwerk

**Aktuell: keinerlei Netzwerkzugriff** (CSP `connect-src` nur localhost für Vite-HMR).

Mit dem Umbau (siehe `PLAN.md`) kommen Netzwerkziele hinzu. Regel: Zugriffe nur aus
dem Main-Prozess, nur zu Hosts dieser Allowlist, jeder Eintrag mit Begründung.

| Host | Zweck | seit |
|---|---|---|
| — | — | — |

## Sicherheitsmodell

- Hauptfenster: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- CSP in `index.html`: `default-src 'self'`, keine externen Skripte/Hosts.
- Geplant für den Umbau: Geheimnisse via `safeStorage` in eigener Datei
  (`geheimnisse.bin`, nicht in daten.json); Fremdseiten (IHK-Portal) nur in eigenem
  `BrowserWindow` mit separater Session-Partition und minimaler Preload.
