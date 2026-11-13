// Shared rule machinery for the risk (overview) and impact (activity) engines.
// Everything here is deterministic: the same weather input always yields the same output.
import type { Alert, Factor, Hazard, Level, Period, Weather } from "./types";
import { LEVELS } from "./types";

export const HOUR = 3600000;
export const rank = (l: Level) => LEVELS.indexOf(l);
export const maxLevel = (levels: Level[]): Level | null =>
  levels.length
    ? levels.reduce((a, b) => (rank(b) > rank(a) ? b : a))
    : null;
export const levelName = (l: string) => l.charAt(0).toUpperCase() + l.slice(1);

export function timeLabel(t: number, zone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  }).format(t);
}
export function rangeLabel(start: number, end: number, zone: string) {
  const day = (t: number) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: zone }).format(t);
  const clock = (t: number) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: zone,
    }).format(t);
  return `${day(start)} ${clock(start)} – ${day(end) === day(start) ? "" : day(end) + " "}${clock(end)}`;
}

/** A numeric rule: a metric read from each hourly period plus descending thresholds. */
export interface Rule {
  id: string;
  hazard: Hazard;
  /** Which data layer supplies the metric, for missing-data limitations. */
  layer: "hourly" | "grid";
  metric: (p: Period) => number | null;
  /** "max" = peak hour; "sum" = accumulation across the window. */
  agg: "max" | "sum" | "min";
  unit: string;
  /** Checked in order; first satisfied threshold wins. Use descending severity. */
  thresholds: [Level, number][];
  title: string;
  /** Explains the consequence for this context, shown after the evidence. */
  impact: Partial<Record<Level, string>>;
}

/** A forecast-wording rule, for hazards the numeric layers may not capture. */
export interface WordingRule {
  id: string;
  hazard: Hazard;
  pattern: RegExp;
  level: Level;
  title: string;
  impact: string;
  /** Skip if this numeric rule produced a factor (avoids double counting). */
  unlessFactor?: string;
  /**
   * When set, wording only counts for hours where this numeric value is missing.
   * A known numeric value (e.g. 0 in of snow) is better evidence than "slight chance" wording.
   */
  onlyIfUnknown?: (p: Period) => number | null;
}

export interface Window {
  start: number;
  end: number;
}

export function periodsIn(weather: Weather, w: Window) {
  return weather.periods.filter(
    (p) => Date.parse(p.start) < w.end && Date.parse(p.end) > w.start,
  );
}

/** True when the hourly periods cover the whole window without gaps. */
export function covered(periods: Period[], w: Window) {
  let reach = w.start;
  for (const p of [...periods].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    if (Date.parse(p.start) > reach) return false;
    reach = Math.max(reach, Date.parse(p.end));
  }
  return reach >= w.end;
}

const fmt = (v: number, unit: string) =>
  unit === "in" ? `${v < 0.1 ? v.toFixed(2) : v.toFixed(1)} in` : `${Math.round(v)}${unit}`;

/** Fraction of a period inside the window, so accumulations are not over-counted. */
const share = (p: Period, w: Window) => {
  const s = Date.parse(p.start),
    e = Date.parse(p.end);
  return Math.max(0, Math.min(e, w.end) - Math.max(s, w.start)) / (e - s);
};

export function evaluateRules(
  weather: Weather,
  w: Window,
  rules: Rule[],
  wording: WordingRule[],
  limitations: string[],
): Factor[] {
  const zone = weather.location.timeZone;
  const periods = periodsIn(weather, w);
  const factors: Factor[] = [];
  for (const rule of rules) {
    const values = periods.map((p) => ({ p, v: rule.metric(p) }));
    const known = values.filter((x): x is { p: Period; v: number } => x.v !== null);
    if (known.length < values.length && values.length)
      limitations.push(
        `${rule.title}: ${known.length ? "some hours" : "no hours"} had a value from NWS${
          rule.layer === "grid" ? " gridpoint data" : ""
        }, so this factor ${known.length ? "may be understated" : "could not be checked"}.`,
      );
    if (!known.length) continue;
    let value: number;
    let hits: Period[];
    if (rule.agg === "sum") {
      value = known.reduce((t, x) => t + x.v * share(x.p, w), 0);
    } else if (rule.agg === "min") {
      value = Math.min(...known.map((x) => x.v));
    } else value = Math.max(...known.map((x) => x.v));
    const match = rule.thresholds.find(([, t]) =>
      rule.agg === "min" ? value <= t : value >= t,
    );
    if (!match) continue;
    const [level, threshold] = match;
    hits =
      rule.agg === "sum"
        ? known.filter((x) => x.v > 0).map((x) => x.p)
        : known
            .filter((x) => (rule.agg === "min" ? x.v <= threshold : x.v >= threshold))
            .map((x) => x.p);
    const start = Math.max(w.start, Math.min(...hits.map((p) => Date.parse(p.start))));
    const end = Math.min(w.end, Math.max(...hits.map((p) => Date.parse(p.end))));
    const what =
      rule.agg === "sum" ? "forecast total" : rule.agg === "min" ? "forecast low" : "forecast peak";
    factors.push({
      id: rule.id,
      level,
      basis: "forecast",
      hazard: rule.hazard,
      title: rule.title,
      evidence: `${what} ${fmt(value, rule.unit)} (${levelName(level)} at ${
        rule.agg === "min" ? "≤" : "≥"
      }${fmt(threshold, rule.unit)}), ${rangeLabel(start, end, zone)}`,
      impact: rule.impact[level] || "",
      start,
      end,
    });
  }
  for (const rule of wording) {
    if (rule.unlessFactor && factors.some((f) => f.id === rule.unlessFactor)) continue;
    const hits = periods.filter(
      (p) => rule.pattern.test(p.forecast) && (!rule.onlyIfUnknown || rule.onlyIfUnknown(p) === null),
    );
    if (!hits.length) continue;
    const start = Math.max(w.start, Date.parse(hits[0].start));
    const end = Math.min(w.end, Date.parse(hits[hits.length - 1].end));
    factors.push({
      id: rule.id,
      level: rule.level,
      basis: "forecast",
      hazard: rule.hazard,
      title: rule.title,
      evidence: `NWS hourly wording “${hits[0].forecast}”, ${rangeLabel(start, end, zone)}`,
      impact: rule.impact,
      start,
      end,
    });
  }
  return factors;
}

// ---------- Official alerts ----------

const IMMEDIATE =
  /tornado (warning|emergency)|severe thunderstorm warning|flash flood (warning|emergency)|extreme wind warning|snow squall warning|dust storm warning|storm surge warning|hurricane warning|tsunami warning/i;
const CRITICAL_EVENTS =
  /tornado (warning|emergency)|flash flood emergency|extreme wind warning|hurricane warning|storm surge warning|tsunami warning/i;

export function alertKind(event: string): Alert["kind"] {
  if (/warning|emergency/i.test(event)) return "warning";
  if (/watch/i.test(event)) return "watch";
  if (/advisory/i.test(event)) return "advisory";
  if (/statement|outlook/i.test(event)) return "statement";
  return "other";
}

export function alertHazard(event: string): Hazard | null {
  const e = event.toLowerCase();
  if (e.includes("tornado")) return "tornado";
  if (e.includes("thunderstorm")) return "thunderstorm";
  if (/flood/.test(e)) return "flood";
  if (/ice storm|freezing (rain|drizzle|fog|spray)/.test(e)) return "ice";
  if (/winter|blizzard|snow|lake effect/.test(e)) return "winter";
  if (/wind chill|extreme cold|cold weather|freeze|frost/.test(e)) return "cold";
  if (/heat/.test(e)) return "heat";
  if (/wind|gale|storm warning|hurricane|tropical/.test(e)) return "wind";
  return null;
}

/** Level Storm Signal assigns when an official alert is in effect. Not an NWS rating. */
export function alertLevel(a: Alert): Level {
  if (CRITICAL_EVENTS.test(a.event) || (a.kind === "warning" && a.severity === "Extreme"))
    return "critical";
  if (a.kind === "warning") return "high";
  if (a.kind === "watch") return "elevated";
  return "moderate";
}

export const alertStart = (a: Alert) => Date.parse(a.onset || a.sent);
export const alertEnd = (a: Alert) => Date.parse(a.ends || a.expires);

export function alertsIn(weather: Weather, w: Window) {
  return weather.alerts.filter((a) => alertStart(a) < w.end && alertEnd(a) > w.start);
}

/** An alert in effect right now that calls for immediate protective action. */
export function urgentAlert(weather: Weather, now: number): Alert | null {
  return (
    weather.alerts.find(
      (a) =>
        (IMMEDIATE.test(a.event) || (a.kind === "warning" && a.urgency === "Immediate")) &&
        alertStart(a) <= now &&
        Date.parse(a.expires) > now,
    ) || null
  );
}

export function alertFactors(weather: Weather, w: Window): Factor[] {
  const zone = weather.location.timeZone;
  return alertsIn(weather, w).map((a) => {
    const level = alertLevel(a);
    return {
      id: "alert:" + a.id,
      level,
      basis: "official" as const,
      hazard: alertHazard(a.event),
      title: a.event,
      evidence: `official NWS ${a.kind} in effect ${rangeLabel(
        Math.max(alertStart(a), w.start),
        alertEnd(a),
        zone,
      )}; NWS severity “${a.severity || "not given"}”`,
      impact: `Storm Signal rates an active ${a.kind} as at least ${levelName(level)}. Follow the alert's own instructions.`,
      start: alertStart(a),
      end: alertEnd(a),
    };
  });
}

export function sortFactors(f: Factor[]) {
  return f.sort(
    (a, b) =>
      rank(b.level) - rank(a.level) ||
      (a.basis === "official" ? -1 : 0) - (b.basis === "official" ? -1 : 0) ||
      (a.start ?? 0) - (b.start ?? 0),
  );
}

/** Standard data-availability limitations shared by both engines. */
export function availabilityLimits(weather: Weather, w: Window, out: string[]) {
  const periods = periodsIn(weather, w);
  if (!weather.availability.forecast)
    out.push("The NWS hourly forecast could not be retrieved, so forecast conditions are unknown.");
  else if (!covered(periods, w))
    out.push("The retrieved forecast does not cover this whole time window.");
  if (!weather.availability.grid && weather.availability.forecast)
    out.push(
      "NWS gridpoint data (gusts, thunder chance, snow and ice amounts) could not be retrieved; those factors are unknown.",
    );
  if (!weather.availability.alerts)
    out.push("Official NWS alerts could not be retrieved. Warning status is unknown.");
}

/** Missing inputs that make "Low" impossible to claim honestly. */
export function blocksLow(weather: Weather, w: Window) {
  return (
    !weather.availability.forecast ||
    !weather.availability.alerts ||
    !weather.availability.grid ||
    !covered(periodsIn(weather, w), w)
  );
}
