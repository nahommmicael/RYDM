// src/state/mapSync.js
// Kleiner Event-Bus + geteilter Zustand (Center/Zoom/Seed/Zielmarker)
let listeners = [];
export const STUTTGART_CENTER = [9.1829, 48.7758];
let state = {
  center: STUTTGART_CENTER,
  zoom: 12.5,
  seed: 0,                  // ändert sich => Pins neu, identisch auf beiden Karten
  result: null,             // zuletzt gewählte Zielposition
};

const notify = (type, payload, src) => {
  listeners.forEach((fn) => fn(type, payload, src));
};

export const mapSync = {
  get: () => ({ ...state }),
  // View (Center/Zoom) aus Quelle src publishen
  setView(center, zoom, src) {
    state = { ...state, center: [...center], zoom };
    notify("view", { center: [...center], zoom }, src);
  },
  // Ziel-Auswahl (Marker + FlyTo)
  setResult(lngLat, src) {
    state = { ...state, result: [...lngLat] };
    notify("result", { lngLat: [...lngLat] }, src);
  },
  // Gemeinsamer Zufalls-Seed für identische Pin-Generierung
  bumpSeed(src) {
    state = { ...state, seed: Date.now() };
    notify("seed", { seed: state.seed }, src);
  },
  subscribe(fn) {
    listeners.push(fn);
    return () => { listeners = listeners.filter((x) => x !== fn); };
  },
};
