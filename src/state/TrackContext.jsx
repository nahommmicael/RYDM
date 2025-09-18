// src/state/TrackContext.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { allTracks as localTracks } from "../data/tracks";
import { fetchRandomRnbFromItunes } from "../data/loaders/itunes";

// Preview/Player-Policy:
// - Preview pausiert Main und setzt ihn danach ggf. fort.
// - Main-Play während Preview => Preview sofort stoppen.

const TrackContext = createContext(null);

export function TrackProvider({ children }) {
  // Online vs Local
  const [onlineTracks, setOnlineTracks] = useState([]);
  const [mode, setMode] = useState("online");   // "online" | "local"
  const [loadingOnline, setLoadingOnline] = useState(false);

  // Main Player State
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.25);

  const audioRef = useRef(null);
  const wasPlayingBeforePreviewRef = useRef(false);
  const previewRef = useRef(null);

  const playlist = useMemo(() => {
    return mode === "online" && onlineTracks.length ? onlineTracks : localTracks;
  }, [mode, onlineTracks]);

  const track = playlist[index] || playlist[0] || null;

  // Debug-Hooks für Safari-Konsole
  useEffect(() => {
    window.__rydmMusicMode = mode;
    window.__rydmOnlineTracks = onlineTracks;
  }, [mode, onlineTracks]);

  // Einmaliges Audio-Setup
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.volume = volume;
    const audio = audioRef.current;

    const onTime = () => setTime(audio.currentTime || 0);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      next();
      requestAnimationFrame(() => audioRef.current?.play().catch(() => {}));
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, []);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (previewRef.current) previewRef.current.volume = volume;
  }, [volume]);

  // Online-Liste beim Start laden
  useEffect(() => {
    let aborted = false;
    (async () => {
      setLoadingOnline(true);
      try {
        const list = await fetchRandomRnbFromItunes({ country: "DE", limit: 50 });
        if (!aborted) setOnlineTracks(list);
      } catch (e) {
        console.warn("Failed to fetch iTunes list", e);
      } finally {
        !aborted && setLoadingOnline(false);
      }
    })();
    return () => { aborted = true; };
  }, []);

  // Trackwechsel → src setzen
  useEffect(() => {
    if (!track || !audioRef.current) return;
    audioRef.current.src = track.audioUrl || track.mp3 || "";
    setTime(0);
    setDuration(0);
    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    }
  }, [track?.id]);

  function play() {
    stopPreview(); // Main hat Vorrang
    setIsPlaying(true);
    audioRef.current?.play().catch(() => setIsPlaying(false));
  }
  function pause() {
    setIsPlaying(false);
    audioRef.current?.pause();
  }
  function toggle() { isPlaying ? pause() : play(); }
  function next() { setIndex(i => (i + 1) % (playlist.length || 1)); }
  function prev() { setIndex(i => (i - 1 + (playlist.length || 1)) % (playlist.length || 1)); }
  function seekSeconds(sec) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min((audioRef.current.duration || 0) - 0.1, sec));
    setTime(audioRef.current.currentTime);
  }
  function setTrackById(id) {
    const i = playlist.findIndex(t => t.id === id);
    if (i >= 0) setIndex(i);
  }
  function setMainFromPreview(t) {
    const i = playlist.findIndex(x => x.id === t.id);
    if (i >= 0) setIndex(i);
    stopPreview();
    setTimeout(() => play(), 0);
  }

  // --- Preview controls ---
  function playPreview(url) {
    if (!url) return;
    wasPlayingBeforePreviewRef.current = isPlaying;
    pause();

    stopPreview();
    const a = new Audio(url);
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    a.volume = volume;
    previewRef.current = a;

    a.addEventListener("ended", () => {
      stopPreview();
      if (wasPlayingBeforePreviewRef.current) play();
    });

    a.play().catch(err => {
      console.warn("preview play failed", err);
      stopPreview();
      if (wasPlayingBeforePreviewRef.current) play();
    });
  }
  function stopPreview() {
    const a = previewRef.current;
    if (!a) return;
    try { a.pause(); } catch {}
    previewRef.current = null;
  }

  const progress = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 0;

  const value = useMemo(() => ({
    // data
    playlist, onlineTracks, loadingOnline, mode, setMode,

    // current track & player state
    track, index, isPlaying, time, duration, progress, volume,

    // main controls
    play, pause, toggle, next, prev, seekSeconds, setIndex, setTrackById, setMainFromPreview,

    // preview controls
    playPreview, stopPreview,
  }), [playlist, onlineTracks, loadingOnline, mode, track, index, isPlaying, time, duration, progress, volume]);

  return <TrackContext.Provider value={value}>{children}</TrackContext.Provider>;
}

export function useTrack() {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error("useTrack must be used within <TrackProvider>");
  return ctx;
}