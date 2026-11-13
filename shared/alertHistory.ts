// Alert lifecycle: when each alert was issued, updated, extended, upgraded, cancelled or expired.
// Built from NWS's own "references" on current alerts (works for any place) plus saved snapshots
// (the listed cities), which are what reveal alerts that have since ended. Deterministic.
import type { Alert } from "./types";
import { alertKey, type Snapshot, type SnapshotAlert } from "./drift";

export interface TimelineEvent {
  at: number;
  label: string;
  /** Event hasn't happened yet (a scheduled end). */
  future?: boolean;
  detail?: string;
}
export type AlertState = "active" | "expired" | "cancelled" | "upgraded" | "ended-early";
export interface AlertStory {
  key: string;
  event: string;
  kind: string;
  state: AlertState;
  events: TimelineEvent[];
}

const ACTION_LABEL: Record<string, string> = {
  EXT: "Extended",
  EXA: "Area expanded",
  EXB: "Extended and area expanded",
  UPG: "Upgraded",
  CAN: "Cancelled",
  EXP: "Set to expire",
  COR: "Corrected",
};
/** For the first message: "Issued" when it is the original, or "In effect" when only a later update was seen. */
const label = (action: string | null | undefined, first: boolean, original = !action || action === "NEW") =>
  first ? (original ? "Issued" : "In effect") : (action && ACTION_LABEL[action]) || "Updated";

/** Sent times for one alert key across references and snapshots, oldest first, de-duplicated. */
function sentTimes(times: (string | undefined)[]) {
  return Array.from(new Set(times.filter((t): t is string => !!t).map((t) => Date.parse(t)).filter(Number.isFinite))).sort(
    (a, b) => a - b,
  );
}

function seenIn(snaps: Snapshot[], key: string): SnapshotAlert[] {
  return snaps.flatMap((s) => s.alerts?.filter((a) => a.key === key) ?? []);
}

export function activeStory(alert: Alert, snaps: Snapshot[], now: number): AlertStory {
  const key = alertKey(alert);
  const seen = seenIn(snaps, key);
  const times = sentTimes([...alert.previous, ...seen.map((a) => a.sent), alert.sent]);
  const current = Date.parse(alert.sent);
  const events: TimelineEvent[] = times.map((t, i) => {
    const action = t === current ? alert.vtec?.action : seen.find((a) => Date.parse(a.sent) === t)?.action;
    return { at: t, label: label(action, i === 0, alert.previous.length > 0 || !action || action === "NEW") };
  });
  const end = Date.parse(alert.ends || alert.expires);
  if (end > now) events.push({ at: end, label: alert.ends ? "Scheduled to end" : "Message expires", future: true });
  return { key, event: alert.event, kind: alert.kind, state: "active", events };
}

/**
 * Alerts seen in saved snapshots that are no longer active. Only snapshots that recorded alerts
 * count, and nothing is inferred when the current alert list is unavailable.
 */
export function endedStories(current: Alert[] | null, snaps: Snapshot[], now: number): AlertStory[] {
  if (current === null) return [];
  const tracked = snaps.filter((s) => s.alerts !== undefined).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const activeKeys = new Set(current.map(alertKey));
  const keys = Array.from(new Set(tracked.flatMap((s) => s.alerts!.map((a) => a.key)))).filter((k) => !activeKeys.has(k));
  return keys
    .map((key) => {
      const lastIdx = tracked.map((s) => s.alerts!.some((a) => a.key === key)).lastIndexOf(true);
      const last = tracked[lastIdx].alerts!.find((a) => a.key === key)!;
      const lastSeenAt = Date.parse(tracked[lastIdx].capturedAt);
      const goneBy = lastIdx + 1 < tracked.length ? Date.parse(tracked[lastIdx + 1].capturedAt) : now;
      const seen = seenIn(tracked, key);
      const events: TimelineEvent[] = sentTimes(seen.map((a) => a.sent)).map((t, i) => ({
        at: t,
        label: label(seen.find((a) => Date.parse(a.sent) === t)?.action, i === 0),
      }));
      const end = Date.parse(last.ends);
      let state: AlertState;
      if (last.action === "CAN") {
        state = "cancelled";
        if (events.at(-1)?.label !== "Cancelled") events.push({ at: Date.parse(last.sent), label: "Cancelled" });
      } else if (last.action === "UPG") {
        state = "upgraded";
      } else if (end <= goneBy) {
        state = "expired";
        events.push({ at: end, label: "Expired" });
      } else {
        state = "ended-early";
        events.push({
          at: goneBy,
          label: "No longer listed by NWS",
          detail: "Dropped between saved checks, before its scheduled end. It may have been cancelled.",
        });
      }
      return { key, event: last.event, kind: last.kind, state, events, lastSeenAt };
    })
    .sort((a, b) => (b.events.at(-1)?.at ?? b.lastSeenAt) - (a.events.at(-1)?.at ?? a.lastSeenAt))
    .map(({ lastSeenAt: _, ...story }) => story);
}
