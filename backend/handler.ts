import { getWeather } from "./weather";
import { locations } from "../shared/locations";
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
    return reply(200, { status: "ok", version: "0.1.0" });
  if (event.rawPath !== "/api/weather")
    return reply(404, { error: "Not found" });
  const id = event.queryStringParameters?.location || "";
  if (!locations.some((l) => l.id === id))
    return reply(400, { error: "Choose a supported location." });
  try {
    return reply(200, await getWeather(id));
  } catch {
    return reply(503, {
      error: "Weather service unavailable. Check weather.gov.",
    });
  }
}
