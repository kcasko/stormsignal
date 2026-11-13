import { useEffect, useState } from "react";
import { locations } from "../shared/locations";
import type { RouteResult } from "../backend/route";

export function RoutePlanner({ origin, simulated }: { origin: string; simulated: boolean }) {
  const from = locations.some(l => l.id === origin) ? origin : locations[0].id;
  const [destination, setDestination] = useState("grand-rapids");
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setResult(null); setError("");
    if (destination === from) setDestination(locations.find(l => l.id !== from)?.id ?? "");
  }, [from, simulated, destination]);
  const plan = async () => {
    setLoading(true); setResult(null); setError("");
    try {
      const res = await fetch(`/api/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(destination)}`);
      if (!res.ok) throw Error("Route planning or weather sources are temporarily unavailable.");
      setResult(await res.json() as RouteResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Route unavailable.");
    } finally { setLoading(false); }
  };
  return <section className="route-plan" aria-labelledby="route-title">
    <h2 id="route-title" className="section-h">Weather along a trip</h2>
    <p className="muted">Amazon Location Service calculates a driving route. Storm Signal then samples NWS conditions at its start, approximate midpoint and end. These are not continuous route checks.</p>
    {simulated && <p className="muted">Route planning uses live data only. Switch the source to Live NWS data to calculate a route.</p>}
    {!simulated && <>
      <div className="route-controls">
        <label>From <select value={from} disabled aria-label="Route starting city">{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>To <select value={destination} onChange={e => { setDestination(e.target.value); setResult(null); }} aria-label="Route destination city">{locations.filter(l => l.id !== from).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <button type="button" disabled={loading || destination === from} onClick={plan}>{loading ? "Checking route…" : "Check route"}</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {result && <div className="route-results" aria-live="polite">
        <h3>{result.origin} to {result.destination}</h3>
        <p><strong>{result.distanceMi} miles</strong> · Approximately {result.durationMin} minutes driving, according to Amazon Location. Traffic and conditions may change.</p>
        <ol>{result.checks.map((check, i) => <li key={i}>
          <strong>{check.label}</strong>: {check.available ? `Storm Signal ${check.level}` : "Conditions unknown"}
          {check.alerts.length > 0 && <ul>{check.alerts.map((alert, j) => <li key={j}><a href={alert.url} rel="noreferrer" target="_blank">{alert.event} (NWS)</a></li>)}</ul>}
        </li>)}</ol>
        <p className="muted">{result.warning}</p>
      </div>}
    </>}
  </section>;
}
