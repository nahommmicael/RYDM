// src/map/coverPins.js
// Zentrale Pin-Logik: Rendering, 15s-Preview (mit Dim + Ring), smooth Progress
import maplibregl from "maplibre-gl";
import { allTracks } from "../data/tracks";

// ---- helpers to normalize iTunes/local fields ----
function getCoverUrl(t) {
  if (!t) return "";
  const cand = (
    t.cover || t.artwork || t.image || t.coverUrl ||
    t.artworkUrl512 || t.artworkUrl100 || t.artworkUrl60 || t.artworkUrl ||
    (t.album && (t.album.cover || t.album.artwork)) || ""
  );
  if (!cand) return "";
  // Upscale common Apple artwork patterns to 512px if possible
  try {
    // .../100x100bb.jpg or .../60x60bb.jpg → 512x512bb.jpg
    return String(cand).replace(/\/(?:60|100|200|300|400)x\1?\1?bb\.(jpg|png)(?:\?.*)?$/i, "/512x512bb.$1");
  } catch { return cand; }
}

function getPreviewUrl(t) {
  if (!t) return "";
  // Prefer explicit preview fields (iTunes) then local demo keys
  return (
    t.previewUrl || t.preview || t.audioUrl || t.streamUrl || t.mp3 || t.url || ""
  );
}

/* ---------- utils ---------- */
function seededRng(seed) {
  let x = (seed | 0) || 1; // xorshift32
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}
function coordsAround(center, n, rMeters, rnd) {
  const [lng, lat] = center;
  const toRad = Math.PI / 180;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(lat * toRad);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = 2 * Math.PI * rnd();
    const u = rnd();
    const d = rMeters * Math.sqrt(u);
    const dx = d * Math.cos(t), dy = d * Math.sin(t);
    out.push([lng + dx / mPerDegLng, lat + dy / mPerDegLat]);
  }
  return out;
}
function pickTracksFrom(source, n, rnd) {
  const a = Array.isArray(source) ? [...source] : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

/* ---------- CSS once ---------- */
function ensureCss() {
  if (document.querySelector("style[data-rydm='coverpin-css']")) return;
  const s = document.createElement("style");
  s.setAttribute("data-rydm", "coverpin-css");
  s.textContent = `
    .rydm-cover-pin{ width:36px; height:36px; border-radius:12px; overflow:hidden;
      box-shadow:0 6px 18px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.08);
      position:relative; }
    .rydm-cover-pin-inner{ width:100%; height:100%; border-radius:inherit; overflow:hidden;
      transition: transform 120ms cubic-bezier(.2,.8,.2,1); will-change: transform; }
    .rydm-cover-pin-inner:active{ transform: scale(.97); }
    .rydm-cover-pin img{ width:100%; height:100%; object-fit:cover; display:block; border-radius:inherit; }

    /* Dim-Layer auf dem Cover während Preview */
    .rydm-dim{ position:absolute; inset:0; background:#000; opacity:0; pointer-events:none;
      transition: opacity 160ms cubic-bezier(.2,.8,.2,1); }

    /* Conic-Progress-Ring (dezenter) */
    .rydm-ring2{ position:absolute; inset:0; pointer-events:none; opacity:.55;
      transition: opacity 160ms cubic-bezier(.2,.8,.2,1);
      background: conic-gradient(var(--ringColor, #fff) var(--p, 0deg), transparent 0);
      -webkit-mask: radial-gradient(circle, transparent calc(50% - var(--thick, 2.6px)),
                                    #000 calc(50% - var(--thick, 2.6px)),
                                    #000 calc(50% + var(--thick, 2.6px)),
                                    transparent calc(50% + var(--thick, 2.6px)));
              mask: radial-gradient(circle, transparent calc(50% - var(--thick, 2.6px)),
                                    #000 calc(50% - var(--thick, 2.6px)),
                                    #000 calc(50% + var(--thick, 2.6px)),
                                    transparent calc(50% + var(--thick, 2.6px)));
      /* leichte Kanten-Qualität */
      filter: drop-shadow(0 0 2px rgba(0,0,0,.25));
    }
  `;
  document.head.appendChild(s);
}

/* ---------- controller ---------- */
/**
 * createCoverPinsController(map, deps?)
 * deps (optional):
 *  - pauseMain?: () => void          // Hauptplayer pausieren, bevor Preview startet
 *  - resumeMain?: () => void         // Hauptplayer ggf. weiterlaufen lassen nach Preview
 *  - playFull?: (track) => void      // Vollsong starten (z.B. nach Doppeltipp)
 *  - isMainPlaying?: () => boolean  // gibt true zurück, wenn der Hauptplayer aktuell spielt
 *  - getTracks?: () => Array    // liefert die aktuelle Playlist (Whitelist/Online/Local)
 */
export function createCoverPinsController(map, deps = {}) {
  ensureCss();

  let markers = [];
  let rafId = null;
  let audio = null;
  let playingRing = null;
  let playingDim = null;
  let playingTrack = null;
  let startTime = 0;
  let lastDeg = 0;
  let wasResumed = false;

  const getIsMainPlaying = () => {
    try {
      if (typeof deps?.isMainPlaying === 'function') return !!deps.isMainPlaying();
    } catch {}
    try {
      if (typeof window !== 'undefined' && typeof window.__playerIsPlaying === 'function') {
        return !!window.__playerIsPlaying();
      }
    } catch {}
    return false;
  };

  const resolveTracks = () => {
    try {
      if (typeof deps?.getTracks === 'function') {
        const r = deps.getTracks();
        if (Array.isArray(r) && r.length) return r;
      }
      if (Array.isArray(deps?.playlist) && deps.playlist.length) return deps.playlist;
      if (Array.isArray(window.__rydmOnlineTracks) && window.__rydmOnlineTracks.length) return window.__rydmOnlineTracks;
    } catch {}
    return allTracks;
  };

  const MAX_PREVIEW = 15; // sec
  const LONG_PRESS_MS = 480; // hold to play full

  const clear = () => {
    markers.forEach(m => { try { m.remove(); } catch {} });
    markers = [];
  };

  const stopPreview = (resume = true) => {
    try { if (audio) { audio.pause(); audio.src = ""; } } catch {}
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (playingRing) {
      playingRing.style.setProperty('--p', '0deg');
      playingRing.style.opacity = '.55';
      playingRing = null;
    }
    if (playingDim) {
      playingDim.style.opacity = '0';
      playingDim = null;
    }
    playingTrack = null;
    startTime = 0;
    lastDeg = 0;
    if (resume && wasResumed && deps?.resumeMain) {
      try { deps.resumeMain(); } catch {}
    }
    // Reset immer am Ende
    wasResumed = false;
  };

  const smoothTo = (from, to) => from + (to - from) * 0.22; // Low-pass für butterweiche Bewegung

  const tick = () => {
    if (!audio || !playingRing) return;
    const t = audio.currentTime || 0;
    const ratio = Math.max(0, Math.min(1, (t - startTime) / MAX_PREVIEW));
    const targetDeg = ratio * 360;
    lastDeg = smoothTo(lastDeg, targetDeg);
    playingRing.style.setProperty('--p', `${lastDeg}deg`);
    if (ratio >= 1) {
      stopPreview(true);
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  const startPreview = (track, ringEl, dimEl) => {
    // Wenn dieselbe Preview bereits läuft -> neustarten
    stopPreview(false);

    if (!audio) {
      audio = new Audio();
      audio.preload = "metadata";
      try { audio.crossOrigin = "anonymous"; } catch {}
    }

    playingRing = ringEl || null;
    playingDim  = dimEl  || null;
    playingTrack = track;
    lastDeg = 0;

    // Dim + Ring sichtbar (mit forced paint, damit PWA/iOS beim ersten Mal sicher rendert)
    if (playingDim) playingDim.style.opacity = '0.35'; // zart abdunkeln
    if (playingRing) {
      playingRing.style.setProperty('--thick', '2.6px');
      playingRing.style.setProperty('--p', '0deg');
      playingRing.style.opacity = '0';              // start hidden
      void playingRing.offsetWidth;                 // force reflow
      requestAnimationFrame(() => {
        // zweiter Frame für WebKit, sonst flackert der conic-gradient
        requestAnimationFrame(() => {
          playingRing.style.opacity = '.7';
          // mini-kick, falls 0deg nicht gepaintet wird
          playingRing.style.setProperty('--p', '0.01deg');
        });
      });
    }

    // Hauptplayer pausieren, aber nur fortsetzen, wenn er vor Start wirklich spielte
    wasResumed = false;
    try {
      const wasPlayingBefore = getIsMainPlaying();
      if (deps?.pauseMain) { try { deps.pauseMain(); } catch {} }
      if (wasPlayingBefore) wasResumed = true;
    } catch { wasResumed = false; }

    const src = getPreviewUrl(track);
    if (!src) {
      // No preview available for this track – abort gracefully
      stopPreview(false);
      return;
    }
    audio.src = src;
    audio.currentTime = 0;

    const onLoaded = () => {
      const d = audio.duration || 0;
      // angenehme Stelle ~35% (aber so, dass 15s passen)
      const target = Math.max(5, Math.min(d - (MAX_PREVIEW + 2), d * 0.35));
      try { if (Number.isFinite(target) && target > 0) audio.currentTime = target; } catch {}
      startTime = audio.currentTime || 0;
      // nudge the ring once more after start to avoid first-frame stall
      if (playingRing) {
        requestAnimationFrame(() => playingRing.style.setProperty('--p', '0.02deg'));
      }
      rafId = requestAnimationFrame(tick);
      try { audio.play(); } catch {}
    };

    const onEnded = () => stopPreview(true);
    const onTime = () => {
      if ((audio.currentTime || 0) - startTime >= MAX_PREVIEW) stopPreview(true);
    };

    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("timeupdate", onTime);

    // Falls iOS schon früher startet
    const onPlay = () => {
      if (!rafId) rafId = requestAnimationFrame(tick);
      audio.removeEventListener("play", onPlay);
    };
    audio.addEventListener("play", onPlay, { once: true });
  };

  const render = ({ center, seed, radius = 800, count = 5 }) => {
    clear();

    const rnd = seededRng(seed || 1);
    const coords = coordsAround(center, count, radius, rnd);
    const source = resolveTracks();
    const tracks = pickTracksFrom(source, count, rnd);

    coords.forEach((lngLat, i) => {
      const t = tracks.length ? tracks[i % tracks.length] : null;
      if (!t) return; // no track available → skip creating this pin

      const el = document.createElement("div");
      el.className = "rydm-cover-pin";

      const inner = document.createElement("div");
      inner.className = "rydm-cover-pin-inner";
      el.appendChild(inner);

      const img = document.createElement("img");
      const cover = getCoverUrl(t);
      img.src = cover || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36'><rect width='36' height='36' fill='%23121'/></svg>";
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      inner.appendChild(img);

      // Dim-Layer
      const dim = document.createElement("div");
      dim.className = "rydm-dim";
      el.appendChild(dim);

      // Progress-Ring
      const ringEl = document.createElement("div");
      ringEl.className = "rydm-ring2";
      ringEl.style.setProperty("--thick", "2.6px");
      ringEl.style.setProperty("--p", "0deg");
      el.appendChild(ringEl);

      // Interactions:
      // - Tap: start/stop preview (start on first tap, stop if already running)
      // - Long press (>=480ms): play full track
      let lpTimer = null;
      let longPressed = false;
      let startedByThisPress = false;
      let wasRunningOnDown = false;

      const clearLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
      const isPreviewActiveFor = (track) => !!(playingTrack && audio && !audio.paused && playingTrack.id === track.id);

      // Avoid iOS context menu / image callout
      el.addEventListener("contextmenu", (e) => e.preventDefault());

      el.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        longPressed = false;
        startedByThisPress = false;
        wasRunningOnDown = isPreviewActiveFor(t);

        // If preview wasn't running for this pin, start it immediately
        if (!wasRunningOnDown) {
          startPreview(t, ringEl, dim);
          startedByThisPress = true;
        }

        // Lock map gestures during press to avoid incidental move/seed causing a re-render
        try { map.dragPan.disable(); map.touchZoomRotate.disable(); } catch {}

        // Long-press escalates to full play
        clearLP();
        lpTimer = setTimeout(() => {
          longPressed = true;
          // Stop preview without auto-resume and play full track
          stopPreview(false);
          try { deps?.playFull?.(t); } catch {}
        }, LONG_PRESS_MS);
      }, { passive: false });

      const endPress = () => {
        // Re-enable gestures after press
        try { map.dragPan.enable(); map.touchZoomRotate.enable(); } catch {}

        const wasLP = longPressed;
        clearLP();

        if (wasLP) return; // already escalated to full play

        // If preview was running before this press → user intended to stop it (toggle-off)
        if (wasRunningOnDown) {
          stopPreview(true);
          return;
        }
        // If we started preview on pointerdown (quick tap), KEEP it running (do nothing)
      };
      el.addEventListener("pointerup", endPress, { passive: true });
      el.addEventListener("pointercancel", endPress, { passive: true });
      el.addEventListener("pointerleave", endPress, { passive: true });

      const mk = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(lngLat)
        .addTo(map);
      markers.push(mk);
    });
  };

  const destroy = () => {
    stopPreview(false);
    clear();
  };

  return { render, clear, destroy, stopPreview };
}