# Umbau-Plan: Berichtspilot automatisieren

> **Staffelstab zwischen den Chats.** Jede Session liest zuerst „Nächster Schritt"
> und „Offene Fragen" und aktualisiert beides am Ende. Erledigtes abhaken `[x]`,
> mit PR-Link/Datum. Entscheidungen → `ENTSCHEIDUNGEN.md`.

## Vision

Heute: Tätigkeiten aus Zeiterfassung und WebUntis abtippen → App formatiert → drei
Blöcke ins IHK-Portal kopieren.

Ziel: **Pro Tag kurz diktieren, WebUntis-Themen kommen automatisch, die KI
formuliert sauber, ein Klick trägt die Woche ins IHK-Portal ein** — der Nutzer
prüft nur noch und klickt selbst auf Absenden.

```
Diktat (lokal) ─┐
WebUntis ───────┼─► Rohdaten je Tag ─► KI-Formulierung ─► Woche (wie heute) ─► IHK-Portal
(Zeiterf.-Datei)┘    (daten.json)       (anonymisiert,      editierbar,          (eingebettetes
                                         mit Vorschau)      exaktes Format       Fenster, Nutzer
                                                                                  sendet selbst)
```

## Leitplanken

- „Easy to use": Installer → läuft. Keine Pflicht-Zusatzsoftware (E-006).
- Lokal zuerst; Netzwerk nur Main-Prozess + Allowlist (E-007).
- Kundendaten verlassen den Rechner nie unbemerkt (E-009, E-010, E-011).
- Ohne Netz/Accounts funktioniert alles wie v1.2 (jede Automatik ist optional).
- Ausgabeformat und `daten.json`-Sicherheit bleiben unangetastet.

## Nächster Schritt

**Schritt 1.1 — Schema v3: Rohnotizen pro Tag**

Ziel: Grundlage, damit Diktat/Import/KI Rohtext ablegen können, ohne die fertigen
Stichpunkte zu überschreiben.

- In `src/lib/model.js`: `DATEN_VERSION = 3`; jeder Tag erhält `notizen: ''`
  (Rohtext, z. B. Diktat-Transkript). Migration 2 → 3 in `migriereDaten()` ergänzt
  das Feld in allen bestehenden Tagen. `neueWoche()`/`wocheAusVorlage()` legen es an.
- `validiereDaten()` akzeptiert fehlendes/vorhandenes `notizen` (String).
- Tests in `model.test.js`: Migration v2-Datei → v3, neue Woche hat `notizen`.
- `format.js` ignoriert `notizen` (Ausgabe unverändert — Format-Tests bleiben grün).
- UI (`WochenEditor.jsx`): pro Tag ein einklappbares Feld „Notizen (Rohtext)"
  oberhalb der Stichpunkte, dezent, standardmäßig zu, wenn leer.
- `docs/DATENMODELL.md` + CHANGELOG aktualisieren.

Danach: Schritt 1.2.

## Offene Fragen (an den Nutzer)

1. **KI-Formulierung:** Ist eine Cloud-KI (Claude-API, eigener API-Key, Kosten
   grob wenige Cent pro Woche) okay — mit Anonymisierung + Vorschau? Oder muss es
   zwingend lokal laufen (dann deutlich schwächere Qualität bzw. Zusatzsoftware)?
2. **Spracherkennungs-Modell:** Einmaliger Download (~150–500 MB) beim ersten
   Diktat okay, oder soll das Modell im Installer stecken (größerer Download)?
3. **WebUntis:** Schulname/Server (z. B. `xyz.webuntis.com`)? Sieht man als Schüler
   in WebUntis die eingetragenen **Unterrichtsthemen/Lehrstoff** — oder nur den
   Stundenplan?
4. **IHK-Portal:** URL der Berichtsheft-Seite, Login-Verfahren (2FA?), und
   Screenshots (oder gespeichertes HTML) der Eingabemaske einer Woche.
5. **Zeiterfassung:** Welches System? Gibt es einen Export (CSV/Excel), der
   *ohne* Kundendaten auskommt — oder reicht die Spracheingabe komplett?

## Roadmap

### Phase 0 — KI-Fundament
- [x] Repo-Struktur für KI-Arbeit: `CLAUDE.md` neu, `docs/`-Wissensbasis,
      Skills `/weiter` + `/abschluss`, SessionStart-Hook (2026-10)

### Phase 1 — Fundament für Automatisierung (nicht blockiert)
- [ ] 1.1 Schema v3: `notizen` (Rohtext) pro Tag + UI-Feld
- [ ] 1.2 Geheimnis-Speicher: `electron/geheimnisse.js` (safeStorage, eigene Datei),
      IPC `geheimnis:setzen|vorhanden|loeschen` (Werte gehen nie zum Renderer zurück)
- [ ] 1.3 Netzwerk-Schicht im Main: `electron/netz.js` — `fetch`-Wrapper mit
      Host-Allowlist, Timeout, verständlichen Fehlern; Vitest für die Allowlist
- [ ] 1.4 Einstellungen → neuer Bereich „Verbindungen & Automatik" (je Funktion
      an/aus, Status, Zugangsdaten)
- [ ] 1.5 Anonymisierung als reine Lib `src/lib/anonymisierung.js`: eigene
      Begriffsliste (Kunden, Namen) + Muster (IPv4/6, Mail, Telefon, Ticket-Nr.) →
      Platzhalter; Tests

### Phase 2 — Spracheingabe (offline)
- [ ] 2.1 Spike: Whisper-Variante wählen (Qualität Deutsch, Größe, Geschwindigkeit,
      Packaging für NSIS/portable/AppImage, CSP) → E-010 entscheiden
- [ ] 2.2 Mikrofon: `setPermissionRequestHandler` erlaubt nur `media` fürs eigene Fenster
- [ ] 2.3 Transkription im Utility-Process/Worker, IPC `sprache:transkribieren`
- [ ] 2.4 UI: Diktat-Button je Tag (Aufnahme-Status, Pegel, Abbrechen) → `notizen`
- [ ] 2.5 Ohne KI: Notizen per Klick in Stichpunkte zerlegen (Satz-/Zeilensplit)

### Phase 3 — KI-Formulierung
- [ ] 3.1 Provider-Abstraktion im Main (`electron/ki.js`), erster Provider laut Frage 1
- [ ] 3.2 Prompt mit Stilregeln aus `AUSGABEFORMAT.md` + Beispielen aus den eigenen
      fertigen Wochen (Few-Shot, anonymisiert)
- [ ] 3.3 UI: „Formulieren" je Tag/Woche → Vorschau gesendeter Text → Vorschläge
      übernehmen/verwerfen/einzeln bearbeiten
- [ ] 3.4 Schultage: Themenstichworte je Fach glätten

### Phase 4 — WebUntis-Import
- [ ] 4.1 Spike mit echtem Account: Login, Stundenplan, Lehrstoff abrufbar? → E-013
- [ ] 4.2 `electron/webuntis.js` + Mapping WebUntis-Fach → LF-Label (im Profil)
- [ ] 4.3 „Woche aus WebUntis füllen": Schultage + Fächer + Themen, Ferien/Ausfall erkennen

### Phase 5 — IHK-Portal eintragen
- [ ] 5.1 Spike: Portal-DOM analysieren (Material vom Nutzer, Frage 4) → E-012
- [ ] 5.2 Portal-Fenster mit eigener Partition + Fill-Preload; Nutzer loggt selbst ein
- [ ] 5.3 „Woche eintragen": richtige Woche im Portal wählen, 3 Felder füllen,
      Erfolg prüfen, Status in Berichtspilot vermerken (z. B. `eingetragenAm`)

### Phase 6 — Komfort
- [ ] Auto-Update (electron-updater, GitHub Releases)
- [ ] Freitags-Erinnerung (Tray/Notification), wenn die Woche Entwurf ist
- [ ] Wochen automatisch anlegen beim Start
- [ ] Ideen aus alter README-Roadmap: Light-Theme, „Alle 3 Blöcke kopieren",
      Gesamtexport/PDF, Einzeltag aus Vorwoche kopieren, Zeichenzähler
- [ ] README-Badge „100 % offline" anpassen, sobald Netzwerkfunktionen existieren

## Erledigt-Log

| Datum | Schritt | PR |
|---|---|---|
| 2026-10-09 | Phase 0: KI-Fundament | (dieser Branch) |
