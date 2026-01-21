// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const REF_H = 852;
const REF_W = 393;

function setDesignScaleVars() {
  const vv = window.visualViewport;
  const h = vv?.height ?? window.innerHeight;
  const w = vv?.width ?? window.innerWidth;

  const sy = h / REF_H;
  const sx = w / REF_W;

  document.documentElement.style.setProperty("--sy", String(sy));
  document.documentElement.style.setProperty("--sx", String(sx));
}

setDesignScaleVars();
window.visualViewport?.addEventListener("resize", setDesignScaleVars);
window.addEventListener("resize", setDesignScaleVars);

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