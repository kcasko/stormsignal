export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}
/** One hourly period. Every numeric field is null when NWS did not supply it. */
export interface Period {
  start: string;
  end: string;
  temperature: number | null;
  temperatureUnit: string;
  wind: string;
  /** Upper value of the NWS hourly wind-speed text, in mph. */
  windMph: number | null;
  forecast: string;
  precipitation: number | null;
  /** From the NWS gridpoint layers; null if that layer was unavailable. */
  gustMph: number | null;
  thunderChance: number | null;
  /** Accumulation attributed to this hour, in inches. */
  snowIn: number | null;
  iceIn: number | null;
  apparentF: number | null;
}
export type AlertKind = "warning" | "watch" | "advisory" | "statement" | "other";
export interface Alert {
  id: string;
  event: string;
  kind: AlertKind;
  severity: string;
  urgency: string;
  headline: string;
  description: string;
  instruction: string;
  sent: string;
  expires: string;
  onset: string | null;
  ends: string | null;
  area: string;
  url: string;
}
export interface Observation {
  station: string;
  stationName: string;
  timestamp: string;
  description: string;
  temperatureF: number | null;
  windMph: number | null;
  gustMph: number | null;
  visibilityMi: number | null;
}
export interface Availability {
  forecast: boolean;
  alerts: boolean;
  grid: boolean;
  observation: boolean;
}
export interface Weather {
  source: "live" | "simulated";
  location: Location;
  fetchedAt: string;
  forecastUpdatedAt: string | null;
  periods: Period[];
  alerts: Alert[];
  observation: Observation | null;
  availability: Availability;
  errors: string[];
}

export const LEVELS = ["low", "moderate", "elevated", "high", "critical"] as const;
export type Level = (typeof LEVELS)[number];
/** "unknown" is never ranked as low: it means the evidence was insufficient. */
export type Classification = Level | "unknown";

export type Hazard =
  | "tornado"
  | "thunderstorm"
  | "wind"
  | "winter"
  | "ice"
  | "flood"
  | "heat"
  | "cold";

export interface Factor {
  id: string;
  level: Level;
  /** "official" = an NWS alert; "forecast" = Storm Signal rule on forecast values. */
  basis: "official" | "forecast";
  title: string;
  /** Short evidence statement, e.g. "forecast peak 48 mph (Elevated at 46 mph), Fri 2 PM – 7 PM". */
  evidence: string;
  /** What the evidence means in this context. */
  impact: string;
  hazard: Hazard | null;
  start: number | null;
  end: number | null;
}
export interface Assessment {
  level: Classification;
  summary: string;
  factors: Factor[];
  limitations: string[];
  hazards: Hazard[];
  windowStart: number;
  windowEnd: number;
  /** Set when an active warning requires immediate protective action. */
  urgent: Alert | null;
}
