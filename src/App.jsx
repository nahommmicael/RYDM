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
    width: "min(100vw, 430px)",
  height: "min(100lvh, 932px)",
  margin: "0 auto",
  paddingTop: "env(safe-area-inset-top, 0px)",
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
  boxSizing: "border-box",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
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