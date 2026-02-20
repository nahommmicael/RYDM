import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * OverflowMarquee
 * - Fades edges (via overlay) und scrollt ping-pong nur bei Overflow.
 * Props:
 *   text: string
 *   className: container styles (height/typography)
 *   fade = 24 (px weiche Kante)
 *   speed = 40 (px/s)
 *   pause = 1200 (ms zwischen Richtungswechseln)
 */
export default function OverflowMarquee({
  text,
  className = "",
  fade = 20,
  speed = 5,
  startPause = 3000,
  endPause = 1500,
  slotCh = 10,
  slotPx,
  endPad = 12,
  returnMs = 220,     // Dauer der schnellen, aber soften Rückfahrt (ms)
  leftInset = -25,     // px: Abstand ab linker Kante, ab dem die linke Fade beginnt (zwischen Cover & Text)
}) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);
  const [overflow, setOverflow] = useState(false);
  const offsetRef = useRef(0);        // aktuelle X-Position (negativ beim Scrollen)
  const maxShiftRef = useRef(0);      // max. negativer Shift (scrollWidth - clientWidth)
  const phaseRef = useRef("idle");    // "idle" | "startPause" | "scroll" | "endPause"
  const rafRef = useRef(0);

  const retStartTsRef = useRef(0);
  const retStartXRef = useRef(0);

  const wrapWRef = useRef(0);
  const textWRef = useRef(0);

  const speedRef = useRef(speed);
  const startPauseRef = useRef(startPause);
  const endPauseRef = useRef(endPause);

  useEffect(() => { speedRef.current = Number(speed) || 0; }, [speed]);
  useEffect(() => { startPauseRef.current = Number(startPause) || 0; }, [startPause]);
  useEffect(() => { endPauseRef.current = Number(endPause) || 0; }, [endPause]);

  // Messen + beobachten (ResizeObserver + Fonts), damit maxShift immer stimmt
  useLayoutEffect(() => {
    const w = wrapRef.current;
    const t = textRef.current;
    if (!w || !t) return;

    const measure = () => {
      // forced reflow to get accurate sizes after style changes
      const wrapW = w.clientWidth;
      const textW = t.scrollWidth;
      wrapWRef.current = wrapW;
      textWRef.current = textW;
      const hasOverflow = textW > wrapW + 1;
      setOverflow(hasOverflow);
      offsetRef.current = 0;
      maxShiftRef.current = Math.max(0, textW - wrapW + (hasOverflow ? endPad : 0));
      phaseRef.current = "idle";
      // Startzustand: rechter Fade, links erst ab leftInset einblenden
      const maskRightOnlyInset = `linear-gradient(90deg, transparent 0, transparent ${leftInset}px, #000 ${leftInset + fade}px, #000 calc(100% - ${fade}px), transparent 100%)`;
      w.style.webkitMaskImage = hasOverflow ? maskRightOnlyInset : "";
      w.style.maskImage = hasOverflow ? maskRightOnlyInset : "";
      t.style.transform = `translateX(0px)`;
    };

    // Initial messen nach einem Frame (Fonts/Layout)
    requestAnimationFrame(measure);
    // Font ready (Safari/Chrome)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => requestAnimationFrame(measure)).catch(() => {});
    }

    // Resize beobachten
    const ro = new ResizeObserver(() => measure());
    ro.observe(w);
    ro.observe(t);

    return () => ro.disconnect();
  }, [text, fade, endPad, leftInset]);

  // Apple-like: langsam nach links scrollen, am Ende pausieren, dann SNAP zurück und wieder Start-Pause
  useEffect(() => {
    if (!overflow) return; // keine Animation nötig

    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReduced) return;

    const w = wrapRef.current;
    const t = textRef.current;
    if (!w || !t) return;

    let last = 0;
    let pauseUntil = 0;

    const maskBoth = () => `linear-gradient(90deg, transparent 0, transparent ${leftInset}px, #000 ${leftInset + fade}px, #000 calc(100% - ${fade}px), transparent 100%)`;
    const maskRightOnly = () => `linear-gradient(90deg, transparent 0, transparent ${leftInset}px, #000 ${leftInset + fade}px, #000 calc(100% - ${fade}px), transparent 100%)`;

    const step = (ts) => {
      if (!last) last = ts;
      const dt = (ts - last) / 1000; // Sekunden
      last = ts;

      if (ts < pauseUntil) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const maxShift = maxShiftRef.current;
      let x = offsetRef.current;

      if (phaseRef.current === "startPause") {
        // Wechsel in Scroll
        phaseRef.current = "scroll";
        // Fades: beim Scrollen links auch weich ausblenden
        w.style.webkitMaskImage = maskBoth();
        w.style.maskImage = maskBoth();
      }

      if (phaseRef.current === "scroll") {
        x -= (speedRef.current || 0) * dt; // langsam nach links
        if (x <= -maxShift) {
          x = -maxShift;
          offsetRef.current = x;
          t.style.transform = `translateX(${x}px)`;
          // Am Ende: Pause aktivieren und erst im nächsten Frames weitermachen
          pauseUntil = ts + (endPauseRef.current || 0);
          phaseRef.current = "endPause";
          rafRef.current = requestAnimationFrame(step);
          return; // <<< wichtig: sofort zurück, damit die Pause greift
        }
        offsetRef.current = x;
        t.style.transform = `translateX(${x}px)`;
      }

      // Weiche, schnelle Rückfahrt zum Anfang
      if (phaseRef.current === "return") {
        const t0 = retStartTsRef.current;
        const x0 = retStartXRef.current; // sollte -maxShift sein
        const d = Math.max(60, returnMs); // Schutz
        const p = Math.min(1, (ts - t0) / d);
        // EaseOutCubic
        const e = 1 - Math.pow(1 - p, 3);
        const x = x0 + (0 - x0) * e;
        offsetRef.current = x;
        t.style.transform = `translateX(${x}px)`;
        if (p >= 1) {
          // Am Anfang angekommen → Start-Pause + rechter Fade
          w.style.webkitMaskImage = maskRightOnly();
          w.style.maskImage = maskRightOnly();
          phaseRef.current = "startPause";
          pauseUntil = ts + (startPauseRef.current || 0);
        }
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      if (phaseRef.current === "endPause") {
        // Rückfahrt vorbereiten (soft, aber schnell)
        retStartTsRef.current = ts;
        retStartXRef.current = offsetRef.current; // aktueller Wert (≈ -maxShift)
        // Während der Rückfahrt Fades anlassen
        phaseRef.current = "return";
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    // Start mit einer Start-Pause
    phaseRef.current = "startPause";
    last = 0;
    rafRef.current = requestAnimationFrame((ts) => {
      pauseUntil = ts + (startPauseRef.current || 0);
      step(ts);
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [overflow, fade, endPad, leftInset, returnMs]);

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden min-w-0 ${className}`}
      style={{ width: slotPx ? `${slotPx}px` : `${slotCh}ch` }}
    >
      <div ref={textRef} className="whitespace-nowrap" title={text}>
        {text}
      </div>
    </div>
  );
}
