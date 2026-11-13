// Activity exposure for the What If? comparison. Deterministic rules only.
// It compares forecast evidence between time windows; it never declares a time "safe",
// estimates accident probability, or infers road conditions that were not retrieved.
import type { Alert, Classification, Factor, Hazard, Level, Weather } from "./types";
import {
  HOUR,
  Rule,
  WordingRule,
  alertFactors,
  alertStart,
  availabilityLimits,
  blocksLow,
  evaluateRules,
  levelName,
  maxLevel,
  periodsIn,
  rangeLabel,
  rank,
  sortFactors,
  urgentAlert,
} from "./rules";

export type Activity = "driving" | "event" | "home";

const gust = (p: { gustMph: number | null }) => p.gustMph;

interface ActivitySpec {
  label: string;
  optionVerb: string;
  durations: number[];
  defaultHours: number;
  rules: Rule[];
  wording: WordingRule[];
  /** Always-present caveats specific to the activity. */
  notes: string[];
}

export const ACTIVITIES: Record<Activity, ActivitySpec> = {
  driving: {
    label: "Driving or commuting",
    optionVerb: "Leave",
    durations: [0.5, 1, 2, 4],
    defaultHours: 1,
    notes: [
      "Road conditions, closures and traffic were not retrieved. Check your state 511 service.",
    ],
    rules: [
      {
        id: "gust",
        hazard: "wind",
        layer: "grid",
        metric: gust,
        agg: "max",
        unit: " mph",
        thresholds: [
          ["high", 58],
          ["elevated", 40],
          ["moderate", 30],
        ],
        title: "Wind gusts",
        impact: {
          high: "Gusts this strong can push vehicles off course and down trees across roads.",
          elevated: "Crosswinds can be difficult, especially for high-profile vehicles and trailers.",
          moderate: "Gusty crosswinds are possible, mainly for high-profile vehicles.",
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
          ["high", 2],
          ["elevated", 0.5],
          ["moderate", 0.1],
        ],
        title: "Snowfall during the drive",
        impact: {
          high: "Snow at this rate can quickly cover roads and cut visibility.",
          elevated: "Roads may become snow-covered and slippery.",
          moderate: "Light snow can still make untreated roads slick.",
        },
      },
      {
        id: "ice",
        hazard: "ice",
        layer: "grid",
        metric: (p) => p.iceIn,
        agg: "sum",
        unit: "in",
        thresholds: [["high", 0.01]],
        title: "Ice accumulation",
        impact: { high: "Any ice glaze makes roads and bridges extremely slippery." },
      },
      {
        id: "thunder",
        hazard: "thunderstorm",
        layer: "grid",
        metric: (p) => p.thunderChance,
        agg: "max",
        unit: "%",
        thresholds: [
          ["elevated", 50],
          ["moderate", 15],
        ],
        title: "Thunder chance",
        impact: {
          elevated: "Storms can bring heavy rain, sudden low visibility and ponding on roads.",
          moderate: "Storms may cause brief heavy rain and lower visibility.",
        },
      },
    ],
    wording: [
      {
        id: "w-freezing",
        hazard: "ice",
        pattern: /freezing rain|freezing drizzle|sleet|ice pellets/i,
        level: "high",
        title: "Freezing precipitation in forecast",
        impact: "Icy roads are possible.",
        unlessFactor: "ice",
      },
      {
        id: "w-blizzard",
        hazard: "winter",
        pattern: /blizzard/i,
        level: "high",
        title: "Blizzard wording",
        impact: "Visibility can drop to near zero.",
      },
      {
        id: "w-snow",
        hazard: "winter",
        pattern: /snow/i,
        level: "moderate",
        title: "Snow in forecast",
        impact: "Roads may be slippery.",
        unlessFactor: "snow",
        onlyIfUnknown: (p) => p.snowIn,
      },
      {
        id: "w-thunder",
        hazard: "thunderstorm",
        pattern: /thunderstorm/i,
        level: "moderate",
        title: "Thunderstorms in forecast",
        impact: "Heavy rain can reduce visibility.",
        unlessFactor: "thunder",
        onlyIfUnknown: (p) => p.thunderChance,
      },
      {
        id: "w-fog",
        hazard: "winter",
        pattern: /fog/i,
        level: "moderate",
        title: "Fog in forecast",
        impact: "Visibility may be reduced.",
      },
    ],
  },
  event: {
    label: "Hosting an outdoor event",
    optionVerb: "Start",
    durations: [1, 2, 3, 4, 6],
    defaultHours: 3,
    notes: [
      "Plan where guests will go if thunder is heard. A tent or open shelter does not protect from lightning.",
    ],
    rules: [
      {
        id: "thunder",
        hazard: "thunderstorm",
        layer: "grid",
        metric: (p) => p.thunderChance,
        agg: "max",
        unit: "%",
        thresholds: [
          ["high", 50],
          ["elevated", 25],
          ["moderate", 10],
        ],
        title: "Thunder chance",
        impact: {
          high: "Lightning is likely during the event. Everyone outdoors needs substantial shelter.",
          elevated: "Lightning is a real possibility; plan to move people indoors.",
          moderate: "Lightning is possible. When thunder roars, go indoors.",
        },
      },
      {
        id: "gust",
        hazard: "wind",
        layer: "grid",
        metric: gust,
        agg: "max",
        unit: " mph",
        thresholds: [
          ["high", 50],
          ["elevated", 35],
          ["moderate", 25],
        ],
        title: "Wind gusts",
        impact: {
          high: "Gusts this strong can lift tents and throw equipment.",
          elevated: "Tents, canopies and signs can become airborne without heavy anchoring.",
          moderate: "Canopies and decorations need secure anchoring.",
        },
      },
      {
        id: "rain",
        hazard: "thunderstorm",
        layer: "hourly",
        metric: (p) => p.precipitation,
        agg: "max",
        unit: "%",
        thresholds: [["moderate", 40]],
        title: "Precipitation chance",
        impact: { moderate: "Plan cover for guests and equipment." },
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
          ["elevated", 103],
          ["moderate", 90],
        ],
        title: "Feels-like temperature",
        impact: {
          high: "Dangerous heat for anyone outdoors.",
          elevated: "Heat illness is possible; provide shade and water.",
          moderate: "Provide shade and water.",
        },
      },
      {
        id: "cold",
        hazard: "cold",
        layer: "grid",
        metric: (p) => p.apparentF,
        agg: "min",
        unit: "°F",
        thresholds: [
          ["high", -20],
          ["elevated", 0],
          ["moderate", 20],
        ],
        title: "Feels-like low",
        impact: {
          high: "Frostbite can occur quickly.",
          elevated: "Frostbite is possible on exposed skin.",
          moderate: "Guests will need warm layers or a heated space.",
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
          ["elevated", 2],
          ["moderate", 0.5],
        ],
        title: "Snowfall",
        impact: { elevated: "Guests' travel may be affected.", moderate: "Walkways may be slippery." },
      },
    ],
    wording: [
      {
        id: "w-thunder",
        hazard: "thunderstorm",
        pattern: /thunderstorm/i,
        level: "elevated",
        title: "Thunderstorms in forecast",
        impact: "Lightning is possible during the event.",
        unlessFactor: "thunder",
        onlyIfUnknown: (p) => p.thunderChance,
      },
    ],
  },
  home: {
    label: "Preparing or protecting my home",
    optionVerb: "Prepare",
    durations: [1, 2, 3],
    defaultHours: 2,
    notes: [
      "This compares conditions while you would be working outside. Finish outdoor tasks before conditions worsen; never go outside during a warning.",
    ],
    rules: [
      {
        id: "gust",
        hazard: "wind",
        layer: "grid",
        metric: gust,
        agg: "max",
        unit: " mph",
        thresholds: [
          ["high", 58],
          ["elevated", 46],
          ["moderate", 30],
        ],
        title: "Wind gusts",
        impact: {
          high: "Too strong to work outside safely; falling limbs and flying debris are likely.",
          elevated: "Loose objects become projectiles; securing them gets harder as gusts build.",
          moderate: "Secure loose items before gusts strengthen.",
        },
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
          elevated: "Lightning may interrupt outdoor work; finish earlier.",
          moderate: "Stop outdoor work and go inside if thunder is heard.",
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
          high: "Ice at this amount can break limbs and lines; outages are possible.",
          elevated: "Walkways and steps will be slippery.",
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
          ["elevated", 4],
          ["moderate", 1],
        ],
        title: "Snowfall",
        impact: { elevated: "Clearing will take longer; pace yourself.", moderate: "Plan time to clear walkways." },
      },
      {
        id: "cold",
        hazard: "cold",
        layer: "grid",
        metric: (p) => p.apparentF,
        agg: "min",
        unit: "°F",
        thresholds: [
          ["elevated", -10],
          ["moderate", 10],
        ],
        title: "Feels-like low",
        impact: {
          elevated: "Limit time outside; frostbite is possible.",
          moderate: "Dress for the cold; protect exposed pipes.",
        },
      },
    ],
    wording: [
      {
        id: "w-thunder",
        hazard: "thunderstorm",
        pattern: /thunderstorm/i,
        level: "moderate",
        title: "Thunderstorms in forecast",
        impact: "Go inside when thunder is heard.",
        unlessFactor: "thunder",
        onlyIfUnknown: (p) => p.thunderChance,
      },
      {
        id: "w-freezing",
        hazard: "ice",
        pattern: /freezing rain|freezing drizzle|sleet/i,
        level: "elevated",
        title: "Freezing precipitation in forecast",
        impact: "Slippery surfaces are possible.",
        unlessFactor: "ice",
      },
    ],
  },
};

export interface Conditions {
  maxGust: number | null;
  maxWind: number | null;
  maxThunder: number | null;
  maxPrecip: number | null;
  tempLow: number | null;
  tempHigh: number | null;
  snow: number | null;
  ice: number | null;
  wording: string[];
}

export interface OptionResult {
  key: string;
  label: string;
  offsetHours: number;
  start: number;
  end: number;
  level: Classification;
  factors: Factor[];
  hazards: Hazard[];
  limitations: string[];
  conditions: Conditions;
  /** Active warning requiring immediate action that overlaps this option. */
  urgent: Alert | null;
}

const peak = (xs: (number | null)[]) => {
  const k = xs.filter((x): x is number => x !== null);
  return k.length ? Math.max(...k) : null;
};

export function conditions(weather: Weather, start: number, end: number): Conditions {
  const ps = periodsIn(weather, { start, end });
  const temps = ps.map((p) => p.temperature).filter((t): t is number => t !== null);
  const total = (f: (p: (typeof ps)[number]) => number | null) => {
    const k = ps.map(f).filter((x): x is number => x !== null);
    return k.length ? k.reduce((a, b) => a + b, 0) : null;
  };
  return {
    maxGust: peak(ps.map((p) => p.gustMph)),
    maxWind: peak(ps.map((p) => p.windMph)),
    maxThunder: peak(ps.map((p) => p.thunderChance)),
    maxPrecip: peak(ps.map((p) => p.precipitation)),
    tempLow: temps.length ? Math.min(...temps) : null,
    tempHigh: temps.length ? Math.max(...temps) : null,
    snow: total((p) => p.snowIn),
    ice: total((p) => p.iceIn),
    wording: Array.from(new Set(ps.map((p) => p.forecast))),
  };
}

export function evaluateOption(
  weather: Weather,
  activity: Activity,
  start: number,
  hours: number,
  now: number,
): Omit<OptionResult, "key" | "label" | "offsetHours"> {
  const spec = ACTIVITIES[activity];
  const w = { start, end: start + hours * HOUR };
  const limitations: string[] = [];
  availabilityLimits(weather, w, limitations);
  const factors = sortFactors([
    ...alertFactors(weather, w),
    ...(weather.availability.forecast
      ? evaluateRules(weather, w, spec.rules, spec.wording, limitations)
      : []),
  ]);
  // Official alerts starting within 2 hours after the window: a delay could put you in them.
  for (const a of weather.alerts) {
    const s = alertStart(a);
    if (s >= w.end && s < w.end + 2 * HOUR)
      limitations.push(
        `The official ${a.event} begins ${rangeLabel(s, s, weather.location.timeZone).split(" – ")[0]}, soon after this window ends. Running late could put you in it.`,
      );
  }
  const top = maxLevel(factors.map((f) => f.level));
  const urgentNow = urgentAlert(weather, now);
  const urgent =
    urgentNow &&
    Date.parse(urgentNow.ends || urgentNow.expires) > w.start
      ? urgentNow
      : null;
  return {
    start: w.start,
    end: w.end,
    level: top ?? (blocksLow(weather, w) ? "unknown" : "low"),
    factors,
    hazards: Array.from(
      new Set(factors.map((f) => f.hazard).filter((h): h is Hazard => h !== null)),
    ),
    limitations,
    conditions: conditions(weather, w.start, w.end),
    urgent,
  };
}

export const OFFSETS = [0, 3, 6];

export function compareOptions(
  weather: Weather,
  activity: Activity,
  hours: number,
  now: number,
  /** Optional user-chosen start (ms), compared as option D. */
  customStart?: number | null,
): OptionResult[] {
  const spec = ACTIVITIES[activity];
  const options = OFFSETS.map((offset, i) => ({
    key: "ABC"[i],
    label: offset === 0 ? `${spec.optionVerb} now` : `${spec.optionVerb} in ${offset} hours`,
    offsetHours: offset,
    ...evaluateOption(weather, activity, now + offset * HOUR, hours, now),
  }));
  if (customStart && customStart >= now - 5 * 60000)
    options.push({
      key: "D",
      label: `${spec.optionVerb} at ${new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: weather.location.timeZone,
      }).format(customStart)}`,
      offsetHours: (customStart - now) / HOUR,
      ...evaluateOption(weather, activity, customStart, hours, now),
    });
  return options;
}

const METRICS: { key: keyof Conditions; name: string; unit: string }[] = [
  { key: "maxGust", name: "peak gust", unit: " mph" },
  { key: "maxThunder", name: "thunder chance", unit: "%" },
  { key: "snow", name: "snowfall", unit: " in" },
  { key: "ice", name: "ice", unit: " in" },
  { key: "maxWind", name: "sustained wind", unit: " mph" },
  { key: "maxPrecip", name: "precipitation chance", unit: "%" },
];

const FACTOR_METRIC: Record<string, keyof Conditions> = {
  gust: "maxGust",
  wind: "maxWind",
  thunder: "maxThunder",
  "w-thunder": "maxThunder",
  snow: "snow",
  "w-snow": "snow",
  ice: "ice",
  "w-freezing": "ice",
  rain: "maxPrecip",
};

const show = (v: number, unit: string) =>
  unit === " in" ? (v < 0.1 ? v.toFixed(2) : v.toFixed(1)) + unit : Math.round(v) + unit;

/** Plain-language differences between each later option and the first. */
export function explainDifferences(options: OptionResult[], zone: string): string[] {
  const [base, ...rest] = options;
  if (!base) return [];
  const out: string[] = [];
  if (base.urgent)
    return [
      `An official ${base.urgent.event} is in effect. Follow its instructions now; comparing times does not apply.`,
    ];
  for (const o of rest) {
    if (o.level === "unknown" || base.level === "unknown") {
      const which = o.level === "unknown" ? o : base;
      out.push(
        `${which.key} (${which.label.toLowerCase()}) cannot be rated: ${
          which.limitations[0] || "data is missing"
        }`,
      );
      continue;
    }
    const changes = METRICS.map((m) => {
      const a = base.conditions[m.key] as number | null,
        b = o.conditions[m.key] as number | null;
      return { m, a, b, d: a !== null && b !== null ? b - a : null };
    }).filter((c) => c.d !== null && Math.abs(c.d) >= (c.m.unit === " in" ? 0.1 : 5));
    // Lead with the metric behind the higher-rated option's top factor, then the largest changes.
    const r0 = rank(o.level as Level) - rank(base.level as Level);
    const driver = (r0 >= 0 ? o : base).factors.find((f) => f.basis === "forecast");
    const driverKey = driver ? FACTOR_METRIC[driver.id] : undefined;
    changes.sort(
      (x, y) =>
        Number(y.m.key === driverKey) - Number(x.m.key === driverKey) || Math.abs(y.d!) - Math.abs(x.d!),
    );
    const officialDriver = (r0 >= 0 ? o : base).factors[0];
    const evidence = changes
      .slice(0, 2)
      .map(
        (c) =>
          `${c.m.name} ${c.d! > 0 ? "rises" : "falls"} from ${show(c.a!, c.m.unit)} to ${show(
            c.b!,
            c.m.unit,
          )}`,
      )
      .join(" and ");
    const alertNote =
      officialDriver?.basis === "official" && r0 !== 0
        ? ` The official ${officialDriver.title} sets the level for ${r0 > 0 ? o.key : "A"}.`
        : "";
    const r = r0;
    const when = rangeLabel(o.start, o.end, zone);
    if (r > 0)
      out.push(
        `${o.key} (${when}) rates ${levelName(o.level)}, higher than ${levelName(base.level)} for A${
          evidence ? ": " + evidence : ""
        }.${alertNote}`,
      );
    else if (r < 0)
      out.push(
        `${o.key} (${when}) rates ${levelName(o.level)}, lower than ${levelName(base.level)} for A${
          evidence ? ": " + evidence : ""
        }.${alertNote} Lower exposure on this evidence is not a guarantee of safe conditions.`,
      );
    else
      out.push(
        `${o.key} (${when}) shares A's ${levelName(o.level)} rating${
          evidence ? "; " + evidence : "; the forecast evidence is similar"
        }.`,
      );
  }
  return out;
}
