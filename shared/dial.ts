import type { Assessment, Weather } from "./types";
import type { OptionResult } from "./impactEngine";
import { hourlySignal, peakRun } from "./ribbon";
import { HOUR } from "./rules";

/** One revolution is exactly twelve elapsed hours, including across midnight and DST. */
export function dialModel(weather: Weather, assessment: Assessment, options: OptionResult[]) {
  const start = assessment.windowStart;
  const end = start + 12 * HOUR;
  const hours = hourlySignal(weather, assessment, 12);
  return {
    start,
    end,
    hours,
    peak: peakRun(hours, assessment.factors),
    markers: options.filter((o) => o.start >= start && o.start < end),
    outside: options.filter((o) => o.start < start || o.start >= end),
  };
}
