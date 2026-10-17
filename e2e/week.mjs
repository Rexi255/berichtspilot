// Shared by the end-to-end tests: one bullet in a fixed week and the exact
// text block 1 must show for it (docs/OUTPUT_FORMAT.md).

// KW 18/2026 lies in the seed's sample profile "Schulhalbjahr 2025/26 · 2"
// (Mon/Tue school, Wed–Fri work) and ends with a holiday (Fri 01.05.)
export const MONDAY = '2026-04-27'
export const WEDNESDAY = '2026-04-29'
export const BULLET = 'Konfiguration der Switch-Ports'

// Thursday has no bullet: header only. ONE blank line between days.
export const BLOCK_1 = [
  'Mittwoch, den 29.04.2026:',
  `- ${BULLET}`,
  '',
  'Donnerstag, den 30.04.2026:',
  '',
  'Freitag, den 01.05.2026:',
  '- Feiertag: Tag der Arbeit',
].join('\n')

/** Type the bullet into Wednesday's (first and only) bullet field. */
export function typeBullet(page) {
  return page
    .locator('[data-daycard]', { hasText: 'Mittwoch' })
    .getByPlaceholder('Tätigkeit beschreiben …')
    .fill(BULLET)
}

/** Text of output block 1 exactly as rendered (blank lines included). */
export function block1Text(page) {
  return page.locator('[data-output="work"] pre').textContent()
}
