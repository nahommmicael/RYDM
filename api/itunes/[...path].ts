// api/itunes/[...path].ts
export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const inUrl = new URL(req.url);

  // Alles hinter /api/itunes an die echte iTunes-API anhängen
  const path = inUrl.pathname.replace(/^\/api\/itunes/, "") || "/search";
  const upstream = new URL(`https://itunes.apple.com${path}${inUrl.search}`);

  // iOS leitet bisweilen auf musics:// um → erst mal NICHT automatisch folgen
  let res = await fetch(upstream.toString(), {
    headers: { "accept": "application/json", "user-agent": "Mozilla/5.0" },
    redirect: "manual",
  });

  // musics:// → auf https:// umschreiben und dann folgen
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location") || "";
    if (loc.startsWith("musics://")) {
      const httpsLoc = loc.replace(/^musics:\/\//, "https://");
      res = await fetch(httpsLoc, {
        headers: { "accept": "application/json", "user-agent": "Mozilla/5.0" },
        redirect: "follow",
      });
    }
  }

  // CORS & Cache
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(res.body, { status: res.status, headers });
}