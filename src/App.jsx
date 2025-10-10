import Home from "./pages/Home";
import PlayerBar from "./components/PlayerBar";
import { TrackProvider } from "./state/TrackContext";
import "./index.css";

export default function App() {
  return (
    <div className="app-root bg-black text-white">
      <div
  className="device relative overflow-hidden bg-black text-white shadow-2xl"
  style={{
    width: "min(100vw, 430px)",   // passt für 12 & 16 Pro
    height: "min(100lvh, 932px)", // volle Geräthöhe, capped an iPhone 16
    margin: "0 auto",
    paddingTop: "env(safe-area-inset-top, 0px)",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    paddingLeft: "env(safe-area-inset-left, 0px)",
    paddingRight: "env(safe-area-inset-right, 0px)",
    boxSizing: "border-box",
    position: "relative",
  }}
>
        <TrackProvider>
          <Home />
          <PlayerBar />
        </TrackProvider>
      </div>
    </div>
  );
}