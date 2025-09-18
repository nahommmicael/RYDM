// src/components/Backdrop.jsx
import { useEffect, useRef, useState } from "react";
import { useTrack } from "../state/TrackContext";

/**
 * Backdrop – exakt der BG-Effekt aus Home.DissolveBg, aber als globale, wiederverwendbare Komponente.
 * - Preload + forced reflow => Transition triggert zuverlässig (auch iOS PWA)
 * - Zwei Layer mit Overscan-Bleed, Overlay fade+scale-in
 * - Optionaler Gradient oben drauf wie im Home-Design
 */
export default function Backdrop({
  duration = 720,      // wie Home
  scaleFrom = 1.03,    // leicht zu groß gegen Kanten (du kannst z.B. 0.965 für kleiner->größer fahren)
  overscanPct = 0.03,  // 3% Bleed
  height = 631,        // Höhe des Hero-Bereichs
  showGradient = true, // gleich wie in Home
}) {
  const { track } = useTrack();
  const src = track?.cover || "";

  // ===== robust state for rapid changes (queue) =====
  const [visible, setVisible] = useState(src); // current image
  const [incoming, setIncoming] = useState(null); // image being faded in
  const [enter, setEnter] = useState(false); // drives CSS transitions
  const wrapRef = useRef(null);
  const animatingRef = useRef(false); // true while transition runs
  const pendingRef = useRef(null); // next cover while animating
  const tokenRef = useRef(0); // guards async image decode

  // helper to actually run the transition (queued if one is running)
  const runTransition = (newSrc) => {
    // If a transition is running, queue and exit
    if (animatingRef.current) {
      pendingRef.current = newSrc;
      return;
    }
    animatingRef.current = true;
    setIncoming(newSrc);
    setEnter(false);
    // double RAF for Safari/iOS reliability, then force reflow
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void wrapRef.current?.offsetHeight;
        setEnter(true);
        // finalize after duration
        window.setTimeout(() => {
          setVisible(newSrc);
          setIncoming(null);
          setEnter(false);
          animatingRef.current = false;
          // chain next if queued
          if (pendingRef.current && pendingRef.current !== newSrc) {
            const next = pendingRef.current;
            pendingRef.current = null;
            runTransition(next);
          }
        }, duration);
      });
    });
  };

  // preload & queue-safe effect
  useEffect(() => {
    if (!src || src === visible || src === incoming) return;

    const myToken = ++tokenRef.current;
    const img = new Image();
    img.decoding = "async";
    img.src = src;

    const start = () => {
      // ignore stale decodes
      if (tokenRef.current !== myToken) return;
      runTransition(src);
    };

    if (img.decode) {
      img.decode().then(start).catch(start);
    } else {
      img.onload = start;
      img.onerror = start;
    }

    // no cleanup needed beyond token guard
  }, [src, visible, incoming, duration]);

  const reduce = typeof window !== "undefined"
    && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = "cubic-bezier(0.25,0.1,0.25,1)"; // wie Home
  const bleed = `${Math.max(0, overscanPct) * 100}%`;


  return (
    <div
  className="absolute inset-x-0 top-0 z-0 pointer-events-none overflow-hidden"
  style={{ height }}
  ref={wrapRef}
  aria-hidden
>
      {/* Basisschicht */}
      {visible && (
        <div
          key={`vis-wrap-${visible}`}
          className="absolute"
          style={{ left: `-${bleed}`, right: `-${bleed}`, top: `-${bleed}`, bottom: `-${bleed}` }}
        >
          <img
            src={visible}
            alt=""
            className="w-full h-full object-cover"
            style={{ display: "block", backfaceVisibility: "hidden", transform: "translateZ(0)" }}
          />
        </div>
      )}

      {/* Overlay, fade/scale in – exakt wie in Home.DissolveBg */}
      {incoming && (
        <div
          key={`inc-wrap-${incoming}`}
          className="absolute will-change-[opacity,transform]"
          style={reduce ? {
            left: `-${bleed}`, right: `-${bleed}`, top: `-${bleed}`, bottom: `-${bleed}`,
            opacity: enter ? 1 : 0,
            transform: "scale(1.0)",
          } : {
            left: `-${bleed}`, right: `-${bleed}`, top: `-${bleed}`, bottom: `-${bleed}`,
            opacity: enter ? 1 : 0,
            transform: enter ? "scale(1.0)" : `scale(${scaleFrom})`,
            transition: `opacity ${duration}ms ${ease}, transform ${duration}ms ${ease}`,
            backfaceVisibility: "hidden",
            transformOrigin: "50% 50%",
          }}
        >
          <img
            src={incoming}
            alt=""
            className="w-full h-full object-cover"
            style={{ display: "block", backfaceVisibility: "hidden", transform: "translateZ(0)" }}
          />
        </div>
      )}

      {/* Gradient wie im Home-Hintergrund */}
      {showGradient && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(to bottom, rgba(28,28,30,0.40) 7%, rgba(0,0,0,1) 86%)",
          }}
        />
      )}
    </div>
  );
}
