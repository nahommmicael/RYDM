import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { allTracks } from "../data/tracks";
import { useTrack } from "../state/TrackContext";
import { mapSync } from "../state/mapSync";
import { createCoverPinsController } from "../map/coverPins";

// MapTiler (dark) style
const STYLE_URL =
  "https://api.maptiler.com/maps/streets-v2-dark/style.json?key=URc1I3H0eEg0FixHIF0J";

// === Glass & Mask Config (tweakable) ===
const GLASS_BLUR_PX = 6;      // Stärke der Unschärfe (px) im collapsed Zustand
const GLASS_WHITE_TINT = 0.06; // Deckkraft des weißen Schleiers auf der Glasfläche (0..1)
const RADIAL_MASK = "radial-gradient(circle at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 100%)"; // nur für die Karte (collapsed)

export default function MapCard() {
  const [open, setOpen] = useState(false);

  const { setIndex, play, pause, isPlaying, playlist } = useTrack();
  const refreshLockRef = useRef(false);     // blocks pin refresh while interacting
  const lastCenterRef = useRef(null);       // last map center for movement threshold

  // Design-Tokens
  const RADIUS = 36;
  const W = 361;
  const H_COLLAPSED = 395;
  const H_EXPANDED = 480; // anpassbar
  const MAPCARD_TOP = 181; // fixed distance from top edge to map start

  // Drag handling (nur zum Schließen, wenn expanded)
  const dragY = useMotionValue(0);
  const dragThreshold = 80;
  const isDragging = useRef(false);
  const startYRef = useRef(null);

  // Map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const pinsRef = useRef(null);
  const sourceId = "mapcard";
  const userMarkerRef = useRef(null);
  const watchIdRef = useRef(null);
  const followRef = useRef(true);      // automatisch meiner Position folgen
  const lastPosRef = useRef(null);     // letzte bekannte Position
  const isSyncingRef = useRef(false);   // unterdrückt Re-Publish, wenn View von anderer Map kommt


  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // Haversine: approximate distance in meters between [lng,lat]
  function metersBetween(a, b) {
    if (!a || !b) return Infinity;
    const toRad = Math.PI / 180, R = 6371000;
    const [lng1, lat1] = a, [lng2, lat2] = b;
    const dLat = (lat2 - lat1) * toRad;
    const dLng = (lng2 - lng1) * toRad;
    const x = Math.sin(dLat/2)**2 + Math.cos(lat1*toRad) * Math.cos(lat2*toRad) * Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }



  // Initialisiere MapLibre nur einmal
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initial = mapSync.get();
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: STYLE_URL,
      center: initial.center,
      zoom: initial.zoom,
      attributionControl: false, // wir stylen Attribution selbst
      hash: false,
      cooperativeGestures: true,
    });
    mapRef.current = map;

    map.on("load", () => {
      // Cover pins controller (shared deterministic pins via global seed)
      pinsRef.current = createCoverPinsController(map, {
        pauseMain: () => { try { pause(); } catch {} },
        resumeMain: () => { try { play().catch(() => {}); } catch {} },
        isMainPlaying: () => !!isPlaying,
        playFull: (t) => {
          try {
            const list = Array.isArray(playlist) ? playlist : [];
            const idx = list.findIndex((x) => x.id === t.id);
            if (idx >= 0) {
              setIndex(idx);
              play().catch(() => {});
            }
          } catch {}
        },
        getTracks: () => (Array.isArray(playlist) ? playlist : []),
      });
      const initState = mapSync.get();
      pinsRef.current.render({ center: initState.center, seed: initState.seed, radius: 800, count: 5 });

      // Tame default interactions that clash with pin gestures
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      map.touchZoomRotate.disableRotation();

      // Attribution/Logo sehr dezent
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
        logo && (logo.tabIndex = -1);
        logo.style.pointerEvents = "none";
      }

      // Interaktionen beenden das automatische Folgen
      map.on("dragstart", () => { followRef.current = false; });
      map.on("zoomstart", () => { followRef.current = false; });
      map.on("rotatestart", () => { followRef.current = false; });

      // Kontinuierlich Position beobachten
      if ("geolocation" in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          ({ coords }) => {
            const lngLat = [coords.longitude, coords.latitude];
            lastPosRef.current = lngLat;

            // Marker erzeugen/aktualisieren (roter Pin)
            if (!userMarkerRef.current) {
              const el = document.createElement("div");
              el.style.width = "28px";
              el.style.height = "36px";
              el.style.transform = "translateY(-2px)";
              el.style.filter = "drop-shadow(0 6px 10px rgba(0,0,0,0.45))";
              el.innerHTML = `
                <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 35c5.8-8.4 13-14 13-22A13 13 0 1 0 1 13c0 8 7.2 13.6 13 22Z" fill="#E53935"/>
                  <circle cx="14" cy="13" r="4.5" fill="#211" fill-opacity="0.4"/>
                </svg>`;
              userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" });
            }
            userMarkerRef.current.setLngLat(lngLat).addTo(map);

            // Karte zentrieren, solange Follow aktiv ist
            if (followRef.current) {
              map.easeTo({ center: lngLat, zoom: 16.5, duration: 600 });
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
        );
      }

      // Seed pins and remember initial center
      lastCenterRef.current = map.getCenter().toArray();
      const debouncedRefresh = debounce(() => {
        const now = map.getCenter().toArray();
        if (metersBetween(lastCenterRef.current, now) < 100) return; // ignore tiny moves
        mapSync.bumpSeed(sourceId); // trigger identical re-render on both maps
        lastCenterRef.current = now;
      }, 120);
      map.on('moveend', debouncedRefresh);
      map.on('zoomend', debouncedRefresh);

      map.on('moveend', () => {
        const m = map;
        // Always re-render pins at the new center using the current global seed –
        // this keeps pins visible/synced even if the seed did not change.
        try {
          const centerNow = m.getCenter().toArray();
          const currentSeed = mapSync.get().seed;
          pinsRef.current?.render({ center: centerNow, seed: currentSeed, radius: 800, count: 5 });
        } catch {}

        // If this movement was triggered by the other map, consume the sync and
        // do not echo back another view event.
        if (isSyncingRef.current) {
          isSyncingRef.current = false;
          return;
        }
        // User-initiated movement → publish view to the bus so the other map follows.
        try {
          const c = m.getCenter().toArray();
          const z = m.getZoom();
          mapSync.setView(c, z, sourceId);
        } catch {}
      });
    });

    const unsubscribe = mapSync.subscribe((type, payload, src) => {
      if (src === sourceId) return; // ignore own events
      const m = mapRef.current;
      if (!m) return;
      if (type === 'view') {
        const { center, zoom } = payload;
        // Markiere, dass das folgende moveend von einem Sync kommt
        isSyncingRef.current = true;
        m.flyTo({ center, zoom, essential: true, speed: 1.2, curve: 1.2 });
      } else if (type === 'result') {
        const { lngLat } = payload;
        isSyncingRef.current = true;
        m.flyTo({ center: lngLat, zoom: 15, essential: true, speed: 1.2, curve: 1.2 });
      } else if (type === 'seed') {
        const s = mapSync.get();
        pinsRef.current?.render({ center: s.center, seed: s.seed, radius: 800, count: 5 });
      }
    });

    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      try { pinsRef.current?.destroy?.(); } catch {}
      unsubscribe?.();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Effect: main play always cancels preview
  useEffect(() => {
    if (isPlaying) { try { pinsRef.current?.stopPreview?.(); } catch {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Bei Größenwechsel (expand/collapse) die Karte resizen
  useEffect(() => {
    const id = window.setTimeout(() => mapRef.current?.resize(), 220);
    return () => window.clearTimeout(id);
  }, [open]);

  // Reset dragY wenn wieder geschlossen
  if (!open && dragY.get() !== 0) dragY.set(0);

  // User-Position anfahren + Follow wieder aktivieren
  const locateMe = () => {
    if (!mapRef.current || !navigator.geolocation) return;
    followRef.current = true; // erneut an Position koppeln

    const map = mapRef.current;
    if (lastPosRef.current) {
      map.easeTo({ center: lastPosRef.current, zoom: 16.5, duration: 600 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lngLat = [coords.longitude, coords.latitude];
        lastPosRef.current = lngLat;
        if (!userMarkerRef.current) {
          const el = document.createElement("div");
          el.style.width = "28px";
          el.style.height = "36px";
          el.style.transform = "translateY(-2px)";
          el.style.filter = "drop-shadow(0 6px 10px rgba(0,0,0,0.45))";
          el.innerHTML = `
            <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 35c5.8-8.4 13-14 13-22A13 13 0 1 0 1 13c0 8 7.2 13.6 13 22Z" fill="#E53935"/>
              <circle cx="14" cy="13" r="4.5" fill="#211" fill-opacity="0.4"/>
            </svg>`;
          userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" });
        }
        userMarkerRef.current.setLngLat(lngLat).addTo(map);
        map.easeTo({ center: lngLat, zoom: 16.5, duration: 600 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );
  };

  return (
    <motion.div
      className="absolute left-[16px] z-10 border-white/20 border-[0.5px] shadow-[0_10px_60px_rgba(0,0,0,0.35)]"
      style={{
        top: MAPCARD_TOP,
        overflow: "hidden",
        borderRadius: RADIUS,
        y: 0,
        touchAction: "auto",
        userSelect: "none",
      }}
      initial={false}
      animate={open ? "expanded" : "collapsed"}
      variants={{
        collapsed: { width: W, height: H_COLLAPSED },
        expanded: { width: W, height: H_EXPANDED },
      }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      onClick={() => {
        if (!open && !isDragging.current) setOpen(true);
      }}
      role="button"
      aria-pressed={open}
      aria-label="Toggle map size"
    >
      {/* Drag-Handle (Tap to close) */}
      {open && (
        <button
          aria-label="Close map"
          onClick={() => setOpen(false)}
          className="absolute top-[10px] left-1/2 -translate-x-1/2 z-30 w-22 h-8 flex items-center justify-center rounded-full"
          style={{ background: "transparent" }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="w-16 h-1.5 rounded-full bg-white/70 pointer-events-none" />
        </button>
      )}

      {/* Light backdrop blur only in collapsed state (≈12px) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        variants={{
          collapsed: { opacity: 1 },
          expanded: { opacity: 0 },
        }}
        transition={{ duration: 0.22 }}
        style={{
          backdropFilter: open ? "none" : `blur(${GLASS_BLUR_PX}px)`,
          WebkitBackdropFilter: open ? "none" : `blur(${GLASS_BLUR_PX}px)`,
        }}
      />

      {/* White glass tint belongs to glass layer (unmasked) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        variants={{ collapsed: { opacity: 1 }, expanded: { opacity: 0 } }}
        transition={{ duration: 0.22 }}
        style={{ background: `rgba(255,255,255,${GLASS_WHITE_TINT})` }}
      />

      {/* Radiale Maske nur im collapsed Zustand */}
      <motion.div
        className="absolute inset-0"
        variants={{
          collapsed: { opacity: 0.6, scale: 1.0, pointerEvents: "none" },
          expanded: { opacity: 1, scale: 1.0, pointerEvents: "auto" },
        }}
        transition={{ duration: 0.22 }}
      >
        {/* Masked map-only wrapper */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: open ? "none" : RADIAL_MASK,
            maskImage: open ? "none" : RADIAL_MASK,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
          }}
        >
          {/* Map container (masked only) */}
          <div ref={mapContainerRef} className="w-full h-full" style={{ border: 0 }} />
        </div>

        {/* Locate-Me Button bleibt unmaskiert */}
        {open && (
          <button
            aria-label="Locate me"
            onClick={(e) => {
              e.stopPropagation();
              locateMe();
            }}
            className="absolute right-3 top-6 z-30 w-11 h-11 rounded-[36px] bg-white/10 backdrop-blur-md border-white/20 border-[0.5px] flex items-center justify-center active:scale-95 transition"
            style={{ pointerEvents: "auto" }}
          >
            <svg
              className="block w-[calc(100%_-_6px)] h-[calc(100%_-_6px)]"
              viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 4v2m0 12v2m8-8h-2M6 12H4m12 0a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="12" cy="12" r="2.8" fill="white" />
            </svg>
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}