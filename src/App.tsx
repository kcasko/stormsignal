import { useEffect, useMemo, useRef, useState } from "react";
import { locations } from "../shared/locations";
import { assess } from "../shared/riskEngine";
import { isStale } from "../shared/freshness";
import type { Activity } from "../shared/impactEngine";
import { ACTIVITIES } from "../shared/impactEngine";
import { SCENARIOS, SCENARIO_NOW } from "./demo";
import { useWeather, type Mode } from "./useWeather";
import { Overview } from "./Overview";
import { WhatIf } from "./WhatIf";
import { StormPrep } from "./StormPrep";
import { LevelMark } from "./components";
import { stamp, zoneName } from "./format";

const PAGES = [
  { id: "overview", label: "Overview" },
  { id: "whatif", label: "What If?" },
  { id: "prep", label: "Storm Prep" },
] as const;
type Page = (typeof PAGES)[number]["id"];
/** The page named by the hash, or null for in-page anchors like #main or #method. */
const pageFromHash = (): Page | null => {
  const h = location.hash.replace("#", "");
  return PAGES.some((p) => p.id === h) ? (h as Page) : null;
};
function remembered(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function App() {
  const [page, setPage] = useState<Page>(() => pageFromHash() ?? "overview");
  const firstPage = useRef(true);
  const [locationId, setLocationId] = useState(() => {
    const v = remembered("stormsignal-location", "kalamazoo");
    return locations.some((l) => l.id === v) ? v : "kalamazoo";
  });
  const [mode, setMode] = useState<Mode>("live");
  const [refresh, setRefresh] = useState(0);
  const [clockNow, setClockNow] = useState(Date.now());
  const [activity, setActivity] = useState<Activity>("driving");
  const [hours, setHours] = useState(ACTIVITIES.driving.defaultHours);
  const { weather, serverAssessment, loading, error } = useWeather(locationId, mode, refresh);

  useEffect(() => {
    const onHash = () => {
      const next = pageFromHash();
      // In-page anchors (skip link, "How levels work") scroll normally and keep the current page.
      if (!next) return;
      setPage(next);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    const t = setInterval(() => setClockNow(Date.now()), 30000);
    return () => {
      window.removeEventListener("hashchange", onHash);
      clearInterval(t);
    };
  }, []);
  // Move focus to the new page's heading so screen-reader and keyboard users land on it.
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [page]);
  useEffect(() => {
    try {
      localStorage.setItem("stormsignal-location", locationId);
    } catch {
      /* not essential */
    }
  }, [locationId]);

  const simulated = mode !== "live";
  // Scenarios run on a fixed clock; live data is assessed against the real time.
  const now = simulated ? SCENARIO_NOW : clockNow;
  const location = locations.find((l) => l.id === locationId)!;
  const zone = location.timeZone;
  const assessment = useMemo(() => {
    if (!weather) return null;
    // Prefer the API's assessment while it is fresh; recompute locally otherwise (e.g. scenarios, long-open tab).
    if (!simulated && serverAssessment && clockNow - serverAssessment.windowStart < 5 * 60000) return serverAssessment;
    return assess(weather, now);
  }, [weather, serverAssessment, simulated, now, clockNow]);
  const stale = !simulated && weather ? isStale(weather, clockNow) : false;
  const urgent = assessment?.urgent;
  const go = (p: string) => {
    window.location.hash = p;
  };
  const sourceLabel = simulated
    ? "Simulated scenario"
    : loading
      ? "Loading NWS…"
      : error || !weather
        ? "Data unavailable"
        : weather.errors.length
          ? "Live NWS · partial"
          : "Live NWS data";

  return (
    <div className={`app ${simulated ? "is-sim" : ""}`}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="masthead">
        <div className="brand">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M3 16h4l3-9 4 13 3-8h4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span>Storm Signal</span>
        </div>
        <nav className="tabs" aria-label="Main">
          {PAGES.map((p) => (
            <a key={p.id} href={"#" + p.id} aria-current={page === p.id ? "page" : undefined}>
              {p.label}
            </a>
          ))}
        </nav>
        <div className="where">
          <label className="loc">
            <span className="sr">Location</span>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="src">
            <span className="sr">Data source</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="live">Live NWS data</option>
              <optgroup label="Simulated scenarios">
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    Simulated: {s.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        </div>
      </header>

      <div className="statusbar" role="status">
        <span className={`dot ${simulated ? "sim" : error || (weather && weather.errors.length) ? "bad" : loading ? "wait" : "ok"}`} aria-hidden="true" />
        <span className="src-label">{sourceLabel}</span>
        {weather && (
          <span className="num">
            {simulated ? "Scenario time " + stamp(now, zone) : "Retrieved " + stamp(Date.parse(weather.fetchedAt), zone)}{" "}
            {zoneName(now, zone)}
          </span>
        )}
        {weather?.forecastUpdatedAt && !simulated && (
          <span className="num hide-sm">· NWS forecast issued {stamp(Date.parse(weather.forecastUpdatedAt), zone)}</span>
        )}
        {assessment && page !== "overview" && (
          <a className="mini-level" href="#overview">
            <LevelMark level={assessment.level} size="sm" />
          </a>
        )}
        {!simulated && (
          <button className="text-btn" onClick={() => setRefresh((r) => r + 1)} disabled={loading}>
            Refresh
          </button>
        )}
      </div>

      {simulated && (
        <div className="banner banner-sim">
          <strong>Simulated scenario. This is not a real forecast or alert.</strong> Fictional data on a fixed clock, so you
          can see how Storm Signal handles rare, dangerous weather. Switch the source back to “Live NWS data” for real
          conditions.
        </div>
      )}
      {(error || stale || (weather && weather.errors.length > 0)) && (
        <div className="banner banner-bad" role="alert">
          {error && <p>{error}</p>}
          {weather?.errors.map((e) => <p key={e}>{e}</p>)}
          {stale && <p>This data was retrieved more than 10 minutes ago and may be out of date. Refresh before relying on it.</p>}
          <a href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">
            Check weather.gov ↗
          </a>
        </div>
      )}
      {urgent && (
        <div className="banner banner-urgent" role="alert">
          <p className="urgent-event">
            {simulated ? "SIMULATED " : ""}
            {urgent.event.toUpperCase()}: protective action comes first
          </p>
          <p className="urgent-text">{urgent.instruction || "Follow the official NWS warning and local emergency instructions now."}</p>
          <p className="fine">
            {simulated
              ? "Simulated instruction text in the format NWS uses. In a real warning, the official text appears here and overrides everything else."
              : "Official NWS instruction text. It overrides everything else on this page."}
          </p>
        </div>
      )}

      <main id="main" tabIndex={-1}>
        {page === "overview" && <Overview weather={weather} assessment={assessment} loading={loading} now={now} go={go} />}
        {page === "whatif" && (
          <WhatIf weather={weather} loading={loading} now={now} activity={activity} setActivity={setActivity} hours={hours} setHours={setHours} />
        )}
        {page === "prep" && <StormPrep weather={weather} assessment={assessment} />}
      </main>

      <footer className="foot">
        <p>
          Storm Signal is a planning aid, not an emergency warning service. Keep official alerts enabled on your phone and
          follow NWS warnings and local officials over anything shown here.
        </p>
        <p className="fine">
          Data: <a href="https://www.weather.gov/documentation/services-web-api">National Weather Service API</a> (forecast,
          gridpoint, alerts, observations) for city-center points. Levels are Storm Signal’s own rule-based classification.
          Coverage: {locations.length} Midwest cities. Not affiliated with or endorsed by the National Weather Service,
          NOAA or FEMA. Fonts: Source Serif 4, Public Sans, IBM Plex Mono (
          <a href="licenses/SourceSerif4-OFL.txt">SIL OFL 1.1</a>).
        </p>
      </footer>

      <nav className="bottomnav" aria-label="Main (mobile)">
        {PAGES.map((p) => (
          <a key={p.id} href={"#" + p.id} aria-current={page === p.id ? "page" : undefined}>
            {p.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
