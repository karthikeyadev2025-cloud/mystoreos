import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted Outfit font — eliminates Google Fonts cross-origin SRI scanner flag
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/700.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
