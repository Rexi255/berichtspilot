# Glossary — German domain terms ↔ English code names

The UI and the IHK output are German; everything in code is English. Use these
names consistently. Add new terms here before using them.

## Domain terms

| German (UI / domain) | English (code) | Meaning |
|---|---|---|
| Berichtsheft / Ausbildungsnachweis | training record / `report` | weekly proof of training submitted to the IHK |
| IHK | IHK | German Chamber of Commerce; runs the training-record portal |
| Azubi / Ausbildung | apprentice / `training` | |
| Ausbildungsbeginn / -ende | `trainingStart` / `trainingEnd` | |
| Berichtswoche / Woche | `week` | Monday-based week; id = Monday ISO date |
| Kalenderwoche (KW) | ISO week, `isoWeek` | |
| Tag | `day` | |
| Wochentag | `weekday` | keys `mon` `tue` `wed` `thu` `fri` `sat` |
| Betrieb / Betriebstag | `work` / work day | day spent at the company |
| Berufsschule / Schultag | `school` / school day | day at vocational school |
| frei | `off` | day not in the report |
| Betriebliche Tätigkeiten | `work` block | output block 1 |
| Unterweisungen, betrieblicher Unterricht, sonstige Schulungen | `instructions` | output block 2 (free text) |
| Berufsschule (Unterrichtsthemen) | `school` block | output block 3 |
| Stichpunkt | `bullet` | one line `- …` in the output |
| Fach / Lernfeld (LF) | `subject` / learning field | school subject, label like `LF03`, `WiPo` |
| Profil / Schulhalbjahr | `profile` / school half-year | weekday layout + subjects, valid for a date range |
| Gültig von / bis | `validFrom` / `validTo` | |
| Bundesland | `state` | German federal state, code like `SH` |
| Feiertag | `holiday` | public holiday |
| Zeitraum | `period` | vacation or school break range |
| Urlaub | `vacation` | |
| Schulferien | `schoolBreak` | school days become work days |
| Krank / Krankheitstag | `sick` | |
| Tagesstatus | day `status` | `normal` · `holiday` · `sick` · `vacation` |
| Entwurf / Fertig | `draft` / `done` | week status |
| Textbaustein | `snippet` | user-defined autocomplete suggestion |
| Übersicht | `overview` | start screen |
| Wochen-Editor | week editor (`WeekEditor`) | |
| Einstellungen | `settings` | |
| Start-Ansicht | `startView` | |
| Stunde (WebUntis) | lesson / `gridEntry` | one timetable block from WebUntis |
| Lehrstoff | `teachingContent` | topic the teacher entered for a lesson (WebUntis field name) |
| Notizen (WebUntis, „für alle“) | `notesAll` | short lesson note (WebUntis field name); not the day `notes` of daten.json |
| Entfall | cancelled (`status: CANCELLED`) | lesson that did not take place |
| Lücke (fehlende Woche) | gap / `missingWeeks` | |
| Notizen (Rohtext) | `notes` | raw text per day (dictation/AI input), schema v4; never in the output |
| Diktat / Spracheingabe | dictation / speech input | |
| Mit KI formulieren | AI phrasing (`phrasing`) | notes → bullets via a chat AI |
| Kopier-Brücke | clipboard bridge | user copies prompt/answer between app and chat AI (E-011) |
| Auftrag (an die KI) | prompt | built by `buildPrompt()` |
| Zeiterfassung | time tracking | |

## Schema v2 → v3 field mapping (`daten.json`)

Used by `migrateData()` (plan step 1.1). v2 names are German; v3 names are English.

| v2 | v3 |
|---|---|
| `einstellungen` | `settings` |
| `einstellungen.ausbildungVon` / `ausbildungBis` | `settings.trainingStart` / `trainingEnd` |
| `einstellungen.theme` | `settings.theme` (values renamed, see below) |
| `einstellungen.startAnsicht` | `settings.startView` (`uebersicht`→`overview`, `editor`, `profile`→`profiles`, `einstellungen`→`settings`) |
| `einstellungen.textbausteine` | `settings.snippets` |
| `zeitraeume[]` | `periods[]` |
| `zeitraum.typ` | `period.type` (`urlaub`→`vacation`, `ferien`→`schoolBreak`) |
| `zeitraum.von` / `bis` | `period.from` / `to` |
| `profile[]` | `profiles[]` |
| `profil.bundesland` | `profile.state` |
| `profil.gueltigVon` / `gueltigBis` | `profile.validFrom` / `validTo` |
| `profil.standardStichpunkte` | `profile.defaultBulletCount` |
| `profil.wochentage.{mo,di,mi,do,fr,sa}` | `profile.weekdays.{mon,tue,wed,thu,fri,sat}` |
| `wochentag.typ` | `weekday.type` (`betrieb`→`work`, `schule`→`school`, `frei`→`off`) |
| `wochentag.faecher` | `weekday.subjects` |
| `wochen[]` | `weeks[]` |
| `woche.status` | `week.status` (`entwurf`→`draft`, `fertig`→`done`) |
| `woche.unterweisungen` | `week.instructions` |
| `woche.tage[]` | `week.days[]` |
| `tag.datum` | `day.date` |
| `tag.typ` | `day.type` (`betrieb`→`work`, `schule`→`school`) |
| `tag.status` | `day.status` (`normal`, `feiertag`→`holiday`, `krank`→`sick`, `urlaub`→`vacation`) |
| `tag.feiertagName` | `day.holidayName` |
| `tag.stichpunkte` | `day.bullets` |
| `tag.faecher[].punkte` | `day.subjects[].bullets` |

Theme ids: `nordlicht`→`northern-lights`, `polarnacht`→`polar-night`,
`waldgruen`→`forest`, `bernstein`→`amber`, `rose`→`rose`, `graphit`→`graphite`.

Unchanged: `version`, all `id` values (existing ids keep their German prefixes such
as `profil-…`; they are opaque), `label`, `name`, state codes (`SH`), the file name
`daten.json` (see DECISIONS E-014).
