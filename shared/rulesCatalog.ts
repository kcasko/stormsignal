// Machine-readable export of every Storm Signal rule (served at /api/rules), so others can audit or reuse them.
import { LEVELS } from "./types";
import type { Rule, WordingRule } from "./rules";
import { OVERVIEW_RULES, OVERVIEW_WORDING } from "./riskEngine";
import { ACTIVITIES } from "./impactEngine";

export const RULES_VERSION = "2026-11-13";

const rule = (r: Rule) => ({
  id: r.id,
  title: r.title,
  hazard: r.hazard,
  source: r.layer === "grid" ? "NWS gridpoint data" : "NWS hourly forecast",
  aggregation: r.agg === "sum" ? "total over window" : r.agg === "min" ? "lowest hour" : "highest hour",
  unit: r.unit.trim(),
  thresholds: r.thresholds.map(([level, value]) => ({ level, [r.agg === "min" ? "atOrBelow" : "atOrAbove"]: value })),
});
const wording = (w: WordingRule) => ({
  id: w.id,
  title: w.title,
  hazard: w.hazard,
  level: w.level,
  pattern: w.pattern.source,
  appliesOnlyWhenNumericMissing: !!w.onlyIfUnknown,
});

export function rulesCatalog() {
  return {
    name: "Storm Signal rules",
    version: RULES_VERSION,
    note: "Storm Signal's own documented classification of NWS data. Not an official NWS rating. Deterministic; no machine learning.",
    levels: [...LEVELS],
    unknown: "Reported instead of Low whenever forecast, gridpoint data or alerts are missing, or the forecast doesn't cover the window.",
    officialAlerts: {
      advisory: "moderate",
      statement: "moderate",
      watch: "elevated",
      warning: "high",
      critical: "Tornado warning/emergency, flash flood emergency, extreme wind, hurricane, storm surge, tsunami warnings, or any warning with NWS severity Extreme",
      overridesComparisons:
        "Tornado, severe thunderstorm, flash flood, extreme wind, snow squall, dust storm, storm surge, hurricane and tsunami warnings, or urgency Immediate",
    },
    overview: { window: "next 24 hours", rules: OVERVIEW_RULES.map(rule), wording: OVERVIEW_WORDING.map(wording) },
    activities: Object.fromEntries(
      Object.entries(ACTIVITIES).map(([id, a]) => [
        id,
        { label: a.label, durationsHours: a.durations, rules: a.rules.map(rule), wording: a.wording.map(wording), notes: a.notes },
      ]),
    ),
  };
}
