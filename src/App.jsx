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
          width: "100vw",
          height: "100lvh",
          maxWidth: "430px",   // optional upper bound for larger screens
          maxHeight: "932px",  // iPhone 16 Pro reference
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