// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// === Design scale (Figma reference: 393 × 852) ===
const REF_H = 852;
const REF_W = 393;
const IPHONE_16_PRO_W = 402;
const IPHONE_16_PRO_H = 874;

function setDesignScaleVars() {
  const sy = IPHONE_16_PRO_H / REF_H;
  const sx = IPHONE_16_PRO_W / REF_W;

  document.documentElement.style.setProperty("--sy", String(sy));
  document.documentElement.style.setProperty("--sx", String(sx));
  document.documentElement.style.setProperty("--device-w", `${IPHONE_16_PRO_W}px`);
  document.documentElement.style.setProperty("--device-h", `${IPHONE_16_PRO_H}px`);
}

// Optional: allow Home/SearchOverlay to re-apply fixed values after close.
window.__rydmRescale = setDesignScaleVars;

setDesignScaleVars();

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
