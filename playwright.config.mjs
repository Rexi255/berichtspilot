// End-to-end tests (phase 10): `npm run test:e2e` builds the renderer and runs
// both projects; CI runs them under xvfb (.github/workflows/ci.yml).
//  - browser:  the built renderer in Chromium via `vite preview` — `browserApi`
//              in src/store.jsx replaces the IPC bridge, data in localStorage
//  - electron: the real app (unpacked, like `npm start`) through Playwright's
//              Electron driver, daten.json in a temp folder. Not the packaged
//              app: its fuses refuse the inspector the driver needs (E-029).
//  - packaged: the built app from release/ over CDP — only with PACKAGED_APP
//              set (release workflow), skipped otherwise
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'browser',
      testMatch: 'smoke.spec.mjs',
      use: {
        browserName: 'chromium',
        baseURL: 'http://127.0.0.1:4173',
        // German local dates like the users (the clock is fixed per test)
        timezoneId: 'Europe/Berlin',
        locale: 'de-DE',
      },
    },
    { name: 'electron', testMatch: 'electron.spec.mjs', timeout: 60_000 },
    { name: 'packaged', testMatch: 'packaged.spec.mjs', timeout: 60_000 },
  ],
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
})
