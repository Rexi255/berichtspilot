import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// A file dragged onto the window would otherwise replace the app with that
// file (the main process refuses the navigation too, step 7.1). Internal drags
// (reordering bullets) and dragged text carry no files and stay untouched.
const carriesFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
window.addEventListener('dragover', (e) => {
  if (!carriesFiles(e)) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'none'
})
window.addEventListener('drop', (e) => {
  if (carriesFiles(e)) e.preventDefault()
})

// Start in the last used mode and accent — a cache of settings.appearance in
// this window's localStorage (App.jsx writes it) — so a light setup doesn't
// flash dark while daten.json loads. daten.json stays the source of truth.
try {
  const cached = JSON.parse(localStorage.getItem('appearance') ?? 'null')
  if (cached?.mode) document.documentElement.dataset.mode = cached.mode
  if (cached?.accent) document.documentElement.dataset.accent = cached.accent
} catch {
  // no cache (first start, blocked storage): the dark default from index.html
}

createRoot(document.getElementById('root')).render(<App />)
