import type { Weather, Location } from "../shared/types";
import { HOUR } from "../shared/planning";
export const demoAnchor = Date.parse("2026-11-13T19:00:00Z");
export function demoWeather(location: Location, scenario: string): Weather {
  const snow = scenario === "snow",
    urgent = scenario === "tornado";
  const start = demoAnchor + 3 * HOUR,
    end = demoAnchor + 7 * HOUR;
  return {
    source: "simulated",
    location,
    fetchedAt: new Date(demoAnchor).toISOString(),
    forecastUpdatedAt: new Date(demoAnchor).toISOString(),
    availability: { forecast: true, alerts: true },
    errors: [],
    periods: Array.from({ length: 14 }, (_, i) => ({
      start: new Date(demoAnchor + i * HOUR).toISOString(),
      end: new Date(demoAnchor + (i + 1) * HOUR).toISOString(),
      temperature: snow ? 28 : 62,
      temperatureUnit: "F",
      wind: i >= 3 && i < 7 ? "20 to 30 mph" : "5 to 10 mph",
      forecast:
        i >= 3 && i < 7
          ? snow
            ? "Snow showers"
            : "Chance thunderstorms"
          : "Mostly cloudy",
      precipitation: i >= 3 && i < 7 ? 60 : 10,
    })),
    alerts: [
      {
        id: "demo-" + scenario,
        event: urgent
          ? "Tornado Warning"
          : snow
            ? "Winter Storm Watch"
            : "Severe Thunderstorm Watch",
        severity: urgent ? "Extreme" : "Severe",
        headline: "Fictional scenario — not an actual NWS alert",
        description:
          "This simulated scenario is provided only to explore Storm Signal. It is not a current alert, prediction, or official message.",
        instruction: urgent
          ? "Seek shelter immediately in a basement or an interior room on the lowest floor of a sturdy building, away from windows. Do not delay sheltering to complete preparation tasks."
          : snow
            ? "Review travel plans and prepare essential supplies before winter conditions arrive. Monitor official forecasts and local instructions."
            : "Prepare to move indoors and monitor official alerts. Secure loose items only before storms arrive and if conditions allow.",
        sent: new Date(demoAnchor).toISOString(),
        onset: new Date(urgent ? demoAnchor : start).toISOString(),
        expires: new Date(urgent ? demoAnchor + HOUR : end).toISOString(),
        ends: new Date(urgent ? demoAnchor + HOUR : end).toISOString(),
        area: location.name + " — fictional coverage",
        url: "https://www.weather.gov/",
      },
    ],
  };
}
