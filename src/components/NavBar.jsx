

// src/components/NavBar.jsx
// Kompakte, wiederverwendbare Navigationsleiste.
// Standardmäßig rendert sie sich genau an der Position deiner bisherigen Glasfläche
// (right:32, bottom:193, width:132, height:44). Keine Klicklogik – nur visuelle Icons.
// src/components/NavBar.jsx
// Wiederverwendbare Navigationsleiste – exakt auf die vorhandene Glasfläche gemappt.
// Links: Library, Mitte: Home (aktiv), Rechts: Search.
// ⬇⬇⬇ Alle Layout-Optionen hier oben einstellen ⬇⬇⬇

import homeOn from "../icons/Navigation/homeOn.svg";
import homeOff from "../icons/Navigation/homeOff.svg";
import libraryOff from "../icons/Navigation/libraryOff.svg";
import searchOff from "../icons/Navigation/searchOff.svg";

// ====== GLAS-/POSITION-KONSTANTEN ======
const NAV_RIGHT  = 32;   // Abstand vom rechten Rand
const NAV_BOTTOM = 193;  // Abstand vom unteren Rand
const NAV_W      = 132;  // Glas-Breite
const NAV_H      = 44;   // Glas-Höhe
const PADDING_X  = 12;   // Innenabstand links/rechts im Glas
const PADDING_Y  = 0;    // Innenabstand oben/unten (falls Icons optisch zentriert werden sollen)
const ICON_GAP   = 7;   // Abstand zwischen den Icons

// === FIGMA POSITIONING (Reference: 393 × 852) ===
const NAV_X = 245; // set to null to use right/bottom fallback
const NAV_Y = 615; // (852 - 44 - 193)

// ====== ICON-KONSTANTEN (pro Icon separat) ======
// Größen (Breite/Höhe in px) und optional vertikaler Feintuning-Offset in px
const ICON_LIB_W = 36;  const ICON_LIB_H = 36;  const ICON_LIB_Y = 0;
const ICON_HOME_W = 36; const ICON_HOME_H = 36; const ICON_HOME_Y = 0;
const ICON_SEARCH_W = 36; const ICON_SEARCH_H = 36
; const ICON_SEARCH_Y = 0;

// Aktiver Glow (Gelb)
const GLOW = "drop-shadow(0 0 6px rgba(255,226,84,0.35))";

/**
 * Props
 * - active: "home" | "library" | "search" (nur Darstellung)
 * - fixed:  boolean – wenn true, positioniert sich exakt wie im Home-Placeholder
 * - className/style: optionale Zusätze (werden angehängt)
 */
export default function NavBar({
  active = "home",
  fixed = true,
  className = "",
  style = {},
}) {
  const containerClasses = [
    "rounded-[36px] glass z-30 pointer-events-auto",
    "[box-shadow:0_0_0_0.5px_rgba(255,255,255,0.2)]",
    className,
  ].filter(Boolean).join(" ");

  const containerStyle = fixed
    ? {
        position: "absolute",
        width: NAV_W,
        height: NAV_H,
        ...(NAV_X !== null
          ? {
              left: `${NAV_X}px`,
              top: `${NAV_Y}px`,
            }
          : {
              right: NAV_RIGHT,
              bottom: `calc(${NAV_BOTTOM}px - env(safe-area-inset-bottom))`,
            }),
        ...style,
      }
    : style;

  const Icon = ({ src, alt = "", active = false, w, h, offsetY = 0 }) => (
    <img
      src={src}
      alt={alt}
      draggable="false"
      className="block select-none"
      style={{
        width: w,
        height: h,
        transform: offsetY ? `translateY(${offsetY}px)` : "none",
        filter: active ? GLOW : "none",
        opacity: active ? 1 : 0.95,
      }}
    />
  );

  return (
    <div className={containerClasses} role="navigation" aria-label="Main navigation" style={containerStyle}>
      {/* Icon-Wrapper liegt über dem Glas-Stroke */}
      <div
        className="h-full w-full relative z-[2] flex items-center justify-center"
        style={{ paddingLeft: PADDING_X, paddingRight: PADDING_X, paddingTop: PADDING_Y, paddingBottom: PADDING_Y, columnGap: ICON_GAP }}
      >
        {/* Reihenfolge: Library (links) – Home (mitte) – Search (rechts) */}
        <Icon src={libraryOff} alt="Library" active={active === "library"} w={ICON_LIB_W} h={ICON_LIB_H} offsetY={ICON_LIB_Y} />
        <Icon src={active === "home" ? homeOn : homeOff} alt="Home" active={active === "home"} w={ICON_HOME_W} h={ICON_HOME_H} offsetY={ICON_HOME_Y} />
        <Icon src={searchOff} alt="Search" active={active === "search"} w={ICON_SEARCH_W} h={ICON_SEARCH_H} offsetY={ICON_SEARCH_Y} />
      </div>
    </div>
  );
}