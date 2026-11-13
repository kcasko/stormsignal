import { useEffect, useMemo, useState } from "react";
import type { Alert } from "../shared/types";
import { alertLevel } from "../shared/rules";
import { bbox, insideRings, type Ring } from "../shared/geo";
import type { AlertStory } from "../shared/alertHistory";
import { stamp } from "./format";

const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "";

interface Area {
  zones: { id: string; name: string; rings: Ring[] }[];
  places: { name: string; lat: number; lon: number }[];
}
const areaCache = new Map<string, Area>();

/** Zone outlines (when the alert lists zones) and nearby place names (always), from /api/area. */
function useArea(alert: Alert, lon: number, lat: number) {
  const rings = alert.geometry ?? [];
  const box = bbox(rings, [[lon, lat]]);
  const pad = 0.15;
  const q = box
    ? [box.minLon - pad, box.minLat - pad, box.maxLon + pad, box.maxLat + pad].map((v) => v.toFixed(3)).join(",")
    : "";
  const url = `${API}/api/area?bbox=${q}${alert.zones.length ? "&zones=" + alert.zones.slice(0, 30).join(",") : ""}`;
  const [state, setState] = useState<{ url: string; area: Area | null; failed: boolean }>({ url: "", area: null, failed: false });
  useEffect(() => {
    if (areaCache.has(url)) return;
    let ignore = false;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw Error();
        const body = (await r.json()) as Area;
        const area = { zones: Array.isArray(body.zones) ? body.zones : [], places: Array.isArray(body.places) ? body.places : [] };
        areaCache.set(url, area);
        if (!ignore) setState({ url, area, failed: false });
      })
      .catch(() => !ignore && setState({ url, area: null, failed: true }));
    return () => {
      ignore = true;
    };
  }, [url]);
  const cached = areaCache.get(url);
  if (cached) return { area: cached, loading: false, failed: false };
  return state.url === url ? { area: state.area, loading: false, failed: state.failed } : { area: null, loading: true, failed: false };
}

const W = 320,
  H = 190;
const NICE_MILES = [1, 2, 5, 10, 20, 50, 100, 200];

export function AlertMap({ alert, lat, lon, place, simulated }: { alert: Alert; lat: number; lon: number; place: string; simulated: boolean }) {
  const { area, loading, failed } = useArea(alert, lon, lat);
  const polygon = alert.geometry ?? [];
  const zoneRings = area?.zones.flatMap((z) => z.rings) ?? [];
  const view = useMemo(() => {
    const box = bbox([...polygon, ...zoneRings], [[lon, lat]]);
    if (!box) return null;
    const k = Math.cos((((box.minLat + box.maxLat) / 2) * Math.PI) / 180);
    const spanX = Math.max((box.maxLon - box.minLon) * k, 0.05),
      spanY = Math.max(box.maxLat - box.minLat, 0.05);
    const s = Math.min((W * 0.84) / spanX, (H * 0.8) / spanY);
    const cx = ((box.minLon + box.maxLon) / 2) * k,
      cy = (box.minLat + box.maxLat) / 2;
    const xy = (lo: number, la: number): [number, number] => [W / 2 + (lo * k - cx) * s, H / 2 - (la - cy) * s];
    const miles = NICE_MILES.filter((m) => (m / 69) * s <= W * 0.28).pop() ?? 1;
    return { xy, s, miles };
  }, [polygon, zoneRings, lon, lat]);

  if (!polygon.length && !alert.zones.length) return null;
  if (!view) {
    return (
      <p className="fine">{loading ? "Loading the alert area…" : failed ? "Alert map unavailable. The listed area below still applies." : ""}</p>
    );
  }
  const path = (rings: Ring[]) =>
    rings.map((r) => "M" + r.map(([lo, la]) => view.xy(lo, la).map((v) => v.toFixed(1)).join(",")).join("L") + "Z").join("");
  const inside = polygon.length ? insideRings(lon, lat, polygon) : zoneRings.length ? insideRings(lon, lat, zoneRings) : null;
  const [px, py] = view.xy(lon, lat);
  const names = area?.zones.map((z) => z.name) ?? [];
  const label = `Map of the ${simulated ? "simulated " : ""}${alert.event} area${polygon.length && !simulated ? " (storm-based polygon)" : ""}. ${
    inside === null ? "" : inside ? `${place} is inside it.` : `${place} is outside the drawn area.`
  }${names.length ? ` NWS zones: ${names.slice(0, 8).join("; ")}${names.length > 8 ? ` and ${names.length - 8} more` : ""}.` : ""}`;
  // Greedy label placement: largest places first, skipping any label that would collide.
  type Box = [number, number, number, number];
  const hits = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const taken: Box[] = [
    [px - 8, py - 8, px + 8, py + 8],
    [px + 8, py - 18, px + 12 + place.length * 6.4, py - 4],
    [0, H - 28, W * 0.28 + 50, H],
  ];
  const placeLabels = (area?.places ?? [])
    .map((p) => ({ ...p, at: view.xy(p.lon, p.lat) }))
    .filter(({ name, at: [x, y] }) => {
      const box: Box = [x - 3, y - 8, x + 6 + name.length * 5.4, y + 5];
      if (box[0] < 2 || box[2] > W - 2 || box[1] < 2 || box[3] > H - 2 || taken.some((t) => hits(t, box))) return false;
      taken.push(box);
      return true;
    });

  return (
    <figure className={`alert-map lv-${alertLevel(alert)}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {zoneRings.length > 0 && <path className="zones" d={path(zoneRings)} />}
        {polygon.length > 0 && <path className="poly" d={path(polygon)} />}
        {placeLabels.map((p) => (
          <g key={p.name + p.lat} className="town" aria-hidden="true">
            <circle cx={p.at[0]} cy={p.at[1]} r={1.8} />
            <text x={p.at[0] + 4} y={p.at[1] + 3}>
              {p.name}
            </text>
          </g>
        ))}
        <g className="you" aria-hidden="true">
          <circle cx={px} cy={py} r={7} className="halo" />
          <circle cx={px} cy={py} r={3.5} />
          <text x={px + 9} y={py - 7}>
            {place}
          </text>
        </g>
        <g className="scalebar" aria-hidden="true" transform={`translate(10 ${H - 12})`}>
          <path d={`M0,-4V0H${((view.miles / 69) * view.s).toFixed(1)}V-4`} />
          <text x={((view.miles / 69) * view.s) + 5} y={0}>
            {view.miles} mi
          </text>
        </g>
      </svg>
      <figcaption className="fine">
        {simulated ? "Fictional area for this scenario" : polygon.length ? "Storm-based polygon drawn by NWS" : "NWS zones in the alert"}
        {inside === null ? "" : inside ? ` · ${place} is inside` : ` · ${place} is outside the drawn area`}
        {loading && alert.zones.length ? " · loading zone outlines…" : ""}
        {failed ? " · zone outlines unavailable" : ""}
      </figcaption>
    </figure>
  );
}

export function AlertTimeline({ story, zone }: { story: AlertStory; zone: string }) {
  if (!story.events.length) return null;
  return (
    <ol className="timeline" aria-label={`${story.event} timeline`}>
      {story.events.map((e, i) => (
        <li key={i} className={e.future ? "future" : ""}>
          <span className="num">{stamp(e.at, zone)}</span> <b>{e.label}</b>
          {e.detail && <span className="fine"> {e.detail}</span>}
        </li>
      ))}
    </ol>
  );
}

const STATE_WORD: Record<string, string> = {
  expired: "Expired",
  cancelled: "Cancelled by NWS",
  upgraded: "Upgraded",
  "ended-early": "Ended early",
};

export function EndedAlerts({ stories, zone, simulated }: { stories: AlertStory[]; zone: string; simulated: boolean }) {
  if (!stories.length) return null;
  return (
    <div className="ended">
      <h3 className="eyebrow">{simulated ? "Simulated alerts that ended" : "Ended in the last 24 hours"}</h3>
      <ul>
        {stories.map((s) => (
          <li key={s.key}>
            <div className="ended-head">
              <strong>{s.event}</strong> <span className={`state state-${s.state}`}>{STATE_WORD[s.state]}</span>
            </div>
            <AlertTimeline story={s} zone={zone} />
          </li>
        ))}
      </ul>
    </div>
  );
}
