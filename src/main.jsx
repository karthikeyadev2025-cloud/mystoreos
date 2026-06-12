import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted Outfit font — eliminates Google Fonts cross-origin SRI scanner flag
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/700.css'
import './index.css'
import App from './App.jsx'

// Service worker: auto-update and reload immediately when a new version ships,
// so users never get stuck on a stale cached build after a deploy.
import { registerSW } from 'virtual:pwa-register'
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // A new version is available — activate it and reload once.
    updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    // Poll for updates every 60s so long-open tabs pick up new deploys.
    if (registration) {
      setInterval(() => { registration.update().catch(() => {}) }, 60 * 1000)
    }
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
