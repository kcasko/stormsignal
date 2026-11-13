import { getWeather } from "./weather";
import { locations } from "../shared/locations";
import { assess } from "../shared/riskEngine";

const VERSION = "0.2.0";
export async function handler(event: {
  rawPath?: string;
  requestContext?: { http?: { method?: string } };
  queryStringParameters?: Record<string, string>;
}) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  const reply = (statusCode: number, body: unknown) => ({
    statusCode,
    headers,
    body: JSON.stringify(body),
  });
  if (event.requestContext?.http?.method !== "GET")
    return reply(405, { error: "GET required" });
  if (event.rawPath === "/api/health")
    return reply(200, { status: "ok", version: VERSION });
  if (event.rawPath === "/api/locations")
    return reply(200, { locations });
  if (event.rawPath !== "/api/weather") return reply(404, { error: "Not found" });
  const id = event.queryStringParameters?.location || "";
  if (!/^[a-z-]{1,40}$/.test(id) || !locations.some((l) => l.id === id))
    return reply(400, { error: "Choose a supported location." });
  try {
    const started = Date.now();
    const weather = await getWeather(id);
    const assessment = assess(weather, Date.now());
    // Structured log line for CloudWatch Logs Insights; no user data is logged.
    console.log(
      JSON.stringify({
        msg: "weather",
        location: id,
        ms: Date.now() - started,
        availability: weather.availability,
        alerts: weather.alerts.length,
        level: assessment.level,
      }),
    );
    return reply(200, { ...weather, assessment });
  } catch {
    return reply(503, { error: "Weather service unavailable. Check weather.gov." });
  }
}
