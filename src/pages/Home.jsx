// === Account-Icon Steuerung ===
// Ein Wert für Breite+Höhe; Button passt sich automatisch an (mind. 58px)
const ACCOUNT_ICON_SIZE = 25; // px – ändere nur diesen Wert
const ACCOUNT_ICON_PAD  = 8;  // px – Innenabstand im runden Button
const ACCOUNT_BUTTON_MIN = 58; // px – minimale Buttongröße wie im Design
// src/pages/Home.jsx
import { useState } from "react";
import { useTrack } from "../state/TrackContext";
import MapCard from "../components/MapCard";
import SearchOverlay from "../components/SearchOverlay";
import accountIcon from "../icons/account.svg";
import NavBar from "../components/NavBar";
import Backdrop from "../components/Backdrop";

export default function Home() {
  const { track } = useTrack();
  const [searchOpen, setSearchOpen] = useState(false);

  // Dynamische Buttongröße aus IconSize + Padding (mindestens ACCOUNT_BUTTON_MIN)
  const __accBtnSize = Math.max(ACCOUNT_BUTTON_MIN, ACCOUNT_ICON_SIZE + ACCOUNT_ICON_PAD * 2);

  return (
    <div className="relative w-full text-white" style={{ minHeight: "100dvh" }}>
      {/* Hintergrund */}
      <Backdrop duration={720} scaleFrom={1.03} overscanPct={0.03} height={631} />

      {/* Header-Zeile */}
      <div className="absolute left-[16px] right-[16px] top-[51px] flex items-center justify-between z-20">
        <h1
          className="
            font-neon text-[60px] leading-none
            text-[#FFE254]
            drop-shadow-[0_0_10px_rgba(255,226,84,0.3)]
          "
          style={{ WebkitTextStroke: "1.5px #FFE254" }}
        >
          Home
        </h1>
        <button
          aria-label="Account"
          className="rounded-full glass flex items-center justify-center border border-white/20"
          style={{ width: __accBtnSize, height: __accBtnSize, borderWidth: "0.5px" }}
        >
          <img
            src={accountIcon}
            alt=""
            className="block"
            style={{ width: `${ACCOUNT_ICON_SIZE}px`, height: `${ACCOUNT_ICON_SIZE}px`, maxWidth: 'none', maxHeight: 'none' }}
            draggable="false"
          />
        </button>
      </div>
      
      <NavBar active="home" />    
      
      <MapCard />

      {/* Search */}
<button
  onClick={() => setSearchOpen(true)}
  className="absolute left-[32px] top-[615px] w-[180px] h-[44px] rounded-[36px]
             glass z-30 pointer-events-auto
             text-left pl-5 pr-4 text-[12px] font-semibold border border-white/20"
  style={{ borderWidth: "0.5px" }}
  aria-controls="search-overlay"
  aria-expanded={searchOpen}
>
  Set your destination …
</button>

      {/* Nav-Cluster (leer) */}
      

      {/* Overlay einbinden */}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}