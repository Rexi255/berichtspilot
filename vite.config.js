import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The CSP in index.html lets the renderer reach the dev server (HMR). The
// built app has no dev server — its CSP keeps connect-src at 'self' only, so no
// local port is reachable from the renderer (step 7.1). Fails the build if the
// CSP changed and the dev hosts can't be found any more.
const DEV_CONNECT_SOURCES = ' ws://localhost:5173 http://localhost:5173'
const productionCsp = {
  name: 'production-csp',
  apply: 'build',
  transformIndexHtml(html) {
    if (!html.includes(DEV_CONNECT_SOURCES)) throw new Error('index.html: dev connect-src not found — update vite.config.js')
    return html.replace(DEV_CONNECT_SOURCES, '')
  },
}

export default defineConfig({
  // Relative paths so the build loads via file:// in Electron
  base: './',
  plugins: [react(), tailwindcss(), productionCsp],
  server: {
    // IPv4 explicitly: on Windows `localhost` may resolve to ::1 only, and the
    // dev script's `wait-on tcp:127.0.0.1:5173` would then wait forever
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'chrome120',
  },
  test: {
    // Unit tests only — the end-to-end tests in e2e/ belong to Playwright
    include: ['src/**/*.test.{js,jsx}', 'electron/**/*.test.mjs'],
    // German local time (with DST) like the users — date bugs around the
    // clock change only show up there, not in a UTC container (step 7.5)
    env: { TZ: 'Europe/Berlin' },
  },
})
