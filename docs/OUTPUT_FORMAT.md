# Output format — binding specification

Per week the app produces three text blocks that are pasted 1:1 into the three
fields of the IHK training record. The format comes from real, accepted reports and
is **not negotiable**. The output itself is German.

Implementation: `src/lib/format.js` · tests with the original examples:
`src/lib/format.test.js`.

## Block 1 — Betriebliche Tätigkeiten (work)

- Per work day: header `<Wochentag>, den TT.MM.JJJJ:`, below it bullets `- …`.
- **One** blank line between days. Empty bullets are dropped, text is trimmed.
- Holiday/sick/vacation replace all bullets with exactly one status line:
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

## Block 2 — Unterweisungen, betrieblicher Unterricht, sonstige Schulungen (instructions)

Free text, trimmed. Usually empty.

## Block 3 — Berufsschule (Unterrichtsthemen) (school)

- Per school day: header, **one blank line**, then per subject `<Label>:` with bullets.
- **One** blank line between subjects, **two** blank lines between days.
- Status days (holiday/sick/vacation) are **compact**: header with the status line
  directly below (no blank line, no subjects). Where a compact day borders another
  day, only **one** blank line separates them (as in the real reports).
  A school day without filled-in subjects is compact as well (header only).
- Subjects without a label or without non-empty bullets are dropped.

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

```
Montag, den 18.05.2026:
- Krankheitstag

Dienstag, den 19.05.2026:

LF04:
- Subnetting
```

## Bullet style (relevant for AI phrasing)

Derived from the real reports — applies to automatically phrased text:

- Nominal style, factual, correct technical terms ("Konfiguration der Switch-Ports",
  "Fehlerdiagnose bei DHCP-Zuweisungsproblemen").
- One bullet = one activity, 1–2 lines. No "ich", no times of day.
- **No customer names, personal names, IPs, ticket numbers or passwords.**
  Rephrase neutrally ("bei einem Kunden", "an einem Mitarbeiter-Arbeitsplatz").
- Do not invent activities: only rephrase what the notes contain.
- School: short topic keywords per subject, as in the example above.
