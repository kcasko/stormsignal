// Realistic, clearly synthetic fixtures for deterministic engine tests.
import type { Alert, Period, Weather } from "../../shared/types";
import { locations } from "../../shared/locations";
import { alertKind } from "../../shared/rules";
export const T0 = Date.parse("2026-11-13T19:00:00Z"); // Fri 2 PM Eastern
export const H = 3600000;
export function hour(i: number, over: Partial<Period> = {}): Period {
  return {
    start: new Date(T0 + i * H).toISOString(),
    end: new Date(T0 + (i + 1) * H).toISOString(),
    temperature: 45,
    temperatureUnit: "F",
    wind: "10 mph",
    windMph: 10,
    forecast: "Mostly Cloudy",
    precipitation: 10,
    gustMph: 15,
    thunderChance: 0,
    snowIn: 0,
    iceIn: 0,
    apparentF: 40,
    ...over,
  };
}
export function weather(
  periods: Period[] = Array.from({ length: 30 }, (_, i) => hour(i)),
  over: Partial<Weather> = {},
): Weather {
  return {
    source: "live",
    location: locations[0],
    fetchedAt: new Date(T0).toISOString(),
    forecastUpdatedAt: new Date(T0).toISOString(),
    periods,
    alerts: [],
    observation: null,
    availability: { forecast: true, alerts: true, grid: true, observation: true },
    errors: [],
    ...over,
  };
}
export function alert(event: string, over: Partial<Alert> = {}): Alert {
  return {
    id: "urn:test:" + event,
    event,
    kind: alertKind(event),
    severity: "Severe",
    urgency: "Expected",
    headline: event + " issued",
    description: "Test description",
    instruction: "Test instruction",
    sent: new Date(T0 - H).toISOString(),
    expires: new Date(T0 + 6 * H).toISOString(),
    onset: new Date(T0 - H).toISOString(),
    ends: new Date(T0 + 6 * H).toISOString(),
    area: "Kalamazoo",
    url: "https://alerts.weather.gov/",
    ...over,
  };
}
/** Hours [from, to) replaced with the given values. */
export function withHours(from: number, to: number, over: Partial<Period>, length = 30) {
  return Array.from({ length }, (_, i) => (i >= from && i < to ? hour(i, over) : hour(i)));
}
