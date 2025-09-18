// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// PWA-Register (nur wenn vite-plugin-pwa aktiv ist)
if (import.meta.env.PROD || import.meta.env.DEV) {
  // lazy import to avoid errors if plugin is off
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        // Optional: kleine UI/Toast einbauen
        // Für jetzt: sofort neu laden
        window.location.reload()
      },
      onOfflineReady() {
        // Optional: Toast "Offline ready"
        console.log('PWA offline ready')
      },
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)