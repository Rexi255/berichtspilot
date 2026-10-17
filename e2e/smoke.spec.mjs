// Browser smoke test (step 10.1): the built renderer in Chromium, the IPC
// bridge replaced by `browserApi` (localStorage). Fresh start → skip the
// wizard → create the week → type a bullet → exact text in output block 1.
import { test, expect } from '@playwright/test'
import { BLOCK_1, BULLET, typeBullet, block1Text, WEDNESDAY } from './week.mjs'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('fresh start to the exact text of output block 1', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  // "Today" is Wednesday of KW 18/2026, so "Neue Woche anlegen" creates it
  await page.clock.setFixedTime(new Date(`${WEDNESDAY}T09:00:00+02:00`))
  await page.goto('/')

  // Fresh install: the setup wizard opens instead of the app
  await expect(page.getByText('Willkommen bei Berichtspilot')).toBeVisible()
  await page.getByRole('button', { name: 'Überspringen' }).click()

  await expect(page.getByText('Noch keine Berichtswochen angelegt.')).toBeVisible()
  await page.getByRole('button', { name: 'Neue Woche anlegen' }).click()
  await typeBullet(page)

  // Exact comparison — toHaveText() would normalise the blank lines away
  await expect.poll(() => block1Text(page)).toBe(BLOCK_1)

  // "Kopieren" puts exactly that text on the clipboard (the Windows clipboard
  // itself stores line breaks as CRLF — a pasting browser turns them back)
  await page.locator('[data-output="work"]').getByRole('button', { name: 'Kopieren' }).click()
  await expect(page.getByText('„Betriebliche Tätigkeiten" kopiert')).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied.replace(/\r\n/g, '\n')).toBe(BLOCK_1)

  // The autosave (400 ms) reaches the storage; after a reload the week is back
  await expect.poll(() => page.evaluate(() => localStorage.getItem('daten') ?? '')).toContain(BULLET)
  await page.reload()
  await page.locator('[data-row]', { hasText: 'KW 18' }).click()
  await expect.poll(() => block1Text(page)).toBe(BLOCK_1)

  expect(errors).toEqual([])
})
