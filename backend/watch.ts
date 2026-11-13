// Operator-configured, opt-in email forecast watch. Not an emergency alert service.
import type { Classification } from "../shared/types";
import type { Snapshot, SnapshotHour } from "../shared/drift";
import { locations } from "../shared/locations";

const ORDER: Classification[] = ["unknown", "low", "moderate", "elevated", "high", "critical"];
const HOUR = 3600000;
type Metric = "g" | "w" | "th" | "s" | "i";
const METRICS: { key: Metric; label: string; unit: string; kind: "max" | "sum"; minimum: number }[] = [
  { key: "g", label: "Peak wind gusts", unit: "mph", kind: "max", minimum: 5 },
  { key: "w", label: "Peak sustained wind", unit: "mph", kind: "max", minimum: 5 },
  { key: "th", label: "Peak thunder chance", unit: "%", kind: "max", minimum: 10 },
  { key: "s", label: "Snow total", unit: "in", kind: "sum", minimum: 0.5 },
  { key: "i", label: "Ice total", unit: "in", kind: "sum", minimum: 0.05 },
];

export interface WatchEvent {
  location: string;
  name: string;
  before: Classification;
  after: Classification;
  capturedAt: string;
  details?: string[];
}

function formatValue(value: number, unit: string): string {
  return unit === "in" ? `${Number(value.toFixed(2))} in` : `${Math.round(value)}${unit === "%" ? "%" : " mph"}`;
}

function localTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(iso));
}

/** Compare only shared, still-future forecast hours. Never manufacture a missing data point. */
export function explainWatchChange(prior: Snapshot, next: Snapshot, timeZone: string): string[] {
  const start = Date.parse(next.capturedAt);
  const end = start + 24 * HOUR;
  const beforeByHour = new Map(prior.hours.map(h => [h.t, h]));
  const pairs: { before: SnapshotHour; after: SnapshotHour }[] = next.hours
    .filter(h => Date.parse(h.t) >= start && Date.parse(h.t) < end && beforeByHour.has(h.t))
    .map(h => ({ before: beforeByHour.get(h.t)!, after: h }));
  if (!pairs.length) return ["The risk level rose, but matching forecast hours were unavailable to explain the change."];

  const evidence: { description: string; increase: number }[] = [];
  for (const metric of METRICS) {
    const valid = pairs.filter(p => p.before[metric.key] !== null && p.after[metric.key] !== null);
    if (!valid.length) continue;
    const aggregate = (values: number[]) =>
      metric.kind === "max" ? Math.max(...values) : values.reduce((a, b) => a + b, 0);
    const before = aggregate(valid.map(p => p.before[metric.key] as number));
    const after = aggregate(valid.map(p => p.after[metric.key] as number));
    const increase = after - before;
    if (increase < metric.minimum) continue;

    const peak = metric.kind === "max"
      ? valid.reduce((a, b) => (b.after[metric.key] as number) > (a.after[metric.key] as number) ? b : a)
      : valid.find(p => (p.after[metric.key] as number) > (p.before[metric.key] as number))!;
    evidence.push({
      increase,
      description: `${metric.label}: ${formatValue(before, metric.unit)} -> ${formatValue(after, metric.unit)} for matching forecast hours; ${metric.kind === "max" ? "peak" : "increase"} near ${localTime(peak.after.t, timeZone)}.`,
    });
  }
  return evidence.length ? evidence.slice(0, 3).map(e => e.description)
    : ["The risk level rose, but no comparable weather metric increased enough to report; review official alerts and the full forecast."];
}

/** Only email if both classifications are known and the new level is strictly higher. */
export function watchChange(location: string, prior: Snapshot | undefined, next: Snapshot, selected: string): WatchEvent | null {
  if (!selected || selected !== location || !prior || prior.level === "unknown" || next.level === "unknown") return null;
  if (ORDER.indexOf(next.level) <= ORDER.indexOf(prior.level)) return null;
  const info = locations.find(l => l.id === location);
  return {
    location, name: info?.name ?? location, before: prior.level, after: next.level,
    capturedAt: next.capturedAt,
    details: explainWatchChange(prior, next, info?.timeZone ?? "America/New_York"),
  };
}

export function watchMessage(event: WatchEvent): string {
  return [
    `Storm Signal forecast update for ${event.name}`,
    `Risk level increased: ${event.before} -> ${event.after}.`,
    "",
    "WHAT CHANGED",
    ...(event.details?.length ? event.details : ["Forecast details unavailable. Review the live forecast."]),
    "",
    "WHAT TO DO",
    "Check current official NWS alerts and their instructions before making weather-related plans.",
    "",
    `Checked: ${event.capturedAt}.`,
    "Review the latest forecast and official NWS warnings:",
    `https://d3p9tcn7282g7r.cloudfront.net/#overview?loc=${encodeURIComponent(event.location)}`,
    "",
    "This is a forecast planning update, not an emergency warning. It may be delayed by 30 minutes or more.",
    "Always follow official NWS alerts and local authorities. Do not rely on this email for imminent danger.",
  ].join("\n");
}

export type WatchPublisher = (event: WatchEvent) => Promise<void>;

export function snsPublisher(topicArn: string): WatchPublisher {
  return async event => {
    const { SNSClient, PublishCommand } = await import("@aws-sdk/client-sns");
    const sns = new SNSClient({});
    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: `Storm Signal: ${event.name} risk increased to ${event.after}`.slice(0, 100),
      Message: watchMessage(event),
    }));
  };
}
