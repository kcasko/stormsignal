// Forecast drift: how the NWS forecast for the same future hours has changed across saved snapshots.
// A forecast that keeps changing is less certain; this makes that visible. Deterministic, no prediction.
import type { Classification, Period, Weather } from "./types";
import { LEVELS } from "./types";
import { HOUR } from "./rules";

export interface SnapshotHour {
  t: string; // hour start (ISO)
  g: number | null; // gust mph
  w: number | null; // sustained wind mph
  th: number | null; // thunder %
  p: number | null; // precip %
  s: number | null; // snow in
  i: number | null; // ice in
  tp: number | null; // temperature
}
export interface Snapshot {
  capturedAt: string;
  issuedAt: string | null;
  level: Classification;
  hours: SnapshotHour[];
}

export function toSnapshot(weather: Weather, level: Classification, now: number, hours = 48): Snapshot {
  return {
    capturedAt: new Date(now).toISOString(),
    issuedAt: weather.forecastUpdatedAt,
    level,
    hours: weather.periods
      .filter((p) => Date.parse(p.end) > now && Date.parse(p.start) < now + hours * HOUR)
      .map((p: Period) => ({
        t: p.start,
        g: p.gustMph,
        w: p.windMph,
        th: p.thunderChance,
        p: p.precipitation,
        s: p.snowIn,
        i: p.iceIn,
        tp: p.temperature,
      })),
  };
}

export interface MetricChange {
  key: "g" | "th" | "s" | "i" | "tp";
  label: string;
  unit: string;
  before: number;
  after: number;
  delta: number;
}
export interface Drift {
  baseline: Snapshot | null;
  snapshots: number;
  levels: { at: string; level: Classification }[];
  changes: MetricChange[];
  trend: "worse" | "better" | "stable" | "shifting" | "unknown";
  summary: string;
}

const METRICS: { key: MetricChange["key"]; label: string; unit: string; agg: "max" | "sum"; notable: number }[] = [
  { key: "g", label: "Peak gust", unit: " mph", agg: "max", notable: 8 },
  { key: "th", label: "Peak thunder chance", unit: "%", agg: "max", notable: 15 },
  { key: "s", label: "Snow total", unit: " in", agg: "sum", notable: 1 },
  { key: "i", label: "Ice total", unit: " in", agg: "sum", notable: 0.05 },
  { key: "tp", label: "High temperature", unit: "°", agg: "max", notable: 6 },
];

const rank = (l: Classification) => (l === "unknown" ? -1 : LEVELS.indexOf(l));

/**
 * Compares the same valid hours in the next 24 h between the oldest snapshot from the last
 * `lookbackHours` and the current forecast.
 */
export function computeDrift(current: Weather, snapshots: Snapshot[], currentLevel: Classification, now: number, lookbackHours = 24): Drift {
  const recent = snapshots
    .filter((s) => Date.parse(s.capturedAt) >= now - lookbackHours * HOUR && Date.parse(s.capturedAt) <= now)
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
  const levels = recent.map((s) => ({ at: s.capturedAt, level: s.level }));
  const baseline = recent.find((s) => now - Date.parse(s.capturedAt) >= 2 * HOUR) ?? null;
  if (!baseline || !current.availability.forecast)
    return {
      baseline,
      snapshots: recent.length,
      levels,
      changes: [],
      trend: "unknown",
      summary: !current.availability.forecast
        ? "Current forecast unavailable, so changes can't be compared."
        : "Not enough forecast history yet. Storm Signal saves a copy of the forecast every 30 minutes.",
    };
  const end = now + 24 * HOUR;
  const nowHours = new Map(
    current.periods
      .filter((p) => Date.parse(p.end) > now && Date.parse(p.start) < end)
      .map((p) => [p.start, toSnapshot({ ...current, periods: [p] }, "unknown", 0, 1e6).hours[0]]),
  );
  // Only hours present in both forecasts are compared (apples to apples).
  const pairs = baseline.hours.filter((h) => nowHours.has(h.t)).map((h) => [h, nowHours.get(h.t)!] as const);
  const changes: MetricChange[] = [];
  for (const m of METRICS) {
    const a = pairs.map(([b]) => b[m.key]).filter((v): v is number => v !== null);
    const b = pairs.map(([, c]) => c[m.key]).filter((v): v is number => v !== null);
    if (!a.length || !b.length || a.length !== b.length) continue;
    const agg = (xs: number[]) => (m.agg === "max" ? Math.max(...xs) : xs.reduce((x, y) => x + y, 0));
    const before = agg(a),
      after = agg(b);
    if (Math.abs(after - before) >= m.notable)
      changes.push({ key: m.key, label: m.label, unit: m.unit, before, after, delta: after - before });
  }
  const levelDelta = rank(currentLevel) - rank(baseline.level);
  const levelChanges = recent.reduce((n, s, i) => n + (i > 0 && s.level !== recent[i - 1].level ? 1 : 0), 0);
  const worse = changes.filter((c) => (c.key === "tp" ? false : c.delta > 0)).length;
  const better = changes.filter((c) => (c.key === "tp" ? false : c.delta < 0)).length;
  const trend: Drift["trend"] =
    levelDelta > 0 || (levelDelta === 0 && worse > better && worse > 0)
      ? "worse"
      : levelDelta < 0 || (levelDelta === 0 && better > worse && better > 0)
        ? "better"
        : levelChanges > 1 || changes.length > 1
          ? "shifting"
          : "stable";
  const ago = Math.round((now - Date.parse(baseline.capturedAt)) / HOUR);
  const lead =
    trend === "worse"
      ? "The forecast has trended worse"
      : trend === "better"
        ? "The forecast has trended better"
        : trend === "shifting"
          ? "The forecast keeps shifting, so treat timing as uncertain"
          : "The forecast has been steady";
  const top = changes[0];
  return {
    baseline,
    snapshots: recent.length,
    levels,
    changes,
    trend,
    summary: `${lead} over the last ${ago} hour${ago === 1 ? "" : "s"}.${
      top
        ? ` ${top.label} for the same hours went from ${fmt(top.before, top.unit)} to ${fmt(top.after, top.unit)}.`
        : ""
    }`,
  };
}

export const fmt = (v: number, unit: string) =>
  unit === " in" ? `${v < 0.1 ? v.toFixed(2) : v.toFixed(1)} in` : `${Math.round(v)}${unit}`;
