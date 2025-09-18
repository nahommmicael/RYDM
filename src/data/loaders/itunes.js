// src/data/loaders/itunes.js
// iTunes Search API — 30s MP3 Previews (no auth)
// Wir ziehen "R&B"-lastige Tracks und normalisieren sie in dein Track-Format.

const ARTIST_SEEDS = [
  "tems","sza","brent faiyaz","victoria monet","giveon","h.e.r.",
  "the weeknd","miguel","ty dolla $ign","summer walker","Reezy",
  "6lack","jhené aiko","khalid","partynextdoor"
];

function pickRandom(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(n, a.length)));
}

function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normArtist(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritics weg
    .replace(/[^a-z0-9]+/g, " ")      // nur a-z0-9 und Leerzeichen
    .trim()
    .replace(/\s+/g, " ");
}

function getHiResArtwork(url) {
  if (!url) return null;
  // iTunes CDN akzeptiert größere Quadrate via Namensschema
  // Beispiel: .../source/100x100bb.jpg → .../source/1200x1200bb.jpg
  // Fallbacks funktionieren serverseitig meist bis 1200.
  const hi = url.replace(/\/[0-9]+x[0-9]+bb(-[0-9]+)?\./, "/1200x1200bb$1.");
  return hi;
}

function isNewEnough(r, minYear) {
  // iTunes liefert ISO-Strings in r.releaseDate
  if (!r || !r.releaseDate) return false;
  const y = new Date(r.releaseDate).getFullYear();
  return Number.isFinite(y) && y >= minYear;
}

/** Map iTunes-Result → App-Track */
function mapItunesTrack(r) {
  return {
    id: `itunes:${r.trackId}`,
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName,
    cover: getHiResArtwork(r.artworkUrl100 || r.artworkUrl60 || r.artworkUrl30 || ""),
    audioUrl: r.previewUrl || null,        // 30s MP3
    duration: Math.round((r.trackTimeMillis || 0) / 1000),
    href: r.trackViewUrl,
    source: { type: "itunes", country: r.country || null, raw: r },
  };
}

/**
 * Viele (ungefähr) R&B-Tracks mit Previews holen.
 * Nutzt pro Call einen zufälligen Artist-Seed, damit’s abwechslungsreich bleibt.
 */
export async function fetchRandomRnbFromItunes({ country = "DE", limit = 50, seedCount = ARTIST_SEEDS.length, perArtistCap = 2, minYear = 2018 } = {}) {
  // 1) Seeds breit anlegen: mehrere Artists + generische R&B-Terme
  const genericTerms = ["r&b", "neo soul", "r&b soul"]; // weitet die Suche über Seeds hinaus
  const seeds = pickRandom(ARTIST_SEEDS, Math.min(seedCount, ARTIST_SEEDS.length)); // alle (gemischt), wenn seedCount = ARTIST_SEEDS.length

  const perQueryLimit = Math.max(20, Math.ceil(limit / 2)); // genug Puffer je Query

  const makeUrl = (term, attribute) => {
    const url = new URL("/api/itunes/search", location.origin);
    url.searchParams.set("term", term);
    url.searchParams.set("entity", "musicTrack");
    url.searchParams.set("media", "music");
    url.searchParams.set("limit", String(perQueryLimit));
    url.searchParams.set("country", country);
    url.searchParams.set("lang", "de_de");
    if (attribute) url.searchParams.set("attribute", attribute); // z. B. artistTerm
    url.searchParams.set("_", String(Date.now())); // Cache-Busting gegen SW-Caches
    return url;
  };

  // Queries: erst alle Artists gezielt, dann generische Terme
  const queries = [
    ...seeds.map((name) => ({ term: name, attribute: "artistTerm" })),
    ...genericTerms.map((term) => ({ term, attribute: null })),
  ];

  const fetches = queries.map((q) =>
    fetch(makeUrl(q.term, q.attribute).toString(), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .catch(() => ({ results: [] }))
  );

  const settled = await Promise.all(fetches);
  const all = [];
  for (let i = 0; i < settled.length; i++) {
    const data = settled[i] || { results: [] };
    const q = queries[i];
    const results = (data.results || []).filter((r) => r.previewUrl);
    const filtered = results
      .filter((r) => isNewEnough(r, minYear))
      .filter((r) => {
        if (q && q.attribute === "artistTerm") return true; // Seeds: Genre nicht hart filtern
        const g = (r.primaryGenreName || "").toLowerCase();
        return g.includes("r&b") || g.includes("soul") || g.includes("neo-soul");
      })
      .map(mapItunesTrack);
    all.push(...filtered);
  }

  // De-dupe (Track-ID oder Title+Artist)
  const seen = new Set();
  const unique = [];
  for (const t of all) {
    const key = t.id || `${t.title}::${t.artist}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }

  // 2) Buckets pro Artist bilden und pro Bucket shufflen (damit nicht nur Top-1 kommt)
  const seededKeys = new Set(seeds.map((s) => normArtist(s)));
  const bucketsSeeded = new Map();
  const bucketsOther = new Map();

  for (const t of unique) {
    const artistKey = normArtist(t.artist || "Unknown");
    const target = seededKeys.has(artistKey) ? bucketsSeeded : bucketsOther;
    if (!target.has(artistKey)) target.set(artistKey, []);
    target.get(artistKey).push(t);
  }

  for (const [, arr] of bucketsSeeded) shuffleInPlace(arr);
  for (const [, arr] of bucketsOther) shuffleInPlace(arr);

  // 3a) Garantiert: mind. 1 Track je Seed-Artist (wenn vorhanden)
  const must = [];
  for (const [, arr] of bucketsSeeded) {
    if (arr.length) must.push(arr.shift());
  }

  // Per-Artist Cap nach Must-Picks anpassen
  const remainingCap = new Map();
  const decCapFor = (artistKey) => {
    const c = remainingCap.get(artistKey) ?? perArtistCap;
    remainingCap.set(artistKey, Math.max(0, c - 1));
  };
  for (const t of must) decCapFor(normArtist(t.artist || "Unknown"));

  const seededLists = Array.from(bucketsSeeded.values());
  const otherLists = Array.from(bucketsOther.values());

  // 4) Round‑Robin‑Mix: erst Seeds durchrotieren, dann Other
  const takeRoundRobin = (lists, out, max) => {
    let progressed = true;
    while (out.length < max && progressed) {
      progressed = false;
      for (let i = 0; i < lists.length && out.length < max; i++) {
        const bucket = lists[i];
        while (bucket && bucket.length && out.length < max) {
          const t = bucket.shift();
          const key = normArtist(t.artist || "Unknown");
          const capLeft = remainingCap.get(key) ?? perArtistCap;
          if (capLeft > 0) {
            out.push(t);
            remainingCap.set(key, capLeft - 1);
            progressed = true;
            break;
          }
          // cap erschöpft → nächsten Kandidaten im Bucket versuchen
        }
      }
      // Leere Buckets entfernen
      for (let i = lists.length - 1; i >= 0; i--) {
        if (!lists[i] || lists[i].length === 0) lists.splice(i, 1);
      }
    }
  };

  const mixed = [];
  // zuerst Must-Picks (gedeckelt auf limit)
  for (const t of must) {
    if (mixed.length >= limit) break;
    mixed.push(t);
  }
  // dann Round-Robin über Seeded und Other
  if (mixed.length < limit) takeRoundRobin(seededLists, mixed, limit);
  if (mixed.length < limit) takeRoundRobin(otherLists, mixed, limit);

  // 5) Falls immer noch Platz: Rest auffüllen (Cap respektieren)
  if (mixed.length < limit) {
    for (const t of unique) {
      if (mixed.find((x) => x.id === t.id)) continue;
      const key = normArtist(t.artist || "Unknown");
      const capLeft = remainingCap.get(key) ?? perArtistCap;
      if (capLeft <= 0) continue;
      mixed.push(t);
      remainingCap.set(key, capLeft - 1);
      if (mixed.length >= limit) break;
    }
  }

  return mixed;
}

/** Freitext-Suche (z.B. Artistname) */
export async function searchItunesTracks(query, { country = "DE", limit = 25, minYear = 2018 } = {}) {
  if (!query || !query.trim()) return [];
  const url = new URL("/api/itunes/search", location.origin);
  url.searchParams.set("term", query.trim());
  url.searchParams.set("entity", "musicTrack");
  url.searchParams.set("media", "music");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("country", country);
  url.searchParams.set("lang", "de_de");
  url.searchParams.set("_", String(Date.now()));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || [])
    .filter((r) => r.previewUrl)
    .filter((r) => isNewEnough(r, minYear))
    .map(mapItunesTrack);
}