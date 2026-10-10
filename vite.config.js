import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative paths so the build loads via file:// in Electron
  base: './',
  plugins: [react(), tailwindcss()],
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
})
