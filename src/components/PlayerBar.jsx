// src/components/PlayerBar.jsx
import { useEffect, useRef, useState } from "react";
import { useTrack } from "../state/TrackContext";
import startIcon from "../icons/PlayerBar/start.svg";
import nowPlayingIcon from "../icons/nowPlaying.svg";
import skipIcon from "../icons/PlayerBar/skip.svg";
import volumeLowIcon from "../icons/volumeLow.svg";
import volumeHighIcon from "../icons/volumeHigh.svg";
import OverflowMarquee from "./OverflowMarquee";

// --- Crossfade image helper (opacity + light scale) ---
function CrossfadeImage({ src, className = "", duration = 1000, scaleFrom = 0.80 }) {
  const [curr, setCurr] = useState(src);
  const [prev, setPrev] = useState(null);
  const [enter, setEnter] = useState(false);

  useEffect(() => {
    if (!src) return;
    setPrev(curr);
    setCurr(src);
    setEnter(false);
    const id = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(id);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ contain: "paint" }}>
      {prev && (
        <img
          src={prev}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover will-change-[opacity,transform]"
          style={{ opacity: 1, transform: "scale(1.00)" }}
          draggable="false"
        />
      )}
      {curr && (
        <img
          key={curr}
          src={curr}
          alt=""
          className="absolute inset-0 w-full h-full object-cover will-change-[opacity,transform]"
          style={{
            opacity: enter ? 1 : 0,
            transform: enter ? "scale(1.00)" : `scale(${scaleFrom})`,
            transition: `opacity ${duration}ms cubic-bezier(0.2,0.8,0.2,1), transform ${duration}ms cubic-bezier(0.2,0.8,0.2,1)`,
          }}
          draggable="false"
        />
      )}
    </div>
  );
}

// --- Robust, queue-safe Dissolve + Light Scale helper ---
function DissolveScaleImage({ src, className = "", duration = 420, scaleFrom = 0.975 }) {
  // Robust, queue-safe dissolve + light-scale (works under rapid changes)
  const [visible, setVisible] = useState(src);      // currently shown image
  const [incoming, setIncoming] = useState(null);   // image being revealed
  const [enter, setEnter] = useState(false);        // drives CSS transitions
  const wrapRef = useRef(null);
  const animatingRef = useRef(false);               // true while transition runs
  const pendingRef = useRef(null);                  // queued src while animating
  const tokenRef = useRef(0);                       // guards async decode

  // Speckle mask (same look as vorher, nur zuverlässiger getriggert)
  const NOISE_SVG =
    "url('data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>
         <filter id='n'>
           <feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='1' stitchTiles='stitch'/>
           <feColorMatrix type='saturate' values='0'/>
         </filter>
         <rect width='32' height='32' filter='url(%23n)' />
       </svg>`
    ) + "')";

  const ease = "cubic-bezier(0.22, 0.61, 0.36, 1)";

  // Start/chain a transition; if eine läuft, queue sie
  const runTransition = (newSrc) => {
    if (animatingRef.current) {
      pendingRef.current = newSrc;
      return;
    }
    animatingRef.current = true;
    setIncoming(newSrc);
    setEnter(false);

    // Doppel-RAF + forced reflow → iOS/Safari feuert Transition sicher
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void wrapRef.current?.offsetHeight;
        setEnter(true);
        window.setTimeout(() => {
          setVisible(newSrc);
          setIncoming(null);
          setEnter(false);
          animatingRef.current = false;
          if (pendingRef.current && pendingRef.current !== newSrc) {
            const next = pendingRef.current;
            pendingRef.current = null;
            runTransition(next);
          }
        }, duration);
      });
    });
  };

  // Preload & starten (queue-safe, token-guarded)
  useEffect(() => {
    if (!src || src === visible || src === incoming) return;
    const my = ++tokenRef.current;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;

    const start = () => { if (tokenRef.current === my) runTransition(src); };
    if (img.decode) img.decode().then(start).catch(start); else { img.onload = start; img.onerror = start; }
  }, [src, visible, incoming, duration]);

  // Sichtbar/ausblend-Stile
  const outStyle = incoming ? {
    opacity: enter ? 0 : 1,
    transform: 'scale(1)'} : {};

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ contain: 'paint' }} ref={wrapRef}>
      {/* Alte Ebene (blendet aus, speckle) */}
      {visible && (
        <img
          src={visible}
          alt=""
          className="absolute inset-0 w-full h-full object-cover will-change-[opacity]"
          style={{
            ...outStyle,
            transition: incoming ? `opacity ${duration}ms ${ease}` : undefined,
            WebkitMaskImage: incoming ? NOISE_SVG : undefined,
            WebkitMaskRepeat: incoming ? 'repeat' : undefined,
            WebkitMaskSize: incoming ? (enter ? '8%' : '420%') : undefined,
          }}
          draggable="false"
        />
      )}

      {/* Neue Ebene (blendet ein, skaliert leicht, de-blur) */}
      {incoming && (
        <img
          key={incoming}
          src={incoming}
          alt=""
          className="absolute inset-0 w-full h-full object-cover will-change-[opacity,transform,filter]"
          style={{
            opacity: enter ? 1 : 0,
            transform: enter ? 'scale(1.00)' : `scale(${scaleFrom})`,
            filter: enter ? 'blur(0px)' : 'blur(6px)',
            transition: `opacity ${duration}ms ${ease}, transform ${duration}ms ${ease}, filter ${duration}ms ${ease}`,
            WebkitMaskImage: NOISE_SVG,
            WebkitMaskRepeat: 'repeat',
            WebkitMaskSize: enter ? '420%' : '8%',
          }}
          draggable="false"
        />
      )}
    </div>
  );
}

// ==== Layout-Konstanten (einfach anpassen) ====
// Icon style for skip/prev/next buttons (white, reduced opacity)
const ICON_STYLE = { opacity: 0.7 };
const SHEET_W = 361;
const SHEET_H = 720;
const SHEET_BOTTOM = 63;        // Abstand des Overlays vom unteren Rand (px)
const HIDE_OFFSET = 120;         // größerer Wegschub -> garantiert kein Peek
const CLOSE_THRESHOLD = 140;    // Drag-Strecke zum Schließen (px)
const ANIM_MS = 180;             // Slide-Dauer (ms)

const COVER_TOP = 44;
const COVER_BOTTOM_MARGIN = 384;
const COVER_H = SHEET_H - COVER_TOP - COVER_BOTTOM_MARGIN;

// Scrim dynamics (blur + darkness scale with drag/open progress)
const DRAG_FADE_RANGE = 320;     // px of drag to fully fade scrim
const SCRIM_MAX_DARK = 0.65;     // peak darkening at fully open
const SCRIM_MAX_BLUR_PX = 10;    // peak blur at fully open

export default function PlayerBar() {
  // Playlist-Index & aktueller Track
  // Aktueller Track & Navigation aus globalem Player-State
  const {
    track,
    isPlaying,
    time,
    duration,
    volume,
    setVolume,
    toggle,
    next,
    prev,
    seekSeconds,
  } = useTrack();

  // ======== AUDIO ========
  const [scrubbing, setScrubbing] = useState(false);
  const [volDragging, setVolDragging] = useState(false);

  // Track-Navigation
  

  // ======== OVERLAY ========
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false); // sanftes Slide-out

  // Drag-State (State + Ref, damit pointerup IMMER den letzten Wert hat)
  const [dragY, setDragY] = useState(0);
  const dragYRef = useRef(0);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);

  const triggerRef = useRef(null);
  const dialogRef = useRef(null);

  const progressRef = useRef(null);
  const volumeRef = useRef(null);
  // Volume drag helpers (pointer capture + safe cleanup)
  const volPointerIdRef = useRef(null);

  // Body-Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Fokus in Overlay / zurück
  useEffect(() => {
    if (open && dialogRef.current) {
      (dialogRef.current.querySelector("button,[href],[tabindex]:not([tabindex='-1'])") ||
        dialogRef.current
      ).focus();
    } else if (!open && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [open]);

  // ESC & Fokusfalle
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    const onKey = (e) => {
      if (e.key === "Escape") closeWithSlide();
      if (e.key !== "Tab") return;
      const nodes = el.querySelectorAll("button,[href],[tabindex]:not([tabindex='-1'])");
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // ======== AUDIO HANDLING (context) ========
  const togglePlay = () => {
    toggle();
  };

  const seekRelative = (deltaSec) => {
    const nextSec = Math.min(Math.max(0, (time || 0) + deltaSec), duration || 0);
    seekSeconds(nextSec);
  };

  const setProgressFromClientX = (clientX) => {
    const el = progressRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const target = ratio * (duration || 0);
    seekSeconds(target);
  };

  const setVolumeFromClientX = (clientX) => {
    const el = volumeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    setVolume(Number.isFinite(ratio) ? ratio : 0);
  };

  // ======== Drag-Scrub Progress ========
  const handleProgressPointerDown = (e) => {
    e.preventDefault();
    setScrubbing(true);
    setProgressFromClientX(e.clientX);
    const move = (ev) => { ev.preventDefault(); setProgressFromClientX(ev.clientX); };
    const up = () => {
      setScrubbing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up, { once: true });
  };
  const handleProgressTouchStart = (e) => {
    setScrubbing(true);
    setProgressFromClientX(e.touches[0].clientX);
    const move = (ev) => { ev.preventDefault(); setProgressFromClientX(ev.touches[0].clientX); };
    const end = () => {
      setScrubbing(false);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end, { once: true });
    window.addEventListener("touchcancel", end, { once: true });
  };

  // ======== Drag-Adjust Volume ========
  const handleVolumePointerDown = (e) => {
    // stop overlay drag and capture pointer for the volume control
    try { e.stopPropagation?.(); } catch {}
    e.preventDefault();

    setVolDragging(true);
    setVolumeFromClientX(e.clientX);

    const el = volumeRef.current || e.currentTarget;

    // Try pointer capture (best for desktops and modern browsers)
    try {
      if (typeof e.pointerId !== 'undefined' && el && el.setPointerCapture) {
        el.setPointerCapture(e.pointerId);
        volPointerIdRef.current = e.pointerId;
      }
    } catch (err) { /* ignore */ }

    const move = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setVolumeFromClientX(ev.clientX);
    };

    const up = (ev) => {
      try { ev.preventDefault(); ev.stopPropagation(); } catch {}
      setVolDragging(false);

      // release pointer capture if we set it
      try {
        if (volPointerIdRef.current && el && el.releasePointerCapture) {
          el.releasePointerCapture(volPointerIdRef.current);
        }
      } catch (err) { /* ignore */ }
      volPointerIdRef.current = null;

      // cleanup listeners attached to element
      try {
        if (el) {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
        } else {
          window.removeEventListener('pointermove', move, true);
          window.removeEventListener('pointerup', up, true);
        }
      } catch (err) {}
    };

    // Attach event listeners to element (pointer capture guarantees delivery even if pointer leaves)
    try {
      if (el) {
        el.addEventListener('pointermove', move, { passive: false });
        el.addEventListener('pointerup', up, { once: true, passive: false });
        el.addEventListener('pointercancel', up, { once: true, passive: false });
      } else {
        window.addEventListener('pointermove', move, { passive: false, capture: true });
        window.addEventListener('pointerup', up, { once: true, capture: true });
      }
    } catch (err) {
      // fallback: global listeners
      window.addEventListener('pointermove', move, { passive: false, capture: true });
      window.addEventListener('pointerup', up, { once: true, capture: true });
    }
  };

  const handleVolumeTouchStart = (e) => {
    try { e.stopPropagation?.(); } catch {}
    setVolDragging(true);
    setVolumeFromClientX(e.touches[0].clientX);

    const move = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setVolumeFromClientX(ev.touches[0].clientX);
    };
    const end = (ev) => {
      try { ev.preventDefault(); ev.stopPropagation(); } catch {}
      setVolDragging(false);
      try {
        window.removeEventListener('touchmove', move, true);
      } catch (err) {}
    };

    window.addEventListener('touchmove', move, { passive: false, capture: true });
    window.addEventListener('touchend', end, { once: true, capture: true });
    window.addEventListener('touchcancel', end, { once: true, capture: true });
  };

  // ========== Drag-to-close ==========
  const onPointerDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    setDragY(0); dragYRef.current = 0;
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { once: true });
    window.addEventListener("pointercancel", onPointerUp, { once: true });
  };
  const onPointerMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const dy = Math.max(0, e.clientY - dragStartY.current);
    dragYRef.current = dy;
    setDragY(dy);
  };
  const onPointerUp = () => {
    isDragging.current = false;
    window.removeEventListener("pointermove", onPointerMove);
    if (dragYRef.current > CLOSE_THRESHOLD) {
      closeWithSlide();               // ← sanft schließen
    }
    setDragY(0); 
    dragYRef.current = 0;             // ← FIX: nicht 5!
  };

  // Touch-Fallback (iOS)
  const onTouchStart = (e) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    setDragY(0); dragYRef.current = 0;
  };
  const onTouchMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const dy = Math.max(0, e.touches[0].clientY - dragStartY.current);
    dragYRef.current = dy;
    setDragY(dy);
  };
  const onTouchEnd = () => {
    isDragging.current = false;
    if (dragYRef.current > CLOSE_THRESHOLD) {
      closeWithSlide();               // ← sanft schließen
    }
    setDragY(0); dragYRef.current = 0;
  };

  // sanftes Slide-out (80ms), dann verstecken
  const closeWithSlide = () => {
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, ANIM_MS);
  };

  const openOrClosing = open || closing;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  // 0 = closed, 1 = fully open. While dragging down, value eases toward 0
  const openT = open
    ? (closing ? 0 : 1 - clamp01(dragY / DRAG_FADE_RANGE))
    : 0;

  const onTriggerKey = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
  };

  // Fortschritt (%), sicher gegen 0/NaN
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, ((time || 0) / duration) * 100)) : 0;

  return (
    <>

      {/* ==== MINI-PLAYER (Trigger) ==== */}
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-controls="player-sheet"
        aria-expanded={open}
        aria-label="Now playing"
        onClick={() => setOpen(true)}
        onKeyDown={onTriggerKey}
        className={[
  "fixed left-1/2 -translate-x-1/2 w-[min(361px,calc(100vw-32px))] h-[79px] rounded-[36px]",
  "glass px-4 flex items-center text-white z-30 focus:outline-none focus-visible:outline-none",
  (open && !closing) ? "pointer-events-none opacity-0 scale-[0.98]" : "opacity-100 scale-100",
  "transition-[opacity,transform] duration-[80ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
  "motion-reduce:transition-none",
  "border border-white/20",
].join(" ")}
        style={{
  bottom: "max(0px, calc(63px - env(safe-area-inset-bottom)))", borderWidth: "0.5px" }}
      >
        {/* Mini progress background (very subtle) */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[36px] z-0 overflow-hidden"
          aria-hidden
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${progressPct}%`,
              background: 'rgba(255,255,255,0.04)',
              transition: 'width 160ms linear',
            }}
          />
        </div>
        {/* Cover 56×56, r=22 (dissolve+scale) */}
        <DissolveScaleImage
          src={track.cover}
          duration={420}
          scaleFrom={0.975}
          className="w-[56px] h-[56px] rounded-[22px] mr-3 select-none"
        />

        {/* Titel / Artist mit sanftem Fade + Auto-Scroll */}
        <div
          className="min-w-0 mr-4"
          style={{ width: "calc(100% - 56px - 12px - 44px - 8px - 44px - 8px)" }}
        >
          <OverflowMarquee
            text={track.title}
            className="text-[16px] leading-tight font-black"
            fade={24}
            speed={40}
            pause={1200}
          />
          <OverflowMarquee
            text={track.artist}
            className="text-[12px] font-medium opacity-70 mt-0.5"
            fade={18}
            speed={36}
            pause={1000}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Play – 44×44 Touch; Icon 33×36; right 81.99px */}
        <button
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="absolute top-1/2 -translate-y-1/2 right-[81.99px] w-[44px] h-[44px] bg-transparent flex items-center justify-center overflow-visible active:scale-95 transition focus:outline-none focus:ring-0"
        >
          <img
            src={isPlaying ? nowPlayingIcon : startIcon}
            alt=""
            className="block pointer-events-none select-none max-w-none"
            style={{ width: "33px", height: "36px" }}
            draggable="false"
          />
        </button>

        {/* Skip – 44×44 Touch; Icon 43×24; right 18.42px */}
        <button
          aria-label="Next"
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute top-1/2 -translate-y-1/2 right-[18.42px] w-[44px] h-[44px] bg-transparent flex items-center justify-center overflow-visible active:scale-95 transition focus:outline-none focus:ring-0"
        >
          <img
            src={skipIcon}
            alt=""
            className="block pointer-events-none select-none max-w-none"
            style={{ width: "43px", height: "24px", ...ICON_STYLE }}
            draggable="false"
          />
        </button>
      </div>

      {/* ==== SCRIM (konstant dunkel, kein Flicker) ==== */}
      <div
        className="fixed inset-0 z-40 transition-[opacity,backdrop-filter] duration-[160ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        style={{
          background: `rgba(0,0,0,${SCRIM_MAX_DARK})`,
          backdropFilter: `blur(${SCRIM_MAX_BLUR_PX * openT}px)`,
          WebkitBackdropFilter: `blur(${SCRIM_MAX_BLUR_PX * openT}px)`,
          opacity: openT,
          pointerEvents: openOrClosing ? 'auto' : 'none',
        }}
        onClick={closeWithSlide}
        aria-hidden
      />

      {/* ==== OVERLAY SHEET ==== */}
      <div
        id="player-sheet"
        ref={dialogRef}
        className="fixed z-50 left-1/2 -translate-x-1/2 outline-none"
        style={{
          width: SHEET_W,
          height: SHEET_H,
          bottom: SHEET_BOTTOM,                             // Position anpassbar
          pointerEvents: closing ? "none" : (open ? "auto" : "none"),
          visibility: openOrClosing ? "visible" : "hidden",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Now playing sheet"
      >
        <div
          className="
            relative w-full h-full rounded-[36px] glass-40 text-white
            shadow-[0_20px_80px_rgba(0,0,0,0.6)]
            transition-transform duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
            motion-reduce:transition-none will-change-transform overscroll-contain
          "
          style={{
            transform: closing
              ? `translateY(calc(100% + ${HIDE_OFFSET}px))`  // sanft nach unten beim Schließen
              : open
              ? `translateY(${dragY}px)`                      // Live-Drag
              : `translateY(calc(100% + ${HIDE_OFFSET}px))`,  // vollständig versteckt
            opacity: openOrClosing ? 1 : 0,                   // kein Peek wenn zu
            touchAction: "none",                              // verhindert Scroll-Konflikte
          }}
        >
          {/* Drag-Zone: bis Unterkante Cover (+24px), liegt ÜBER dem Cover */}
          <div
            className="absolute left-0 right-0 z-10 cursor-grab active:cursor-grabbing"
            style={{ top: 0, height: COVER_TOP + COVER_H + 24, touchAction: "none" }}
            onPointerDown={onPointerDown}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
          {/* Handle */}
          <div className="absolute left-1/2 -translate-x-1/2 top-[12px] h-1.5 w-12 rounded-full bg-white/30 pointer-events-none" />

          {/* Cover – mit Apple-Shadow */}
          <div
            className="absolute"
            style={{ left: 36, right: 36, top: COVER_TOP, height: COVER_H }}
          >
            <DissolveScaleImage
              src={track.cover}
              duration={520}
              scaleFrom={0.98}
              className="w-full h-full rounded-[28px] shadow-apple select-none"
            />
          </div>

          {/* Textblock – 47px Ränder */}
          <div className="absolute" style={{ left: 47, right: 47, top: COVER_TOP + COVER_H + 24 }}>
            <h2 className="text-[20px] font-black leading-tight">{track.title}</h2>
            <p className="text-[14px] font-medium text-white/70">{track.artist}</p>
          </div>

          {/* Progress – larger touch target (32px) with slim visual track */}
          <div className="absolute" style={{ width: 265, left: "50%", transform: "translateX(-50%)", bottom: 267 }}>
            <div
              ref={progressRef}
              className="relative w-full cursor-pointer"
              style={{ height: 32, touchAction: "none" }}
              onPointerDown={handleProgressPointerDown}
              onTouchStart={handleProgressTouchStart}
            >
              {/* visual track, centered inside hit-area */}
              <div
                className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full bg-white/50 overflow-hidden transition-[height] duration-150"
                style={{ height: scrubbing ? 12 : 8 }}
              >
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{
                    width: `${progressPct}%`,
                    background: scrubbing ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.45)',
                    boxShadow: scrubbing ? '0 0 10px rgba(255,255,255,0.35)' : 'none',
                    transition: scrubbing
                      ? 'background-color 120ms ease, box-shadow 120ms ease'
                      : 'width 120ms linear, background-color 160ms ease, box-shadow 160ms ease',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Controls – centered Play, symmetric skip buttons */}
          <div
            className="absolute left-0 right-0 grid"
            style={{ bottom: 168, paddingLeft: 56, paddingRight: 56, gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}
          >
            <button
              className="bg-transparent focus:outline-none focus:ring-0 justify-self-start"
              aria-label="Previous track"
              onClick={prev}
            >
              <img
                src={skipIcon}
                alt=""
                style={{ width: 43, height: 24, transform: 'scaleX(-1)', ...ICON_STYLE }}
                className="select-none"
              />
            </button>

            <button
              className="bg-transparent focus:outline-none focus:ring-0 justify-self-center"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={togglePlay}
            >
              <img
                src={isPlaying ? nowPlayingIcon : startIcon}
                alt=""
                style={{ width: 44, height: 44 }}
                className="select-none"
              />
            </button>

            <button
              className="bg-transparent focus:outline-none focus:ring-0 justify-self-end"
              aria-label="Next track"
              onClick={next}
            >
              <img
                src={skipIcon}
                alt=""
                style={{ width: 43, height: 24, ...ICON_STYLE }}
                className="select-none"
              />
            </button>
          </div>

          {/* Volume – larger touch target (32px) with slim visual track */}
          <div className="absolute flex items-center gap-3" style={{ width: 270, left: "50%", transform: "translateX(-50%)", bottom: 96 }}>
            <img src={volumeLowIcon} alt="" className="block select-none" style={{ width: 20, height: 20 }} />

            <div
              ref={volumeRef}
              className="flex-1 relative cursor-pointer"
              style={{ height: 32, touchAction: "none", position: "relative", zIndex: 40 }}
              onPointerDown={handleVolumePointerDown}
              onTouchStart={handleVolumeTouchStart}
            >
              {/* visual bar */}
              <div
                className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full bg-white/30 overflow-hidden transition-[height] duration-150"
                style={{ height: volDragging ? 12 : 8 }}
              >
                <div
                  className="absolute rounded-full left-0 top-0 h-full bg-white"
                  style={{
                    width: `${Math.round(volume * 100)}%`,
                    background: volDragging ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.45)',
                    boxShadow: volDragging ? '0 0 10px rgba(255,255,255,0.35)' : 'none',
                    transition: volDragging
                      ? 'background-color 120ms ease, box-shadow 120ms ease'
                      : 'width 120ms linear, background-color 160ms ease, box-shadow 160ms ease',
                  }}
                />
              </div>
            </div>

            <img src={volumeHighIcon} alt="" className="block select-none" style={{ width: 20, height: 20 }} />
          </div>
        </div>
      </div>
    </>
  );
}