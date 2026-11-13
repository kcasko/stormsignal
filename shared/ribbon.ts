import type { Assessment, Classification, Weather } from "./types";
import { HOUR, blocksLow, maxLevel, rank } from "./rules";

export interface RibbonHour {
  start: number;
  level: Classification;
}

/**
 * Splits an assessment's window into hours and gives each hour the highest
 * level among the factors that apply to it. Hours no factor touches are Low,
 * unless NWS data for that hour is missing, in which case they're Unknown.
 */
export function hourlySignal(weather: Weather, assessment: Assessment, hours = 24): RibbonHour[] {
  const first = assessment.windowStart;
  const out: RibbonHour[] = [];
  for (let i = 0; i < hours; i++) {
    const start = first + i * HOUR;
    const end = start + HOUR;
    const hit = maxLevel(
      assessment.factors
        .filter((f) => (f.start ?? -Infinity) < end && (f.end ?? Infinity) > start)
        .map((f) => f.level),
    );
    const level: Classification = hit ?? (blocksLow(weather, { start, end }) ? "unknown" : "low");
    out.push({ start, level });
  }
  return out;
}

/** The first contiguous run at the highest level in the ribbon, or null if every hour is Low or Unknown. */
export function peakRun(ribbon: RibbonHour[]): { level: Classification; start: number; end: number } | null {
  const known = ribbon.filter((h) => h.level !== "unknown" && h.level !== "low");
  if (!known.length) return null;
  const top = known.reduce((a, h) => (rank(h.level as never) > rank(a.level as never) ? h : a)).level;
  const i = ribbon.findIndex((h) => h.level === top);
  let j = i;
  while (j + 1 < ribbon.length && ribbon[j + 1].level === top) j++;
  return { level: top, start: ribbon[i].start, end: ribbon[j].start + HOUR };
}
