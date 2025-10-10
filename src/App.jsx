import Home from "./pages/Home";
import PlayerBar from "./components/PlayerBar";
import { TrackProvider } from "./state/TrackContext";
import "./index.css";

export default function App() {
  return (
    <div className="app-root bg-black text-white">
      <div
        className="device relative rounded-[40px] overflow-hidden bg-black text-white shadow-2xl"
        style={{
          width: "min(100%, 390px)",   // cap width to design width but allow smaller screens
          height: "min(100vh, 844px)", // cap height to design height, but never exceed viewport
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