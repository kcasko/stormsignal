import { useEffect, useState } from "react";
import { locations } from "../shared/locations";
import type { RouteResult } from "../backend/route";
import { RouteStreetMap } from "./RouteStreetMap";

export function RoutePlanner({ origin, simulated }: { origin: string; simulated: boolean }) {
  const from = locations.some(l => l.id === origin) ? origin : locations[0].id;
  const [destination, setDestination] = useState("grand-rapids");
  const [departureOffset, setDepartureOffset] = useState(0);
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
      const depart = new Date(Date.now() + departureOffset * 3600000).toISOString();
      const res = await fetch(`/api/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(destination)}&depart=${encodeURIComponent(depart)}`);
      if (!res.ok) throw Error("Route planning or weather sources are temporarily unavailable.");
      setResult(await res.json() as RouteResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Route unavailable.");
    } finally { setLoading(false); }
  };
  return <section className="route-plan" aria-labelledby="route-title">
    <h2 id="route-title" className="section-h">Weather along a trip</h2>
    <p className="muted">Amazon Location calculates the driving route. An interactive OpenStreetMap map shows the route and current NWS warning areas. Forecast-only risk is checked for the estimated arrival hour at the start, midpoint and destination, not continuously along the drive.</p>
    {simulated && <p className="muted">Route planning uses live data only. Switch the source to Live NWS data to calculate a route.</p>}
    {!simulated && <>
      <div className="route-controls">
        <label>From <select value={from} disabled aria-label="Route starting city">{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>To <select value={destination} onChange={e => { setDestination(e.target.value); setResult(null); }} aria-label="Route destination city">{locations.filter(l => l.id !== from).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>Leave <select aria-label="Planned departure" value={departureOffset} onChange={e=>{setDepartureOffset(Number(e.target.value)); setResult(null);}}>
          <option value={0}>Now</option><option value={3}>In 3 hours</option><option value={6}>In 6 hours</option><option value={12}>In 12 hours</option><option value={24}>In 24 hours</option><option value={36}>In 36 hours</option>
        </select></label>
        <button type="button" disabled={loading || destination === from} onClick={plan}>{loading ? "Checking route…" : "Check route"}</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {result && <div className="route-results" aria-live="polite">
        <h3>{result.origin} to {result.destination}</h3>
        <RouteStreetMap result={result} />
        <p className="fine">Planned departure: {new Date(result.departureAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}. Estimated arrival: {new Date(result.arrivalAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}. Times follow your device timezone.</p>
        <section aria-label="Official NWS warnings along route" className="route-warning-review">
          <h4>Official warning areas along this route</h4>
          <p className="fine">Warning overlays reflect alerts active when this route was checked. They cannot predict future warnings at your planned departure or arrival.</p>
          {result.warningReview ? <>
            {result.warningReview.warnings.length ? <ul>{result.warningReview.warnings.map((item, i) =>
              <li key={item.id + i}><a href={item.url} rel="noreferrer" target="_blank">{item.event}</a>: possible route overlap ({item.basis === "polygon" ? "NWS storm polygon" : "NWS warning zone"}). {item.area}</li>
            )}</ul> : <p>No intersections identified in the NWS warning areas successfully checked. This does not mean the route is safe.</p>}
            {result.warningReview.status === "partial" && <p className="muted" role="status">Incomplete warning coverage: {result.warningReview.gaps.join("; ")}</p>}
            <p className="fine">NWS warning feeds checked: {new Date(result.warningReview.checkedAt).toLocaleString()}. Zone and polygon boundaries are approximate.</p>
          </> : <p className="muted">Warning area coverage unavailable.</p>}
        </section>
        <p><strong>{result.distanceMi} miles</strong> · Approximately {result.durationMin} minutes driving, according to Amazon Location. Traffic and conditions may change.</p>
        <ol>{result.checks.map((check, i) => <li key={i}>
          <strong>{check.label}</strong>: {check.available ? `Forecast-based Storm Signal ${check.level}` : "Forecast conditions unknown"} at estimated arrival {new Date(check.arrivalAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}.
          <span className="muted small"> {check.summary}</span>
          {check.alerts.length > 0 && <><p className="fine">These official warnings are active at the time of the check, not a forecast of which warnings will exist at arrival.</p><ul>{check.alerts.map((alert, j) => <li key={j}><a href={alert.url} rel="noreferrer" target="_blank">{alert.event} (NWS)</a></li>)}</ul></>}
        </li>)}</ol>
        <p className="muted">{result.warning}</p>
      </div>}
    </>}
  </section>;
}
