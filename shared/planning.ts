import type { Weather, Window, Period } from "./types";
export const HOUR = 3600000;
export function overlaps(start: number, end: number, window: Window) {
  return start < window.end && end > window.start;
}
export function timeLabel(time: number, zone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  }).format(time);
}
export function dateLabel(time: number, zone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: zone,
  }).format(time);
}
export function periodWeather(p: Period) {
  return /thunderstorm|snow|freezing|ice pellets|sleet|blizzard/i.test(
    p.forecast,
  );
}
export function forecastWindows(weather: Weather, anchor: number): Window[] {
  const end = anchor + 12 * HOUR;
  // Derived from the NWS weather wording. These are not severe-weather risk ratings.
  const windows = weather.periods
    .filter(
      (p) =>
        periodWeather(p) &&
        Date.parse(p.end) > anchor &&
        Date.parse(p.start) < end,
    )
    .map((p) => ({
      start: Math.max(anchor, Date.parse(p.start)),
      end: Math.min(end, Date.parse(p.end)),
      label: p.forecast,
    }));
  return windows.reduce<Window[]>((all, w) => {
    const last = all.at(-1);
    if (last && last.end === w.start) {
      last.end = w.end;
      if (!last.label.includes(w.label)) last.label += " / " + w.label;
    } else all.push({ ...w });
    return all;
  }, []);
}
export function urgentWarning(weather: Weather, now: number) {
  return weather.alerts.find(
    (a) => /warning|emergency/i.test(a.event) && Date.parse(a.expires) > now,
  );
}
export function comparePlan(
  weather: Weather,
  start: number,
  minutes: number,
  anchor: number,
) {
  if (urgentWarning(weather, anchor))
    return {
      title: "Official warning takes priority",
      detail:
        "Follow the NWS instructions in the alert above. Do not delay protective action to finish this activity.",
    };
  if (!weather.availability.forecast)
    return {
      title: "Forecast unavailable",
      detail:
        "This start time cannot be assessed. Check the official forecast and alerts.",
    };
  const end = start + minutes * 60000;
  const periods = weather.periods.filter(
    (p) => Date.parse(p.start) < end && Date.parse(p.end) > start,
  );
  const sorted = [...periods].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  let covered = start;
  for (const p of sorted) {
    if (Date.parse(p.start) > covered) break;
    covered = Math.max(covered, Date.parse(p.end));
  }
  if (covered < end)
    return {
      title: "Incomplete forecast coverage",
      detail:
        "Some of this activity falls outside the retrieved forecast. No comparison is available.",
    };
  const hits = forecastWindows(weather, anchor).filter((w) =>
    overlaps(start, end, w),
  );
  const evidence = Array.from(new Set(periods.map((p) => p.forecast))).join(
    " / ",
  );
  return {
    title: hits.length
      ? "Overlaps forecast weather"
      : "No flagged weather overlap",
    detail:
      evidence +
      ". " +
      (weather.availability.alerts
        ? "Timing does not establish safety."
        : "Alert retrieval failed; warning status is unknown."),
  };
}
export function isStale(weather: Weather, now: number) {
  return (
    now - Date.parse(weather.fetchedAt) > 10 * 60000 ||
    !Number.isFinite(Date.parse(weather.fetchedAt))
  );
}
