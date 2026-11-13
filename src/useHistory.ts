import { useEffect, useState } from "react";
import type { Snapshot } from "../shared/drift";
import { locations } from "../shared/locations";
import type { Weather } from "../shared/types";
import { scenarioHistory } from "./demo";
import type { Mode } from "./useWeather";

const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "";

export interface HistoryState {
  tracked: boolean;
  snapshots: Snapshot[];
  loading: boolean;
  error: boolean;
}

export function useHistory(locationId: string, mode: Mode, weather: Weather | null, refresh: number): HistoryState {
  const [state, setState] = useState<HistoryState & { key: string }>({ key: "", tracked: false, snapshots: [], loading: true, error: false });
  const key = `${locationId}|${mode}|${refresh}`;
  const tracked = locations.some((l) => l.id === locationId);
  useEffect(() => {
    if (mode !== "live" || !tracked) return;
    let ignore = false;
    fetch(`${API}/api/history?location=${encodeURIComponent(locationId)}&hours=24`)
      .then(async (r) => {
        if (!r.ok) throw Error();
        const body = (await r.json()) as { snapshots: Snapshot[] };
        if (!ignore) setState({ key, tracked: true, snapshots: Array.isArray(body.snapshots) ? body.snapshots : [], loading: false, error: false });
      })
      .catch(() => !ignore && setState({ key, tracked: true, snapshots: [], loading: false, error: true }));
    return () => {
      ignore = true;
    };
  }, [locationId, mode, key, tracked]);
  if (mode !== "live") return { tracked: true, snapshots: weather ? scenarioHistory(mode, weather) : [], loading: false, error: false };
  if (!tracked) return { tracked: false, snapshots: [], loading: false, error: false };
  return state.key === key ? state : { tracked: true, snapshots: [], loading: true, error: false };
}
