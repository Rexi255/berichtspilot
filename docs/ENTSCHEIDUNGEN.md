# Entscheidungen (ADR-Log)

Kurzprotokoll grundlegender Entscheidungen, damit sie nicht in jedem Chat neu
diskutiert werden. Neue Einträge unten anhängen, nie löschen — überholte auf
„ersetzt durch E-xxx" setzen.

Status: **angenommen** · **vorgeschlagen** (wartet auf Spike/Nutzer) · **ersetzt**

---

### E-001 · Electron + Vite + React + Tailwind · angenommen (v1.0)
Native Desktop-App für Windows + Arch Linux, ein Codebase. GSAP/Lenis für Animationen.

### E-002 · Eine `daten.json` als Datenbank · angenommen (v1.0, bestätigt 2026-10)
Konfiguration + alle Wochen in einer JSON-Datei. Gründe: trivialer Export/Import,
menschenlesbar, portabel. Kein SQLite — die Datenmenge (≈150 Wochen) ist klein.
Nutzer bestätigt beim Umbau: „Einfacher Export der Datenbank" bleibt Pflicht.

### E-003 · Sicheres Speichern · angenommen (v1.1)
tmp-Datei + fsync → rollierende Backups `.bak1–3` → atomares `rename`; beim Laden
automatischer Fallback auf jüngstes intaktes Backup.

### E-004 · Ablageort · angenommen (v1.1)
Dev → CWD; portabel → neben der Exe, falls beschreibbar; sonst `userData`.

### E-005 · Feiertage offline · angenommen (v1.0)
Gaußsche Osterformel + Tabellen je Bundesland, keine API.

---

## Umbau „Automatisierung" (ab 2026-10)

### E-006 · Electron bleibt · angenommen
Nutzer: Stack darf nur wechseln, wenn die App trotzdem „easy to use" bleibt
(herunterladen, installieren, läuft). Electron erfüllt das, bestehende Daten, Tests
und UI bleiben nutzbar. Kein Neuaufbau.

### E-007 · Lokal zuerst, Netzwerk nur wo unvermeidbar · angenommen
Netzwerk nur für: WebUntis, KI-Formulierung (falls Cloud), IHK-Portal. Zugriffe
ausschließlich im Main-Prozess, Host-Allowlist in `ARCHITEKTUR.md`. Renderer-CSP
bleibt ohne externe Hosts. Jede Netzwerkfunktion ist abschaltbar; die App
funktioniert ohne Netz weiter wie v1.2.

### E-008 · Geheimnisse via `safeStorage` · angenommen
API-Keys/Passwörter verschlüsselt (OS-Keychain/DPAPI/libsecret) in eigener Datei
neben `daten.json`, nie in `daten.json` (wird exportiert). Linux ohne Keyring:
Funktion mit Hinweis deaktivieren statt Klartext speichern.

### E-009 · Zeiterfassung per Spracheingabe statt Copy & Paste · angenommen
Nutzer: Direktes Einfügen aus der Zeiterfassung ist wegen Kundendaten umständlich.
Stattdessen diktiert der Nutzer pro Tag, was er gemacht hat → Rohnotiz → (optional)
KI formuliert Stichpunkte. Ein Datei-Import der Zeiterfassung bleibt als spätere
Option (abhängig vom System, siehe PLAN „Offene Fragen").

### E-010 · Spracherkennung lokal · vorgeschlagen
Audio verlässt den Rechner nicht (Kundendaten!). Kandidat: Whisper lokal
(z. B. whisper.cpp-Binary oder ONNX/transformers.js im Worker/Utility-Process).
Zu klären im Spike: Modellgröße vs. Qualität Deutsch, Auslieferung (Download beim
ersten Start vs. im Installer), CSP-Verträglichkeit (WASM), Performance auf dem
Windows-Notebook.

### E-011 · KI-Formulierung mit Anonymisierung + Vorschau · vorgeschlagen
Provider-Abstraktion; Standard voraussichtlich Claude-API mit eigenem Key des
Nutzers. Vor jedem Senden: lokaler Anonymisierungsfilter (eigene Begriffsliste +
Muster für IPs, Mails, Telefonnummern, Ticketnummern) und sichtbare Vorschau des
exakt gesendeten Texts. Ergebnis landet als Vorschlag, nie ungefragt in der Woche.
Offen: Nutzer-OK für Cloud-KI bzw. Wunsch nach lokaler Alternative.

### E-012 · IHK-Portal über eingebettetes Fenster · vorgeschlagen
Eigenes `BrowserWindow` (separate Session-Partition, `sandbox`, minimale Preload)
lädt das IHK-Portal. Der Nutzer loggt sich selbst ein (kein Passwort-Speichern),
die App füllt die drei Felder der gewählten Woche. **Absenden klickt der Nutzer
selbst.** Keine externe Browser-Automatisierung (Playwright o. ä.) → keine
Zusatzinstallation. Spike nötig: Portal-URL, DOM-Struktur, Login-Verfahren.

### E-013 · WebUntis über Main-Prozess · vorgeschlagen
Abruf von Stundenplan (+ falls sichtbar: Lehrstoff/Klassenbuch-Themen) über die
WebUntis-JSON-RPC-Schnittstelle aus dem Main-Prozess, Zugangsdaten nach E-008.
Fächer-Mapping WebUntis → LF-Label pro Profil. Spike nötig: welche Daten für
Schüler-Accounts der Schule tatsächlich abrufbar sind.
