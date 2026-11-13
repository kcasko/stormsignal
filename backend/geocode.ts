// Place search for any U.S. location, using only U.S. Census Bureau sources (no API keys):
//  - 5-digit ZIPs and "City, ST" names: bundled 2024 Gazetteer centroids (backend/data, public domain)
//  - street addresses: the live Census Geocoder (geocoding.geo.census.gov)
// Queries are never logged or stored.
import zips from "./data/zips.json";
import places from "./data/places.json";

export interface PlaceMatch {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  source: "zip" | "place" | "address";
}
type Fetcher = typeof fetch;

const STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  ),
);
const ZIPS = zips as unknown as Record<string, [number, number]>;
const PLACES = places as unknown as [string, string, number, number, number][];

/** Point ids carry rounded coordinates: 3 decimals is about 100 m. */
export const pointId = (lat: number, lon: number) =>
  `pt:${(Math.round(lat * 1000) / 1000).toFixed(3)},${(Math.round(lon * 1000) / 1000).toFixed(3)}`;

export function parsePointId(id: string): { latitude: number; longitude: number } | null {
  const m = id.match(/^pt:(-?\d{1,2}\.\d{1,3}),(-?\d{1,3}\.\d{1,3})$/);
  if (!m) return null;
  const latitude = Number(m[1]),
    longitude = Number(m[2]);
  // U.S. states, DC and territories NWS forecasts for (approximate bounding box).
  if (latitude < 17 || latitude > 72 || longitude < -180 || longitude > -64) return null;
  return { latitude, longitude };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export function searchLocal(q: string, limit = 6): PlaceMatch[] {
  const query = q.trim();
  if (/^\d{5}$/.test(query)) {
    const z = ZIPS[query];
    return z ? [{ id: pointId(z[0], z[1]), label: `ZIP ${query}`, latitude: z[0], longitude: z[1], source: "zip" }] : [];
  }
  // "Boulder, CO" / "Boulder CO" / "boulder"
  const m = query.match(/^(.*?)[,\s]+([A-Za-z]{2})$/);
  const state = m && STATES.has(m[2].toUpperCase()) ? m[2].toUpperCase() : null;
  const name = norm(state ? m![1] : query);
  if (name.length < 2) return [];
  return PLACES.filter((p) => (!state || p[1] === state) && norm(p[0]).startsWith(name))
    .sort((a, b) => Number(norm(b[0]) === name) - Number(norm(a[0]) === name) || b[4] - a[4])
    .slice(0, limit)
    .map((p) => ({
      id: pointId(p[2], p[3]),
      label: `${p[0]}, ${p[1]}`,
      latitude: p[2],
      longitude: p[3],
      source: "place" as const,
    }));
}

/** Street addresses go to the Census Geocoder; everything else stays local. */
export async function geocode(q: string, fetcher: Fetcher = fetch): Promise<PlaceMatch[]> {
  const query = q.trim().slice(0, 120);
  if (query.length < 2) return [];
  const looksLikeAddress = /^\d+\s+\S+/.test(query) && /\s/.test(query) && !/^\d{5}$/.test(query);
  if (!looksLikeAddress) return searchLocal(query);
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const r = await fetcher(url.href, { signal: AbortSignal.timeout(6000), redirect: "error" });
  if (!r.ok) throw Error("Geocoder " + r.status);
  const body = (await r.json()) as { result?: { addressMatches?: { matchedAddress?: string; coordinates?: { x?: number; y?: number } }[] } };
  return (body.result?.addressMatches ?? [])
    .filter((a) => typeof a.coordinates?.x === "number" && typeof a.coordinates?.y === "number")
    .slice(0, 5)
    .map((a) => {
      const lat = a.coordinates!.y!,
        lon = a.coordinates!.x!;
      return {
        id: pointId(lat, lon),
        label: String(a.matchedAddress ?? "Address").slice(0, 120),
        latitude: Math.round(lat * 1000) / 1000,
        longitude: Math.round(lon * 1000) / 1000,
        source: "address" as const,
      };
    })
    .filter((p) => parsePointId(p.id));
}

// ZIP centroids bucketed into 0.1° cells, built on first use. Used as a population proxy:
// populous places have many ZIP codes close to their center.
let zipGrid: Map<string, number[][]> | null = null;
function zipsNear(lat: number, lon: number, km = 8) {
  if (!zipGrid) {
    zipGrid = new Map();
    for (const [la, lo] of Object.values(ZIPS)) {
      const k = `${Math.floor(la * 10)},${Math.floor(lo * 10)}`;
      const cell = zipGrid.get(k);
      if (cell) cell.push([la, lo]);
      else zipGrid.set(k, [[la, lo]]);
    }
  }
  const kx = Math.cos((lat * Math.PI) / 180);
  let n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      for (const [la, lo] of zipGrid.get(`${Math.floor(lat * 10) + dy},${Math.floor(lon * 10) + dx}`) ?? [])
        if (Math.hypot((la - lat) * 111, (lo - lon) * 111 * kx) <= km) n++;
  return n;
}

/** The most prominent Census places inside a box, for labelling alert maps. Bundled data only, no request. */
export function placesIn(box: { minLon: number; minLat: number; maxLon: number; maxLat: number }, limit = 8) {
  return PLACES.filter(([, , lat, lon]) => lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon)
    .sort((a, b) => b[4] - a[4])
    .slice(0, 300)
    .map((p) => ({ p, score: zipsNear(p[2], p[3]) * 1000 + p[4] }))
    .sort((a, b) => b.score - a.score)
    .reduce<[string, string, number, number, number][]>((kept, { p }) => {
      // One label per cluster: skip places within about a sixth of the box of one already kept.
      const gap = Math.max(box.maxLat - box.minLat, 0.2) / 6;
      if (kept.length < limit && kept.every((k) => Math.hypot(k[2] - p[2], (k[3] - p[3]) * 0.75) > gap)) kept.push(p);
      return kept;
    }, [])
    .map(([name, , lat, lon]) => ({ name, lat, lon }));
}
