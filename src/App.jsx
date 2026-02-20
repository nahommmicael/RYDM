import Home from "./pages/Home";
import PlayerBar from "./components/PlayerBar";
import { TrackProvider } from "./state/TrackContext";

export default function App() {
  return (
    <div className="app bg-black text-white">
      <TrackProvider>
        <Home />
        <PlayerBar />
      </TrackProvider>
    </div>
  );
}
