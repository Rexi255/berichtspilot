# src/lib/ — reine Fachlogik

- **Nur reine Funktionen:** kein React, kein `window`, kein `api`, keine Seiteneffekte.
  Alles muss in Vitest ohne DOM laufen.
- **Jede Datei hat einen Test daneben** (`foo.js` → `foo.test.js`). Neue Funktion ⇒
  neuer Test. Bugfix ⇒ zuerst ein Test, der den Bug zeigt.
- `format.test.js` enthält die **echten IHK-Beispiele** aus `docs/AUSGABEFORMAT.md`.
  Diese Erwartungswerte sind die Spezifikation — Code anpassen, nie den Test.
- Datum: ausschließlich die Helfer aus `dates.js` (`parseISO`, `toISO`, `addDays` …).
- Feiertage: neue/geänderte Feiertage mit Bundesland und Quelle im Kommentar belegen
  und für mindestens zwei Jahre testen.
- `model.js`: Schemaänderung ⇒ `DATEN_VERSION` hochzählen, Migrationsschritt in
  `migriereDaten()`, `validiereDaten()` anpassen, Test für „alte Datei → neue
  Struktur", `docs/DATENMODELL.md` aktualisieren.
- Neue Module für den Umbau (z. B. Parser für Spracheingabe, WebUntis-Mapper,
  Anonymisierung) gehören hierher, sofern sie rein sind.
