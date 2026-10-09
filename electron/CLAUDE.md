# electron/ — Main-Prozess & Preload

Hier liegt alles mit Systemzugriff. Der Renderer ist absichtlich „dumm" und darf nur,
was `preload.js` freigibt.

## Regeln

- **Neuer Kanal = drei Stellen:** `ipcMain.handle('bereich:aktion', …)` in `main.js`,
  eine benannte Funktion in `preload.js`, ein Fallback in `browserApi` in
  `src/store.jsx` (damit `vite dev` im Browser nicht crasht). Danach die Tabelle in
  `docs/ARCHITEKTUR.md` ergänzen.
- Kanalnamen: `bereich:aktion` auf Deutsch (`daten:speichern`, `fenster:schliessen`).
- Handler liefern Objekte `{ ok: true, … }` bzw. `{ ok: false, fehler: '…' }` —
  nicht werfen (Fehler über IPC verlieren ihren Typ).
- **Eingaben aus dem Renderer validieren** (Typ, Länge, erlaubte Werte). Niemals
  Pfade, URLs oder Shell-Befehle ungeprüft aus dem Renderer übernehmen.
- Kein `ipcRenderer` roh exponieren, keine generischen „invoke(kanal)"-Brücken.
- `webPreferences` des Hauptfensters (`contextIsolation`, `nodeIntegration: false`,
  `sandbox`) nicht ändern. Zusätzliche Fenster (z. B. IHK-Portal) bekommen eine
  **eigene Session-Partition** und eine eigene, minimale Preload.
- **Netzwerk:** nur hier, nur zu Hosts aus der Allowlist in `docs/ARCHITEKTUR.md`.
- **Geheimnisse:** nur über `safeStorage.encryptString()` in einer eigenen Datei
  neben `daten.json` (nicht darin). Nie loggen, nie an den Renderer zurückgeben,
  außer der Nutzer will sie ausdrücklich sehen.

## Speicherlogik (nicht aufweichen)

`ermittleDatenVerzeichnis()` (Dev → CWD, portabel → neben Exe falls beschreibbar,
sonst `userData`) und `schreibeDaten()` (tmp + fsync → Backups rotieren → atomares
rename) sind Abnahmekriterien. Änderungen hier nur mit ausdrücklicher Begründung
in `docs/ENTSCHEIDUNGEN.md`.

## Testen

Main-Prozess-Code hat (noch) keine Unit-Tests. Logik, die testbar sein soll
(Parser, Mapper, Validierung), in ein eigenes CommonJS-Modul unter `electron/`
auslagern und mit Vitest testen, statt sie in `main.js` zu vergraben.
