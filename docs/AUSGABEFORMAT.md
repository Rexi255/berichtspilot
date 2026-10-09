# Ausgabeformat — verbindliche Spezifikation

Die App erzeugt pro Woche drei Textblöcke, die 1:1 in die drei Felder des
IHK-Berichtshefts kopiert (bzw. künftig automatisch eingetragen) werden. Das Format
stammt aus echten, abgenommenen Berichten und ist **nicht verhandelbar**.

Implementierung: `src/lib/format.js` · Tests mit Originalbeispielen: `src/lib/format.test.js`.

## Block 1 — Betriebliche Tätigkeiten

- Pro Betriebstag: Header `<Wochentag>, den TT.MM.JJJJ:`, darunter Bullets `- …`.
- **Eine** Leerzeile zwischen den Tagen. Leere Stichpunkte entfallen, Text wird getrimmt.
- Feiertag/Krank/Urlaub ersetzen alle Bullets durch genau eine Statuszeile:
  `- Feiertag: <Name>` · `- Krankheitstag` · `- Urlaub`.

```
Dienstag, den 20.01.2026:
- Fehlerdiagnose bei DHCP-Zuweisungsproblemen und Behebung von lokalen Netzwerkstörungen an mobilen Endgeräten.
- Verwaltung von WLAN-Zugangsdaten für Gäste sowie Bearbeitung von Support-Tickets im Bereich Telefonie

Mittwoch, den 21.01.2026:
- Aufbau und Inbetriebnahme eines neuen Mitarbeiter-Arbeitsplatzes inklusive Monitor-Setup und abschließendem Funktionstest der gesamten Peripherie
- Durchführung von Patch-Arbeiten an der Netzwerkdose sowie Konfiguration der zugehörigen Switch-Ports
```

```
Freitag, den 01.05.2026:
- Feiertag: Tag der Arbeit
```

## Block 2 — Unterweisungen, betrieblicher Unterricht, sonstige Schulungen

Freier Text, getrimmt übernommen. Meist leer.

## Block 3 — Berufsschule (Unterrichtsthemen)

- Pro Schultag: Header, **eine Leerzeile**, dann je Fach `<Label>:` mit Bullets.
- **Eine** Leerzeile zwischen Fächern, **zwei** Leerzeilen zwischen Tagen.
- Statustage (Feiertag/Krank/Urlaub) sind **kompakt**: Header und direkt darunter die
  Statuszeile (ohne Leerzeile, ohne Fächer). Grenzt ein kompakter Tag an einen
  anderen Tag, steht dazwischen nur **eine** Leerzeile (wie in den echten Berichten).
  Ein Schultag ohne ausgefüllte Fächer gilt ebenfalls als kompakt (nur Header).
- Fächer ohne Label oder ohne nicht-leere Punkte entfallen.

```
Montag, den 18.05.2026:
- Krankheitstag

Dienstag, den 19.05.2026:

LF04:
- Subnetting
```

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

## Stil der Stichpunkte (für KI-Formulierung relevant)

Aus den echten Berichten abgeleitet — gilt für automatisch formulierte Texte:

- Nominalstil, sachlich, Fachbegriffe korrekt („Konfiguration der Switch-Ports",
  „Fehlerdiagnose bei DHCP-Zuweisungsproblemen").
- Ein Stichpunkt = eine Tätigkeit, 1–2 Zeilen. Kein „Ich", keine Uhrzeiten.
- **Keine Kundennamen, Personennamen, IPs, Ticketnummern oder Passwörter.**
  Neutral umschreiben („bei einem Kunden", „an einem Mitarbeiter-Arbeitsplatz").
- Schule: kurze Themenstichworte je Fach, wie im Beispiel oben.
