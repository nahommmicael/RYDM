// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// === Design scale (Figma reference: 393 × 852) ===
const REF_H = 852;
const REF_W = 393;

// Keep a stable height that ignores iOS keyboard shrink.
let __baseH = window.innerHeight;

function setDesignScaleVars() {
  const vv = window.visualViewport;
  const hNow = vv?.height ?? window.innerHeight;
  const wNow = vv?.width ?? window.innerWidth;

  // iOS keyboard usually causes a large sudden height drop.
  // We don't want to re-scale the entire UI based on keyboard height.
  const keyboardLikeDrop = (__baseH - hNow) > 120;

  // Update base height only when it's not a keyboard-driven shrink.
  if (!keyboardLikeDrop) {
    __baseH = hNow;
  }

  const sy = __baseH / REF_H;
  const sx = wNow / REF_W;

  document.documentElement.style.setProperty("--sy", String(sy));
  document.documentElement.style.setProperty("--sx", String(sx));
}

// Optional: allow Home/SearchOverlay to force a recalculation after close.
window.__rydmRescale = setDesignScaleVars;

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
