// src/components/SearchOverlay.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import OverflowMarquee from "./OverflowMarquee";
import { mapSync } from "../state/mapSync";
import { createCoverPinsController } from "../map/coverPins";

// Map style (dark). Replace key if needed.
const STYLE_URL =
  "https://api.maptiler.com/maps/streets-v2-dark/style.json?key=URc1I3H0eEg0FixHIF0J";

// Geocoding endpoint (MapTiler) – reuse same API key from style URL
const MAPTILER_KEY = "URc1I3H0eEg0FixHIF0J";
const GEOCODE_URL = (q) =>
  `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&limit=6&language=en`;

// ---- visualViewport helper (robust on iOS) ----
function useViewport(open) {
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);
  const baseVhRef = useRef(vh);

  useEffect(() => {
    if (!open) baseVhRef.current = window.innerHeight;
  }, [open]);

  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      const ih = window.innerHeight;
      const iw = window.innerWidth;
      // while open: ignore the height shrink from keyboard for outer layout
      if (open && baseVhRef.current - ih > 100) {
        setVw(iw);
        return;
      }
      setVw(iw);
      setVh(ih);
      if (!open) baseVhRef.current = ih;
    };
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // keyboard gap from visualViewport (actual kb height)
  const kbGap = useMemo(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return 0;
    const gap = Math.max(0, window.innerHeight - vv.height);
    return gap > 60 ? Math.round(gap) : 0;
  }, [open, vw, vh]);

  return { vw, vh, kbGap };
}

export default function SearchOverlay({ open, onClose }) {
  const mapRef = useRef(null);
  const mapEl = useRef(null);
  const inputRef = useRef(null);
  const sheetRef = useRef(null);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState([]); // geocode results
  const [sel, setSel] = useState(-1);   // highlighted index in hits
  const resultMarkerRef = useRef(null);

  const pinsCtrlRef = useRef(null); // shared cover pins controller
  const unsubRef = useRef(null);    // unsubscribe from mapSync

  const isSyncingRef = useRef(false); // ← Echo-Guard gegen Ping-Pong

  // expose focus helper so the trigger can focus within the same gesture
  useEffect(() => {
    window.__rydmFocusSearch = () => {
      try {
        const el = inputRef.current;
        if (!el) return;
        el.focus({ preventScroll: true });
        const v = el.value || "";
        el.setSelectionRange(v.length, v.length);
      } catch {}
    };
    return () => { delete window.__rydmFocusSearch; };
  }, []);

  // Lock document scrolling while open (prevents background jump)
  useEffect(() => {
    const htmlPrev = document.documentElement.style.overflow;
    const bodyPrev = document.body.style.overflow;
    if (open) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.documentElement.style.overflow = htmlPrev;
      document.body.style.overflow = bodyPrev;
    };
  }, [open]);

  const { vw, vh, kbGap } = useViewport(open);

  // Debounced geocoding suggestions
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) { setHits([]); setSel(-1); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(GEOCODE_URL(q), { signal: ctrl.signal });
        const data = await res.json();
        const feats = Array.isArray(data?.features) ? data.features : [];
        setHits(feats.slice(0, 6));
        setSel(-1);
      } catch {}
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, open]);

  useEffect(() => { if (!open) { setHits([]); setSel(-1); setQuery(''); } }, [open]);

  // Auto-focus aggressively after open (iOS WKWebView friendly)
  useEffect(() => {
    if (!open) return;
    const el = inputRef.current;
    let tries = 0;
    const pump = () => {
      tries++;
      try {
        el?.focus({ preventScroll: true });
        if (el) {
          const v = el.value || "";
          el.setSelectionRange(v.length, v.length);
        }
        if (document.activeElement === el) return;
      } catch {}
      if (tries < 12) requestAnimationFrame(pump);
    };
    pump();
    const id = setTimeout(pump, 60);
    window.scrollTo(0, 0);
    return () => clearTimeout(id);
  }, [open]);

  const focusPump = () => {
    const el = inputRef.current;
    let t = 0;
    const step = () => {
      t++;
      try {
        el?.focus({ preventScroll: true });
        if (el) {
          const v = el.value || "";
          el.setSelectionRange(v.length, v.length);
        }
        if (document.activeElement === el) return;
      } catch {}
      if (t < 8) requestAnimationFrame(step);
    };
    step();
  };

  const selectHit = (idx) => {
    const feat = hits[idx];
    if (!feat) return;
    const [lon, lat] = feat.center || (feat.geometry?.coordinates ?? []);
    // Publish to global map sync so MapCard follows and pins re-seed consistently
    try { mapSync.setResult([lon, lat], 'search'); } catch {}
    try { mapSync.setView([lon, lat], 15, 'search'); } catch {}

    // Optional local marker for immediate feedback inside the sheet
    try {
      if (mapRef.current) {
        if (!resultMarkerRef.current) {
          resultMarkerRef.current = new maplibregl.Marker({ color: '#ff4d4d' });
        }
        resultMarkerRef.current.setLngLat([lon, lat]).addTo(mapRef.current);
        mapRef.current.flyTo({ center: [lon, lat], zoom: 15, speed: 1.2, curve: 1.2, essential: true });
      }
    } catch {}

    setHits([]); setSel(-1);
  };

  // Sheet metrics (match your screenshot)
  const SHEET_W = 361;
  const MIN_H = 380;
  const MAX_H = 500;
  const MIN_TOP = 120; // leave headroom

  const reserve = kbGap > 0 ? kbGap : 0;
  let sheetH = Math.min(MAX_H, Math.max(MIN_H, vh - reserve - 32));
  const maxByTop = vh - reserve - MIN_TOP;
  if (sheetH > maxByTop) sheetH = Math.max(MIN_H, maxByTop);
  sheetH = Math.round(sheetH);

  const sheetW = Math.min(SHEET_W, vw - 28);
  const sheetLeft = Math.round((vw - sheetW) / 2);
  const bottom = reserve > 0 ? reserve + 8 : 12; // dock just above keyboard

  // Map init once
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return;
    let raf;
    const boot = () => {
      const el = mapEl.current;
      if (!el) return;
      if (el.clientWidth === 0 || el.clientHeight === 0) {
        raf = requestAnimationFrame(boot);
        return;
      }
      const init = (typeof mapSync?.get === 'function') ? (mapSync.get() || {}) : {};
      const initCenter = Array.isArray(init.center) ? init.center : [13.405, 52.52];
      const initZoom = (typeof init.zoom === 'number') ? init.zoom : 12.5;

      const map = new maplibregl.Map({
        container: el,
        style: STYLE_URL,
        center: initCenter,
        zoom: initZoom,
        attributionControl: false,
        hash: false,
        cooperativeGestures: true,
      });
      mapRef.current = map;

      const resizeSafely = () => { try { map.resize(); } catch {} };
      map.on("load", () => {
        resizeSafely();

        // Attach shared cover pins to this map using global seed
        try {
          if (createCoverPinsController && !pinsCtrlRef.current) {
            pinsCtrlRef.current = createCoverPinsController(map, {
              pauseMain: () => { try { window.__playerPause?.() ?? null } catch {} }, // oder via Context, wenn verfügbar
              resumeMain: () => { try { window.__playerPlay?.() ?? null } catch {} },
              playFull: (t) => { try { window.__playerPlayFull?.(t) } catch {} }
            });
            const s = (mapSync.get && mapSync.get()) || {};
            pinsCtrlRef.current.render({ center: map.getCenter().toArray(), seed: s.seed });
          }
        } catch {}

        const attrib = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
        if (attrib) {
          attrib.style.fontSize = "10px";
          attrib.style.opacity = "0.35";
          attrib.style.padding = "0 6px";
          attrib.style.pointerEvents = "none";
          attrib.style.userSelect = "none";
        }
        const logo = map.getContainer().querySelector(".maplibregl-ctrl-logo");
        if (logo) {
          logo.style.transform = "scale(0.8)";
          logo.style.opacity = "0.35";
          logo.tabIndex = -1;
          logo.style.pointerEvents = "none";
        }

        // Publish view changes with Echo-Guard
        const publishView = () => {
          try {
            if (isSyncingRef.current) { // Bewegung kam von remote flyTo -> nicht erneut senden
              isSyncingRef.current = false;
              return;
            }
            const c = map.getCenter().toArray();
            const z = map.getZoom();
            mapSync.setView(c, z, 'search');
          } catch {}
        };
        map.on('moveend', publishView);
        map.on('zoomend', publishView);

        // Subscribe to global sync (apply remote moves without echo)
        try {
          if (!unsubRef.current && typeof mapSync.subscribe === 'function') {
            unsubRef.current = mapSync.subscribe((type, payload, src) => {
              if (!map) return;
              if (src === 'search') return; // ignore own events
              if (type === 'view' && payload) {
                const { center, zoom } = payload;
                if (Array.isArray(center)) {
                  isSyncingRef.current = true; // mark as remote-driven
                  map.flyTo({
                    center,
                    zoom: (typeof zoom === 'number' ? zoom : map.getZoom()),
                    speed: 1.2, curve: 1.2, essential: true
                  });
                }
              } else if (type === 'seed') {
                try {
                  const s = (mapSync.get && mapSync.get()) || {};
                  pinsCtrlRef.current?.render({ center: map.getCenter().toArray(), seed: s.seed });
                } catch {}
              } else if (type === 'result' && payload?.lngLat) {
                try {
                  isSyncingRef.current = true; // remote navigate
                  map.flyTo({ center: payload.lngLat, zoom: 15, speed: 1.2, curve: 1.2, essential: true });
                } catch {}
              }
            });
          }
        } catch {}

        // Initial sync-to-result: jump to a previously selected destination if one exists
        try {
          const s0 = (mapSync.get && mapSync.get()) || {};
          if (Array.isArray(s0.result)) {
            isSyncingRef.current = true; // programmatic move -> don't echo
            map.flyTo({ center: s0.result, zoom: 15, speed: 1.2, curve: 1.2, essential: true });
          }
        } catch {}

        const rerenderPins = () => {
          try {
            const s = (mapSync.get && mapSync.get()) || {};
            pinsCtrlRef.current?.render({ center: map.getCenter().toArray(), seed: s.seed });
          } catch {}
        };
        map.on('moveend', rerenderPins);
        map.on('zoomend', rerenderPins);
      });

      map.on("styledata", resizeSafely);

      if (typeof ResizeObserver !== "undefined" && mapEl.current) {
        const ro = new ResizeObserver(() => resizeSafely());
        ro.observe(mapEl.current);
        map.__ro = ro;
      }

      return () => {
        try { pinsCtrlRef.current?.destroy?.(); } catch {}
        pinsCtrlRef.current = null;
        try { unsubRef.current?.(); } catch {}
        unsubRef.current = null;
        map.remove();
      };
    };
    raf = requestAnimationFrame(boot);
    return () => cancelAnimationFrame(raf);
  }, []);

  // keep map responsive to panel size changes
  useEffect(() => {
    if (!mapRef.current) return;
    const id = window.setTimeout(() => { try { mapRef.current?.resize(); } catch {} }, 180);
    return () => window.clearTimeout(id);
  }, [open, sheetW, sheetH, kbGap]);

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-none"
      style={{ height: "100svh", overflow: "hidden", contain: "layout size" }}
      aria-hidden={!open}
    >
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[8px] transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
        onClick={open ? onClose : undefined}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTransitionEnd={open ? focusPump : undefined}
        className="absolute rounded-[32px] overflow-hidden glass-40 transition-[transform,opacity] duration-200"
        style={{
          left: sheetLeft,
          width: sheetW,
          height: sheetH,
          bottom: bottom,
          transform: open ? "translateY(0)" : "translateY(20px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Destination search"
      >
        {/* Handle */}
        <button
          className="absolute top-2 left-1/2 -translate-x-1/2 z-20 h-9 w-28 flex items-center justify-center appearance-none bg-transparent border-0 outline-none ring-0 shadow-none"
          aria-label="Close"
          onClick={onClose}
        >
          <div className="h-1.5 w-16 rounded-full bg-white/75" />
        </button>

        {/* Map layer */}
        <div ref={mapEl} className="absolute inset-0 z-[0]" style={{ background: "#0b0f1e", minHeight: 1 }} />

        {/* Chips panel */}
        <div
          className="absolute glass rounded-[22px] text-white z-10 overflow-hidden"
          style={{ right: 18, bottom: 126, width: 106, height: 135, padding: 10 }}
        >
          <div className="flex items-center gap-2 h-[22px]"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#FFD54F' }} /><span className="text-[15px] leading-none">Work</span></div>
          <div className="flex items-center gap-2 h-[22px] mt-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#69F0AE' }} /><span className="text-[15px] leading-none">Home</span></div>
          <div className="flex items-center gap-2 h-[22px] mt-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#80DEEA' }} /><span className="text-[15px] leading-none">Fitness</span></div>
          <div className="flex items-center gap-2 h-[22px] mt-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#B0BEC5' }} /><span className="text-[15px] leading-none">Add one</span></div>
        </div>

        {/* Suggestions */}
        {open && hits.length > 0 && (
          <div
            className="absolute z-20 left-4"
            style={{ bottom: 76 }}
          >
            <div className="flex flex-col gap-2">
              {/* keep pins in sync while searching */}
              {(() => { try { mapSync.bumpSeed?.('search'); } catch {} return null; })()}
              {hits.slice(0, 5).map((f, i) => {
                const title = f?.place_name || f?.text || "Unknown";
                const active = i === sel;
                return (
                  <button
                    key={f.id || i}
                    onClick={() => selectHit(i)}
                    className={`glass rounded-[18px] h-[30px] w-[156px] px-2 text-left flex items-center ${active ? 'ring-1 ring-white/40' : ''}`}
                    style={{ lineHeight: '30px' }}
                  >
                    {/* Plain text lane (no marquee) – maximized inside 156px chip with 8px padding each side */}
                    <div className="flex-none overflow-hidden whitespace-nowrap" style={{ width: 140 }}>
                      <span className="text-[10px] text-white leading-none block">{title}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input row */}
        <div className="absolute flex items-center z-10" style={{ bottom: 14, left: 14, right: 14 }}>
          <label htmlFor="search-destination" className="sr-only">Where to?</label>
          <div className="h-[44px] rounded-[24px] glass px-5 flex items-center text-white" style={{ width: 269 }}>
            <input
              id="search-destination"
              ref={inputRef}
              autoFocus
              placeholder="Where to? …"
              className="bg-transparent outline-none w-full h-full placeholder-white/60"
              inputMode="search"
              enterKeyHint="go"
              autoComplete="off"
              autoCorrect="off"
              style={{ fontSize: 16 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min((hits.length-1), (s<0?0:s+1))); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s<=0?-1:s-1)); }
                else if (e.key === 'Enter') {
                  if (hits.length) {
                    e.preventDefault();
                    selectHit(sel>=0? sel : 0);
                  }
                }
              }}
            />
          </div>
          <div style={{ width: 11 }} />
          <button className="rounded-full glass active:scale-95 transition" style={{ width: 44, height: 44 }} aria-label="Action" />
        </div>
      </div>
    </div>
  );
}