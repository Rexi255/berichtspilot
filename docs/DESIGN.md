# Design system "Kladde" (v2.1)

Replaces "Nordlicht" (v1–v2.0). Decision: E-032. The code is the source of truth (`src/index.css`,
`src/ui/basics.jsx`); this file explains the rules behind it. When the two disagree, fix one of them in the
same commit.

## Direction

- **Product:** an apprentice writes their week day by day, checks the exact text and copies three blocks into
  the IHK portal.
- **Character:** exact, calm, a little warm.
- **World:** the paper Berichtsheft and the rough notebook ("Kladde"), a calendar grid, typewriter text, but only
  in the preview.
- **Moments:** the places where the screen may be rich.
  1. The **year band** in the overview: the whole apprenticeship as a grid of days.
  2. The **preview column**: exactly the text that gets pasted, whitespace visible on request.
- **Signature:** the **day cell** (see below). Used in the year band, the week list rows and the day tabs only.
- **Read:** a dense desktop tool for one person. Keyboard first, equally good with the mouse. Little chrome,
  content first.

## Color

`data-mode="dark|light"` and `data-accent="blue|coral|lilac|green"` sit on `<html>` (from
`settings.appearance`, schema v12). Every token is defined in every mode block; `color-scheme` follows the mode
so native date fields match.

Neutrals: warm, no blue cast. Tailwind names in brackets.

| Role | Dark | Light |
|---|---|---|
| Page background (`bg`) | #121211 | #f4f3ee |
| Sidebar (`sidebar`) | #0d0d0c | #ebe9e2 |
| Card (`surface`) | #1a1a18 | #fcfcfa |
| Raised, inputs, hover (`surface-2`) | #242422 | #e7e5dd |
| Line (`line`) | #2f2f2c | #d8d6cc |
| Text (`ink`) | #efeee8 | #161614 |
| Muted text and icons (`ink-2`) | #a8a79e | #55544d |

Accent: one per mode, adjusted so text and marks reach **4.5:1**. Text on the accent is dark (#121211) in
dark mode and near white (#fcfcfa) in light mode, never grey.

| Accent | Dark | Light |
|---|---|---|
| Logo-Blau (default) | #6CC9DE (the logo file's value) | #1F6F82 (same hue, darker) |
| Koralle | #F08A6E | #B6462B |
| Flieder | #B9A3F0 (muted on purpose, never in a gradient) | #6650B0 |
| Grün | #7CCB8E | #2F7A44 |

**The accent is used only for:**
- primary actions
- the active navigation (icon, tab underline)
- written day cells
- the status "Fertig"

Everything else stays neutral.

**Status is never color alone**; each one has a shape or a letter too:

| Status | Color | Shape |
|---|---|---|
| Fertig (week) | accent | filled square |
| Entwurf (week) | amber | half-filled square |
| Fehlt (week) | red | dashed square |
| Feiertag / Krank / Urlaub (day) | three muted hues | `surface-2` fill with the letter F / K / U in the status color |

`src/theme.test.js` reads `src/index.css` and checks every mode × accent pair with `src/lib/contrast.js`:
- accent on `bg`/`surface` ≥ 4.5:1
- text on the accent ≥ 4.5:1
- `ink-2` on `bg`/`surface`/`surface-2` ≥ 4.5:1
- status letters on their fill ≥ 4.5:1
- meaningful lines and cells against their surface ≥ 3:1

Write tokens as hex so the test can read them.

## Type

All fonts ship with the app through `@fontsource-variable/*` (the CSP allows no font CDN).

| Use | Family | Size / weight |
|---|---|---|
| Page titles | Bricolage Grotesque | 24 / 500 |
| "KW 42" in the editor | Bricolage Grotesque | 36 / 500 |
| Overview figures | Bricolage Grotesque | 28 / 500 |
| Interface text | Instrument Sans | 13 / 400 |
| Meta, captions | Instrument Sans | 12 / 400 |
| Card titles, emphasis | Instrument Sans | 14 / 500 |
| Preview text only | JetBrains Mono | 12.5, line height 20 |

- Bricolage only from 20 px up; keycaps use the interface font.
- Weights 400 and 500, 600 rarely. Hierarchy comes from size and color.
- Sentence case everywhere. No uppercase tracked labels, no negative tracking below 16 px, no italic for
  emphasis.
- `tabular-nums` for week numbers, dates and figures (Instrument Sans has `tnum`).

## Shape, spacing, depth

- **Radius:** card 16, button and input 10, day cell 8, chip and keycap 6. Pill shape only for the switch.
  Nested radius = outer − padding, never below 4.
- **One card level.** Inside a card, 1 px lines separate parts; never a card in a card.
- **Depth:** 1 px lines instead of shadows. Only floating things (toast, menu, tooltip) get a small neutral
  shadow.
- **Spacing:** 4 px grid; controls and rows 32 px (small 28); card padding 16; page edge 24; gaps 8 inside a
  group, 16–24 between groups.
- **Sidebar:** 232 px, collapsed 68 px (icons only, tooltips).

## The day cell (signature)

One box per weekday, always the same language:

| State | Look |
|---|---|
| geschrieben (written: a normal day with content) | accent fill |
| offen (open: a normal day without content, or a missing week) | 1 px dashed line |
| Feiertag / Krank / Urlaub | `surface-2` fill + letter F / K / U in the status color |
| Zukunft (future) | very faint line |
| frei (no such day in the week) | nothing |

Sizes:
- year band: 12 × 16, gap 3
- week list: weekday abbreviation + type letter B / S / F / K / U
- day tab: the cell next to the date

Logic: `dayState()` in `src/lib/overview.js`.

## Icons

Phosphor (already a dependency; renders inline SVG):
- weight `regular` everywhere
- 16 px, navigation 18 px
- color from the text role

No filled icon for the active state, no sparkle for AI, no round icon tile above headings, no emoji.

## Motion

CSS only, one curve `cubic-bezier(0.22, 1, 0.36, 1)`. GSAP and Lenis are gone.

| Use | Duration |
|---|---|
| Hover, press, toggles (color, surface, opacity, transform) | 120–180 ms |
| View change | 160 ms opacity fade |
| Toast | fade + 8 px rise |

- No count-ups, no looping animation, no width/height/top/left animation. The sidebar collapses instantly.
- `prefers-reduced-motion: reduce` turns all of it off.

## Copy (German UI)

- No exclamation marks; no period at the end of short labels and buttons.
- No dash as a pause in sentences; rewrite with a period or colon. The en dash stays where German typography
  needs it ("13.10.–17.10.2026", "Mo–Fr").
- Titles name the place ("Übersicht", "KW 45"), never a greeting.
- The IHK output (`src/lib/format.js`) is not UI copy and never changes for design reasons.

## Keyboard

One source: `src/lib/shortcuts.js`. Settings → Tastaturkürzel and every handler read it. Matching uses
`e.code` so German layouts work.

| Keys | Action |
|---|---|
| Strg+Umschalt+1–4 | Übersicht, Woche, Profile, Einstellungen |
| Strg+B | collapse/expand the sidebar (saved) |
| Strg+1 / 2 / 3 | copy block 1 / 2 / 3 (editor, also with the preview hidden). With a privacy warning, a second press within 4 s copies ("Trotzdem kopieren") |
| Strg+P | show/hide the preview (saved) |
| Strg+Umschalt+N | show/hide the notes area (global, saved) |
| Alt+1–5 (6) | select a day |
| Alt+← / → | previous / next week |
| Strg+N | create the week if missing |
| Strg+F | search in the overview |

## Components (`src/ui/basics.jsx`)

| Component | Purpose |
|---|---|
| `Button` | variants primary, secondary, ghost, danger, warning; sizes sm 28, md 32 |
| `IconButton` | square button with a required label and tooltip |
| `Input`, `TextArea`, `Select` | form controls |
| `Segment` | segmented control, e.g. the 5-way day type |
| `Switch` | on/off toggle |
| `Card` | the one card level; replaces `Panel` |
| `StatusChip` | Fertig / Entwurf / Fehlt with its shape; replaces `Pill` |
| `DayCell` | the signature cell |
| `Kbd` | keycap |
| `Tooltip` | label on hover and focus |
| `Menu` | small popover menu, e.g. the editor's "⋯" |

Dev only: `--view=styleguide` (unpackaged) renders every component in the current mode and accent.

## Anti-patterns (removed in v2.1, don't bring them back)

- Gradients, glows, glass, neon, aurora blobs, colored drop shadows.
- Violet/cyan AI look. Flieder is an explicit user option and stays muted.
- Round icon tiles above headings, cards with a colored left border, emoji as icons.
- Uppercase labels above every heading; grey text on a colored fill; pills everywhere.
- Count-up numbers, staggered list entrances, `hover:scale`, ping/pulse on things that aren't live.
- Equal stat tiles in a row; "Wochen in Serie"-style filler numbers.

## Checking

The `ui-shots` skill (`.claude/skills/ui-shots/`) screenshots every view with the fictional demo record in
both modes. Claude checks each visible change with it before committing (user, 2026-11-07). Lasting checks
are Playwright tests in `e2e/`:
- exact preview text = copied text
- shortcuts
- persistence of the layout switches
