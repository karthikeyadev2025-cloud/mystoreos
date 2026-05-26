import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { hideSplash, setStatusBarDark } from './lib/native'

// Hide Capacitor splash screen after React mounts
setStatusBarDark();
setTimeout(hideSplash, 300);
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
