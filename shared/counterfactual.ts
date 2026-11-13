// "What would change the level": the smallest forecast changes that would lower the classification.
import type { Classification, Factor, Level } from "./types";
import { levelName, maxLevel } from "./rules";

const show = (v: number, unit: string) =>
  unit === "in" ? `${v < 0.1 ? v.toFixed(2) : v.toFixed(1)} in` : `${Math.round(v)}${unit}`;

export interface Counterfactual {
  /** e.g. "Would be Moderate if…" */
  headline: string;
  conditions: string[];
}

export function whatWouldChange(level: Classification, factors: Factor[]): Counterfactual | null {
  if (level === "unknown" || level === "low" || !factors.length) return null;
  const top = factors.filter((f) => f.level === level);
  const official = top.find((f) => f.basis === "official");
  if (official)
    return {
      headline: `Stays at least ${levelName(level)} while the official ${official.title} is in effect.`,
      conditions: ["Only NWS can end, cancel or downgrade an official alert."],
    };
  const rest = factors.filter((f) => f.level !== level).map((f) => f.level);
  const lowered = top.map((f) => f.measure?.lower ?? null).filter((l): l is Level => !!l);
  const next = maxLevel([...rest, ...lowered]) ?? "low";
  const conditions = top.map((f) =>
    f.measure
      ? `${f.title} ${f.measure.cmp === "≥" ? "stayed below" : "stayed above"} ${show(f.measure.threshold, f.measure.unit)} (forecast: ${show(
          f.measure.value,
          f.measure.unit,
        )})`
      : `NWS dropped the “${f.title.replace(/ in forecast$/i, "").toLowerCase()}” wording from the forecast`,
  );
  return {
    headline: `Would be ${levelName(next)} if ${top.length > 1 ? "all of these changed" : "this changed"}:`,
    conditions,
  };
}
