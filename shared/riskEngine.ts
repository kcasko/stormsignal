// Storm Signal overview classification. A documented, rule-based summary of the
// next 24 hours. It is NOT an official NWS rating and does not predict damage.
import type { Assessment, Hazard, Weather } from "./types";
import {
  HOUR,
  Rule,
  WordingRule,
  alertFactors,
  availabilityLimits,
  blocksLow,
  evaluateRules,
  levelName,
  maxLevel,
  sortFactors,
  urgentAlert,
} from "./rules";

/**
 * Thresholds. Wind values follow common NWS advisory/warning criteria
 * (Wind Advisory: sustained ≥31 mph or gusts ≥46 mph; High Wind Warning and
 * severe thunderstorm gust criterion: ≥58 mph). Others are Storm Signal choices,
 * documented in docs/architecture.md.
 */
export const OVERVIEW_RULES: Rule[] = [
  {
    id: "gust",
    hazard: "wind",
    layer: "grid",
    metric: (p) => p.gustMph,
    agg: "max",
    unit: " mph",
    thresholds: [
      ["critical", 75],
      ["high", 58],
      ["elevated", 46],
      ["moderate", 30],
    ],
    title: "Wind gusts",
    impact: {
      critical: "Gusts this strong can cause widespread damage.",
      high: "Gusts at this level can down trees and power lines.",
      elevated: "Loose objects can blow around; isolated outages are possible.",
      moderate: "Noticeable gusts; unsecured light objects may move.",
    },
  },
  {
    id: "wind",
    hazard: "wind",
    layer: "hourly",
    metric: (p) => p.windMph,
    agg: "max",
    unit: " mph",
    thresholds: [
      ["high", 40],
      ["elevated", 31],
      ["moderate", 25],
    ],
    title: "Sustained wind",
    impact: {},
  },
  {
    id: "thunder",
    hazard: "thunderstorm",
    layer: "grid",
    metric: (p) => p.thunderChance,
    agg: "max",
    unit: "%",
    thresholds: [
      ["elevated", 40],
      ["moderate", 15],
    ],
    title: "Thunder chance",
    impact: {
      elevated: "Lightning is likely nearby at times. Thunder chance alone does not indicate severe storms.",
      moderate: "Some lightning risk. Thunder chance alone does not indicate severe storms.",
    },
  },
  {
    id: "snow",
    hazard: "winter",
    layer: "grid",
    metric: (p) => p.snowIn,
    agg: "sum",
    unit: "in",
    thresholds: [
      ["high", 8],
      ["elevated", 4],
      ["moderate", 1],
    ],
    title: "Snowfall",
    impact: {
      high: "Heavy snow can make travel very difficult.",
      elevated: "Expect slippery roads and slower travel.",
      moderate: "Some roads may become slippery.",
    },
  },
  {
    id: "ice",
    hazard: "ice",
    layer: "grid",
    metric: (p) => p.iceIn,
    agg: "sum",
    unit: "in",
    thresholds: [
      ["high", 0.25],
      ["elevated", 0.01],
    ],
    title: "Ice accumulation",
    impact: {
      high: "Ice at this amount can bring down limbs and power lines.",
      elevated: "Any ice glaze makes roads and walkways hazardous.",
    },
  },
  {
    id: "heat",
    hazard: "heat",
    layer: "grid",
    metric: (p) => p.apparentF,
    agg: "max",
    unit: "°F",
    thresholds: [
      ["high", 115],
      ["elevated", 105],
      ["moderate", 95],
    ],
    title: "Feels-like temperature",
    impact: { high: "Dangerous heat.", elevated: "Heat illness is possible with exertion.", moderate: "Hot; limit exertion." },
  },
  {
    id: "cold",
    hazard: "cold",
    layer: "grid",
    metric: (p) => p.apparentF,
    agg: "min",
    unit: "°F",
    thresholds: [
      ["high", -35],
      ["elevated", -20],
      ["moderate", 0],
    ],
    title: "Feels-like low",
    impact: {
      high: "Frostbite can occur within minutes on exposed skin.",
      elevated: "Frostbite is possible on exposed skin.",
      moderate: "Very cold; dress in layers.",
    },
  },
];

export const OVERVIEW_WORDING: WordingRule[] = [
  {
    id: "w-thunder",
    hazard: "thunderstorm",
    pattern: /thunderstorm|t-storm/i,
    level: "moderate",
    title: "Thunderstorms in forecast",
    impact: "Lightning is possible.",
    unlessFactor: "thunder",
        onlyIfUnknown: (p) => p.thunderChance,
  },
  {
    id: "w-ice",
    hazard: "ice",
    pattern: /freezing rain|freezing drizzle|sleet|ice pellets/i,
    level: "elevated",
    title: "Freezing precipitation in forecast",
    impact: "Icy surfaces are possible.",
    unlessFactor: "ice",
  },
  {
    id: "w-blizzard",
    hazard: "winter",
    pattern: /blizzard/i,
    level: "high",
    title: "Blizzard wording in forecast",
    impact: "Blowing snow can reduce visibility to near zero.",
  },
  {
    id: "w-snow",
    hazard: "winter",
    pattern: /snow/i,
    level: "moderate",
    title: "Snow in forecast",
    impact: "Surfaces may become slippery.",
    unlessFactor: "snow",
        onlyIfUnknown: (p) => p.snowIn,
  },
];

export function assess(weather: Weather, now: number, hours = 24): Assessment {
  const w = { start: now, end: now + hours * HOUR };
  const limitations: string[] = [];
  availabilityLimits(weather, w, limitations);
  const factors = sortFactors([
    ...alertFactors(weather, w),
    ...(weather.availability.forecast
      ? evaluateRules(weather, w, OVERVIEW_RULES, OVERVIEW_WORDING, limitations)
      : []),
  ]);
  const top = maxLevel(factors.map((f) => f.level));
  const urgent = urgentAlert(weather, now);
  const hazards = Array.from(
    new Set(factors.map((f) => f.hazard).filter((h): h is Hazard => h !== null)),
  );
  const incomplete = blocksLow(weather, w);
  let level: Assessment["level"];
  let summary: string;
  if (top) {
    level = top;
    const lead = factors[0];
    summary = `${levelName(top)} because ${
      lead.basis === "official"
        ? `an official ${lead.title} is in effect`
        : `of ${lead.title.toLowerCase()}: ${lead.evidence}`
    }.`;
    if (incomplete) summary += " Some data is missing, so conditions could be worse than shown.";
  } else if (incomplete) {
    level = "unknown";
    summary =
      "Not enough data to classify. Missing or incomplete NWS data is never treated as Low.";
  } else {
    level = "low";
    summary = `No Storm Signal threshold is met in the next ${hours} hours and NWS returned no active alerts for this point. Conditions can change; this is not an all-clear.`;
  }
  return {
    level,
    summary,
    factors,
    limitations,
    hazards,
    windowStart: w.start,
    windowEnd: w.end,
    urgent,
  };
}
