import { useEffect, useRef, useState } from "react";
import { locations } from "../shared/locations";

export interface Place {
  id: string;
  label: string;
}
interface Match {
  id: string;
  label: string;
  source: string;
}

const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "";
/** Device location is rounded to 2 decimals (about 1 km) before it leaves the browser. */
const r2 = (n: number) => (Math.round(n * 100) / 100).toFixed(3);

export function PlacePicker({ place, setPlace }: { place: Place; setPlace: (p: Place) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Match[] | null>(null);
  const [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const custom = !locations.some((l) => l.id === place.id);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) return;
    setStatus("Searching…");
    setResults(null);
    try {
      const r = await fetch(`${API}/api/geocode?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw Error();
      const body = (await r.json()) as { results: Match[] };
      setResults(body.results);
      setStatus(body.results.length ? "" : "No U.S. match. Try a 5-digit ZIP, “City, ST”, or a full street address.");
    } catch {
      setStatus("Search is unavailable right now. Pick a listed city instead.");
    }
  }
  function choose(p: Place) {
    setPlace(p);
    setOpen(false);
    setResults(null);
    setQ("");
    setStatus("");
  }
  function useMine() {
    if (!navigator.geolocation) return setStatus("This browser can't share its location.");
    setStatus("Asking your browser for your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        choose({
          id: `pt:${r2(pos.coords.latitude)},${r2(pos.coords.longitude)}`,
          label: "My location (approx.)",
        }),
      () => setStatus("Location permission was denied or unavailable. Search instead."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <div className="picker">
      <label className="loc">
        <span className="sr">Location</span>
        <select
          value={place.id}
          onChange={(e) => {
            if (e.target.value === "__search") return setOpen(true);
            const l = locations.find((x) => x.id === e.target.value);
            if (l) choose({ id: l.id, label: l.name });
          }}
        >
          {custom && <option value={place.id}>{place.label}</option>}
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
          <option value="__search">Search any U.S. place…</option>
        </select>
      </label>
      <button type="button" className="find-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Find a place
      </button>
      {open && (
        <div className="finder" role="dialog" aria-label="Find a U.S. place">
          <form onSubmit={search} className="finder-row">
            <label className="sr" htmlFor="place-q">
              ZIP, city or street address
            </label>
            <input
              id="place-q"
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ZIP, “City, ST” or street address"
              autoComplete="off"
              maxLength={120}
            />
            <button type="submit" className="primary">
              Search
            </button>
            <button type="button" onClick={useMine}>
              Use my location
            </button>
            <button type="button" className="text-btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </form>
          {status && (
            <p className="fine" role="status">
              {status}
            </p>
          )}
          {results && results.length > 0 && (
            <ul className="matches">
              {results.map((m) => (
                <li key={m.id + m.label}>
                  <button type="button" onClick={() => choose({ id: m.id, label: m.label })}>
                    {m.label}
                    <small>{m.source === "address" ? "street address" : m.source === "zip" ? "ZIP center" : "place center"}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="fine">
            ZIPs and city names come from U.S. Census Bureau data bundled with the app. Street addresses are looked up with
            the U.S. Census Geocoder. “Use my location” is rounded to about 1 km. Searches are not stored.
          </p>
        </div>
      )}
    </div>
  );
}
