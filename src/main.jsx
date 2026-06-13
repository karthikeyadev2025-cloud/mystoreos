import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (Plus Jakarta Sans + JetBrains Mono) for consistent typography
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@fontsource/plus-jakarta-sans/800.css'
import '@fontsource/jetbrains-mono/400.css'
import './styles/tokens.css'
import './index.css'
import App from './App.jsx'

// Service worker: auto-update and reload immediately when a new version ships,
// so users never get stuck on a stale cached build after a deploy.
import { registerSW } from 'virtual:pwa-register'
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // A new version is available — activate it (skipWaiting) right away.
    updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    // Poll for updates every 30s so long-open tabs pick up new deploys.
    if (registration) {
      setInterval(() => { registration.update().catch(() => {}) }, 30 * 1000)
    }
  },
})

// Hard guarantee: when a new service worker takes control, reload the page once
// so the user immediately runs the new build with no manual hard-refresh.
// (autoUpdate skips waiting but does not reload open pages by itself.)
if ('serviceWorker' in navigator) {
  let _reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_reloaded) return
    _reloaded = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
