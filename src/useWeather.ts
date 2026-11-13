import { useEffect, useMemo, useState } from "react";
import type { Assessment, Weather } from "../shared/types";
import { locations } from "../shared/locations";
import { scenarioWeather, type ScenarioId } from "./demo";

export type Mode = "live" | ScenarioId;
export interface WeatherState {
  weather: Weather | null;
  /** Assessment computed by the API for live data. Scenarios are assessed in the browser. */
  serverAssessment: Assessment | null;
  loading: boolean;
  error: string;
}

const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "";

function valid(data: unknown, id: string): data is Weather & { assessment?: Assessment } {
  const d = data as Weather;
  return (
    !!d &&
    d.source === "live" &&
    d.location?.id === id &&
    Array.isArray(d.periods) &&
    Array.isArray(d.alerts) &&
    typeof d.availability === "object"
  );
}

interface Live extends WeatherState {
  key: string;
}

export function useWeather(locationId: string, mode: Mode, refresh: number): WeatherState {
  const key = `${locationId}|${refresh}`;
  const [live, setLive] = useState<Live | null>(null);

  // Scenarios are computed synchronously, so they can never mix with live data.
  const scenario = useMemo(() => {
    if (mode === "live") return null;
    const location = locations.find((l) => l.id === locationId)!;
    return scenarioWeather(location, mode);
  }, [locationId, mode]);

  useEffect(() => {
    if (mode !== "live") return;
    let ignore = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);
    fetch(`${API}/api/weather?location=${encodeURIComponent(locationId)}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error(String(r.status));
        const data: unknown = await r.json();
        if (!valid(data, locationId)) throw Error("shape");
        if (!ignore)
          setLive({ key, weather: data, serverAssessment: data.assessment ?? null, loading: false, error: "" });
      })
      .catch(() => {
        if (!ignore)
          setLive({
            key,
            weather: null,
            serverAssessment: null,
            loading: false,
            error: "Storm Signal could not reach its weather service. Check weather.gov before making plans.",
          });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      ignore = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [locationId, mode, key]);

  if (scenario) return { weather: scenario, serverAssessment: null, loading: false, error: "" };
  // Only return data fetched for exactly this location and refresh; otherwise we are loading.
  if (live && live.key === key) return live;
  return { weather: null, serverAssessment: null, loading: true, error: "" };
}
