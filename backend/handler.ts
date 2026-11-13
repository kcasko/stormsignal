import { getWeather } from "./weather";
import { geocode, parsePointId, placesIn, searchLocal } from "./geocode";
import { renderBadge } from "./badge";
import { getZones, parseZoneRefs } from "./zones";
import { bbox } from "../shared/geo";
import { historyStore, takeSnapshots, RETENTION_HOURS } from "./history";
import { locations } from "../shared/locations";
import { assess } from "../shared/riskEngine";
import { snsPublisher } from "./watch";
import { rulesCatalog } from "../shared/rulesCatalog";

const VERSION = "0.5.0";
type Event = {
  rawPath?: string;
  requestContext?: { http?: { method?: string } };
  queryStringParameters?: Record<string, string>;
};

const validLocation = (id: string) =>
  id.length <= 40 && (locations.some((l) => l.id === id) || parsePointId(id) !== null);

export async function handler(event: Event) {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  const reply = (statusCode: number, body: unknown, cache?: string) => ({
    statusCode,
    headers: cache ? { ...headers, "cache-control": cache } : headers,
    body: JSON.stringify(body),
  });
  if (event.requestContext?.http?.method !== "GET") return reply(405, { error: "GET required" });
  const q = event.queryStringParameters ?? {};
  switch (event.rawPath) {
    case "/api/health":
      return reply(200, { status: "ok", version: VERSION });
    case "/api/locations":
      return reply(200, { locations }, "public, max-age=3600");
    case "/api/rules":
      return reply(200, rulesCatalog(), "public, max-age=3600");
    case "/api/geocode": {
      const query = (q.q ?? "").trim();
      if (query.length < 2 || query.length > 120) return reply(400, { error: "Enter a ZIP, city or street address." });
      try {
        return reply(200, { results: await geocode(query) });
      } catch {
        return reply(503, { error: "Address lookup is unavailable. Try a ZIP or city name." });
      }
    }
    case "/api/badge": {
      // Embeddable SVG badge. loc = a listed city id, a pt:lat,lon id, or a 5-digit ZIP.
      const raw = (q.loc ?? "").trim();
      const id = /^\d{5}$/.test(raw) ? searchLocal(raw)[0]?.id ?? "" : raw;
      const svg = (body: string, maxAge: number) => ({
        statusCode: 200,
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          // CloudFront caches by loc for this long, so popular badges cost almost nothing.
          "cache-control": `public, max-age=${maxAge}`,
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
        },
        body,
      });
      if (!validLocation(id)) return svg(renderBadge("unknown", ""), 3600);
      try {
        const weather = await getWeather(id);
        const level = weather.availability.forecast || weather.availability.alerts ? assess(weather, Date.now()).level : "unknown";
        return svg(renderBadge(level, weather.location.name.replace(/^Near /, "")), level === "unknown" ? 120 : 600);
      } catch {
        return svg(renderBadge("unknown", ""), 120);
      }
    }
    case "/api/area": {
      // Alert map data: NWS zone outlines (optional) plus the largest nearby places, inside a bounding box.
      const box = (q.bbox ?? "").split(",").map(Number);
      const validBox =
        box.length === 4 && box.every(Number.isFinite) && box[0] < box[2] && box[1] < box[3] &&
        box[0] >= -180 && box[2] <= -60 && box[1] >= 15 && box[3] <= 72 && box[2] - box[0] <= 12 && box[3] - box[1] <= 8;
      const refs = q.zones ? parseZoneRefs(q.zones) : [];
      if (refs === null || (!validBox && !refs.length)) return reply(400, { error: "Give NWS zone ids or a U.S. bounding box." });
      try {
        const zones = refs.length ? await getZones(refs) : [];
        const zoneBox = bbox(zones.flatMap((z) => z.rings));
        const area = validBox
          ? zoneBox
            ? { minLon: Math.min(box[0], zoneBox.minLon), minLat: Math.min(box[1], zoneBox.minLat), maxLon: Math.max(box[2], zoneBox.maxLon), maxLat: Math.max(box[3], zoneBox.maxLat) }
            : { minLon: box[0], minLat: box[1], maxLon: box[2], maxLat: box[3] }
          : zoneBox;
        return reply(200, { zones, places: area ? placesIn(area) : [] }, "public, max-age=3600");
      } catch {
        return reply(503, { error: "Alert area unavailable." });
      }
    }
    case "/api/history": {
      const id = q.location ?? "";
      if (!locations.some((l) => l.id === id))
        return reply(200, { location: id, tracked: false, snapshots: [] });
      try {
        const since = Date.now() - Math.min(Number(q.hours) || 24, RETENTION_HOURS) * 3600000;
        return reply(200, { location: id, tracked: true, snapshots: await historyStore().list(id, since) });
      } catch {
        return reply(503, { error: "Forecast history unavailable." });
      }
    }
    case "/api/weather": {
      const id = q.location ?? "";
      if (!validLocation(id)) return reply(400, { error: "Choose a supported U.S. location." });
      try {
        const started = Date.now();
        const weather = await getWeather(id);
        const assessment = assess(weather, Date.now());
        // Structured log line for CloudWatch Logs Insights. Custom points are logged only as "point".
        console.log(
          JSON.stringify({
            msg: "weather",
            location: id.startsWith("pt:") ? "point" : id,
            ms: Date.now() - started,
            availability: weather.availability,
            alerts: weather.alerts.length,
            level: assessment.level,
          }),
        );
        return reply(200, { ...weather, assessment });
      } catch {
        return reply(503, { error: "Weather service unavailable. Check weather.gov." });
      }
    }
    default:
      return reply(404, { error: "Not found" });
  }
}

/** EventBridge Scheduler target: saves forecast snapshots for the catalog cities. */
export async function snapshot() {
  const topic = process.env.WATCH_TOPIC_ARN;
  const city = process.env.WATCH_LOCATION;
  const results = await takeSnapshots(undefined, undefined, undefined, topic && city ? { location: city, publish: snsPublisher(topic) } : undefined);
  console.log(JSON.stringify({ msg: "snapshot", results }));
  return results;
}
