import Home from "./pages/Home";
import PlayerBar from "./components/PlayerBar";
import { TrackProvider } from "./state/TrackContext";
import "./index.css";

export default function App() {
  return (
    <div className="app bg-black text-white overflow-hidden">
      <div
        className="relative rounded-[40px] overflow-hidden bg-black text-white shadow-2xl"
        style={{
          width: "390px",                // echte Breite iPhone 12
  height: "844px",               // echte Höhe iPhone 12
  "--scale": "min(calc(100vw / 390), calc(100lvh / 844))",
  transform: "scale(var(--scale))",
  transformOrigin: "center center",
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