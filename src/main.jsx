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

createRoot(document.getElementById('root')).render(<App />)
