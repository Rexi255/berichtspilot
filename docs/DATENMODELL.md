# Datenmodell — `daten.json`

Aktuelle Schema-Version: **2** (`DATEN_VERSION` in `src/lib/model.js`).
Eine einzige JSON-Datei enthält Konfiguration **und** alle Berichtswochen. Sie ist
gleichzeitig das Export-/Backup-Format.

## Struktur

```jsonc
{
  "version": 2,
  "einstellungen": {
    "ausbildungVon": "2025-08-01",   // optional, für Fortschritt + Lücken-Erkennung
    "ausbildungBis": "2028-07-31",
    "theme": "nordlicht",            // eines der Themes aus src/index.css
    "startAnsicht": "uebersicht",    // uebersicht | editor | profile | einstellungen
    "textbausteine": ["…"]           // eigene Autocomplete-Vorschläge
  },
  "zeitraeume": [                    // Urlaub / Schulferien
    { "id": "zeitraum-…", "typ": "urlaub" | "ferien", "label": "", "von": "YYYY-MM-DD", "bis": "YYYY-MM-DD" }
  ],
  "profile": [                       // ein Profil je Schulhalbjahr
    {
      "id": "profil-…",
      "name": "Schulhalbjahr 2025/26 · 2",
      "bundesland": "SH",            // Code aus BUNDESLAENDER (holidays.js)
      "gueltigVon": "2026-02-02",
      "gueltigBis": "2026-07-31",
      "standardStichpunkte": 2,      // leere Stichpunkte je Betriebstag beim Anlegen
      "wochentage": {
        "mo": { "typ": "schule", "faecher": ["LF02", "LF03", "Englisch", "WiPo"] },
        "di": { "typ": "betrieb", "faecher": [] },
        "…": "…",
        "sa": { "typ": "frei", "faecher": [] }
      }
    }
  ],
  "wochen": [                        // sortiert nach id (aufsteigend)
    {
      "id": "2026-04-20",            // Montag der Woche = Primärschlüssel
      "status": "entwurf" | "fertig",
      "unterweisungen": "",          // Block 2, freier Text
      "tage": [
        {
          "datum": "2026-04-20",
          "typ": "betrieb" | "schule",
          "status": "normal" | "feiertag" | "krank" | "urlaub",
          "feiertagName": null,      // gesetzt bei status=feiertag
          "stichpunkte": ["…"],      // nur bei typ=betrieb relevant
          "faecher": [{ "label": "LF02", "punkte": ["…"] }]  // nur bei typ=schule
        }
      ]
    }
  ]
}
```

## Regeln

- **Profilwahl:** `profilFuerDatum()` mit dem **Mittwoch** der Woche; erstes
  passendes Profil gewinnt. Kein Profil ⇒ Fallback Mo–Fr Betrieb.
- **Tagesstatus beim Anlegen:** Feiertag > Urlaubs-Zeitraum > normal. Ferien machen
  Schultage zu Betriebstagen.
- **Wochen sind Snapshots:** spätere Profiländerungen ändern bestehende Wochen nicht.
- Frei-Tage (`typ: frei` im Profil) erscheinen gar nicht in `woche.tage`.
- IDs: `neueId(prefix)` → `prefix-<zeit36>-<zähler36>`; Wochen nutzen das Datum.

## Migration

`migriereDaten(roh)` in `model.js`:

| von → nach | Änderung |
|---|---|
| 1 → 2 | `zeitraeume: []`, `einstellungen.startAnsicht`, `einstellungen.textbausteine` ergänzt |

Neuere Versionen als `DATEN_VERSION` werden **abgelehnt** (Downgrade-Schutz: sonst
würde das Autosave die Datei mit einer älteren Struktur überschreiben).

**Checkliste Schemaänderung:** `DATEN_VERSION`++ → Schritt in `migriereDaten()` →
`validiereDaten()` / `mergeDaten()` prüfen → Test „alte Datei → neue Struktur" in
`model.test.js` → diese Datei + Tabelle oben aktualisieren → CHANGELOG.

## Was NICHT in daten.json gehört

API-Keys, Passwörter, Sitzungs-Tokens (→ `safeStorage`, eigene Datei), Audio-
Aufnahmen, Caches. `daten.json` wird exportiert und ggf. weitergegeben.
