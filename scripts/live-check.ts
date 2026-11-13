// Manual live check against the real NWS API: `npx tsx scripts/live-check.ts [location ...]`
import { getWeather } from "../backend/weather";
import { assess } from "../shared/riskEngine";
import { compareOptions } from "../shared/impactEngine";
import { locations } from "../shared/locations";

const ids = process.argv.slice(2).length ? process.argv.slice(2) : locations.map((l) => l.id);
for (const id of ids) {
  const t = Date.now();
  const w = await getWeather(id);
  const a = assess(w, Date.now());
  const p0 = w.periods[0];
  console.log(
    JSON.stringify({
      id,
      ms: Date.now() - t,
      availability: w.availability,
      periods: w.periods.length,
      alerts: w.alerts.map((x) => x.event),
      firstHour: p0 && { start: p0.start, wind: p0.windMph, gust: p0.gustMph, thunder: p0.thunderChance, snow: p0.snowIn, feels: p0.apparentF },
      obs: w.observation && { st: w.observation.station, t: w.observation.temperatureF, at: w.observation.timestamp },
      level: a.level,
      summary: a.summary,
      factors: a.factors.map((f) => `${f.level}:${f.id}`),
      driving: compareOptions(w, "driving", 1, Date.now()).map((o) => o.level),
      errors: w.errors,
    }),
  );
}
