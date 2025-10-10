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
      width: "390px", // iPhone 12 design reference
      height: "844px",
      "--scale": "min(calc(100vw / 390), calc(100lvh / 844))",
      transform: "scale(var(--scale))",
      transformOrigin: "top center", // fix center drift
      position: "absolute",
      top: "50%",
      left: "50%",
      translate: "-50% -50%", // perfect centering
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