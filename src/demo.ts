// Clearly labelled SIMULATED scenarios for demonstrating rare, dangerous weather.
// They never replace failed live data and are always shown with a simulation banner.
import type { Alert, Location, Period, Weather } from "../shared/types";
import { alertKind, HOUR } from "../shared/rules";

export const SCENARIOS = [
  { id: "thunderstorm", label: "Severe thunderstorms + wind" },
  { id: "tornado", label: "Tornado warning in effect" },
  { id: "winter", label: "Winter storm, snow and ice" },
  { id: "failure", label: "NWS data failure" },
] as const;
export type ScenarioId = (typeof SCENARIOS)[number]["id"];

/** Fixed scenario clock: Fri Nov 13 2026, 2 PM Eastern. */
export const SCENARIO_NOW = Date.parse("2026-11-13T19:00:00Z");

function hours(n: number, f: (i: number) => Partial<Period>): Period[] {
  return Array.from({ length: n }, (_, i) => ({
    start: new Date(SCENARIO_NOW + i * HOUR).toISOString(),
    end: new Date(SCENARIO_NOW + (i + 1) * HOUR).toISOString(),
    temperature: 58,
    temperatureUnit: "F",
    wind: "10 mph",
    windMph: 10,
    forecast: "Mostly Cloudy",
    precipitation: 10,
    gustMph: 18,
    thunderChance: 0,
    snowIn: 0,
    iceIn: 0,
    apparentF: 58,
    ...f(i),
  }));
}

function alert(location: Location, event: string, from: number, to: number, instruction: string, severity = "Severe"): Alert {
  return {
    id: "simulated-" + event.toLowerCase().replace(/\s+/g, "-"),
    event,
    kind: alertKind(event),
    severity,
    urgency: alertKind(event) === "warning" ? "Immediate" : "Expected",
    headline: `SIMULATED ${event} — not an actual NWS alert`,
    description:
      "This is a fictional scenario created to demonstrate Storm Signal. It is not a current alert, forecast, or official message.",
    instruction,
    sent: new Date(SCENARIO_NOW - HOUR).toISOString(),
    onset: new Date(SCENARIO_NOW + from * HOUR).toISOString(),
    expires: new Date(SCENARIO_NOW + to * HOUR).toISOString(),
    ends: new Date(SCENARIO_NOW + to * HOUR).toISOString(),
    area: `${location.name} (fictional coverage)`,
    url: "https://www.weather.gov/",
  };
}

export function scenarioWeather(location: Location, id: ScenarioId): Weather {
  const base: Weather = {
    source: "simulated",
    location,
    fetchedAt: new Date(SCENARIO_NOW).toISOString(),
    forecastUpdatedAt: new Date(SCENARIO_NOW - HOUR).toISOString(),
    periods: [],
    alerts: [],
    observation: {
      station: "SIM",
      stationName: "Simulated station",
      timestamp: new Date(SCENARIO_NOW - 10 * 60000).toISOString(),
      description: "Mostly cloudy",
      temperatureF: 58,
      windMph: 9,
      gustMph: null,
      visibilityMi: 10,
    },
    availability: { forecast: true, alerts: true, grid: true, observation: true },
    errors: [],
  };
  if (id === "thunderstorm") {
    // Line of storms arrives ~3 hours out with damaging gusts, clears by ~7 hours.
    base.periods = hours(36, (i) =>
      i >= 3 && i < 7
        ? {
            forecast: i < 5 ? "Thunderstorms Likely" : "Chance Showers And Thunderstorms",
            wind: "20 to 30 mph",
            windMph: 30,
            gustMph: i === 3 || i === 4 ? 60 : 44,
            thunderChance: i < 5 ? 70 : 40,
            precipitation: i < 5 ? 80 : 50,
          }
        : i >= 7 && i < 10
          ? { forecast: "Breezy", wind: "15 to 20 mph", windMph: 20, gustMph: 34, temperature: 50, apparentF: 46 }
          : i >= 10
            ? { temperature: 44, apparentF: 39 }
            : {},
    );
    base.alerts = [
      alert(location, "Severe Thunderstorm Watch", 0, 8, "Monitor for warnings. Be ready to move to a sturdy building quickly if storms approach."),
      alert(location, "Wind Advisory", 3, 12, "Secure outdoor objects before winds increase. Use caution if driving a high-profile vehicle.", "Moderate"),
    ];
  } else if (id === "tornado") {
    base.periods = hours(36, (i) =>
      i < 3 ? { forecast: "Thunderstorms", windMph: 25, wind: "15 to 25 mph", gustMph: 55, thunderChance: 90, precipitation: 90 } : {},
    );
    base.alerts = [
      alert(
        location,
        "Tornado Warning",
        0,
        1,
        "TAKE COVER NOW! Move to a basement or an interior room on the lowest floor of a sturdy building. Avoid windows. If you are outdoors, in a mobile home, or in a vehicle, move to the closest substantial shelter and protect yourself from flying debris.",
        "Extreme",
      ),
      alert(location, "Tornado Watch", 0, 6, "Be prepared to act quickly if a warning is issued."),
    ];
  } else if (id === "winter") {
    base.periods = hours(36, (i) => ({
      temperature: i < 6 ? 31 : 25,
      apparentF: i < 6 ? 22 : 12,
      ...(i >= 2 && i < 5
        ? { forecast: "Freezing Rain", iceIn: 0.06, precipitation: 80, windMph: 15, wind: "10 to 15 mph", gustMph: 28 }
        : i >= 5 && i < 16
          ? { forecast: "Snow", snowIn: 0.7, precipitation: 90, windMph: 20, wind: "15 to 20 mph", gustMph: 35 }
          : { forecast: "Cloudy" }),
    }));
    base.alerts = [
      alert(location, "Winter Storm Warning", 2, 18, "Travel could be very difficult. If you must travel, keep an extra flashlight, food and water in your vehicle."),
    ];
  } else {
    // Simulates NWS being unreachable: nothing is fabricated, everything is unknown.
    base.availability = { forecast: false, alerts: false, grid: false, observation: false };
    base.observation = null;
    base.errors = [
      "Hourly forecast unavailable from NWS.",
      "Official alerts unavailable from NWS. Warning status is unknown.",
    ];
  }
  return base;
}
