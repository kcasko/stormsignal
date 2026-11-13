import type { Weather } from "./types";
/** Live data older than this is shown with an explicit stale notice. */
export const STALE_MS = 10 * 60000;
export function isStale(weather: Weather, now: number) {
  const t = Date.parse(weather.fetchedAt);
  return !Number.isFinite(t) || now - t > STALE_MS;
}
