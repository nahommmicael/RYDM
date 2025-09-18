// src/data/tracks.js
// Exakte Dateien (Groß-/Kleinschreibung!):
//   src/assets/covers/Replay.jpg
//   src/assets/audio/Replay.mp3
//   src/assets/covers/Timeless.jpg
//   src/assets/audio/Timeless.mp3

import coverReplay from "../assets/covers/Replay.jpg";
import audioReplay from "../assets/audio/Replay.mp3";

import coverTimeless from "../assets/covers/Timeless.jpg";
import audioTimeless from "../assets/audio/Timeless.mp3";

import coverLullaby from "../assets/covers/lullaby.jpg";
import audioLullaby from "../assets/audio/lullaby.mp3";

// Playlist
export const allTracks = [
  {
    id: "t_replay_tems",
    title: "Replay",
    artist: "Tems",
    cover: coverReplay,
    audioUrl: audioReplay,
  },
  {
    id: "t_timeless_weeknd",
    title: "Timeless",
    artist: "The Weeknd",
    cover: coverTimeless,
    audioUrl: audioTimeless,
  },
  {
    id: "t_trappers_lullaby",
    title: "TRAPPERS LULLABY",
    artist: "Reezy",
    cover: coverLullaby,
    audioUrl: audioLullaby,
  },
];

// Backwards-compat (falls irgendwo noch benutzt)
export const currentTrack = allTracks[0];