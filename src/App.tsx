import { useEffect, useState } from "react";
import { locations } from "../shared/locations";
import type { Weather } from "../shared/types";
import {
  comparePlan,
  dateLabel,
  forecastWindows,
  HOUR,
  isStale,
  timeLabel,
  urgentWarning,
} from "../shared/planning";
import { demoWeather, demoAnchor } from "./demo";
import { Dial } from "./Dial";
import { Checklist } from "./Checklist";
export function App() {
  const [locationId, setLocationId] = useState("kalamazoo"),
    [mode, setMode] = useState("live"),
    [weather, setWeather] = useState<Weather | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [late, setLate] = useState(false),
    [activity, setActivity] = useState("errand"),
    [now, setNow] = useState(Date.now());
  const location = locations.find((l) => l.id === locationId)!;
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    setWeather(null);
    setError("");
    setLoading(true);
    setLate(false);
    if (mode !== "live") {
      setWeather(demoWeather(location, mode));
      setLoading(false);
      return () => {
        ignore = true;
        controller.abort();
      };
    }
    const timeout = setTimeout(() => controller.abort(), 22000);
    fetch("/api/weather?location=" + encodeURIComponent(locationId), {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error("Weather request failed.");
        return (await r.json()) as Weather;
      })
      .then((data) => {
        if (!ignore) {
          if (
            data.source !== "live" ||
            data.location.id !== locationId ||
            !Array.isArray(data.periods) ||
            !Array.isArray(data.alerts)
          )
            throw Error("Unexpected weather response.");
          setWeather(data);
        }
      })
      .catch(() => {
        if (!ignore)
          setError(
            "Official weather could not be retrieved. Check weather.gov before making plans.",
          );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [locationId, mode, refresh]);
  const simulated = mode !== "live",
    displayNow = simulated ? demoAnchor : now;
  const anchor = Math.floor(displayNow / HOUR) * HOUR,
    a = displayNow + (late ? 2 : 0) * HOUR,
    b = displayNow + (late ? 4 : 3) * HOUR,
    zone = location.timeZone;
  const windows = weather ? forecastWindows(weather, anchor) : [];
  const urgent = weather ? urgentWarning(weather, displayNow) : undefined;
  const stale = weather?.source === "live" && isStale(weather, now);
  const minutes = activity === "walk" ? 30 : 45;
  const officialUrl = `https://forecast.weather.gov/MapClick.php?lat=${location.latitude}&lon=${location.longitude}`;
  const firstPeriod = weather?.periods.find(
    (p) => Date.parse(p.end) > displayNow,
  );
  return (
    <div className="shell">
      <a className="skip-link" href="#decide">
        Skip to planning
      </a>
      <header className="masthead">
        <a href="#" className="brand">
          <span className="mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          storm signal
        </a>
        <nav aria-label="Main navigation">
          <a href="#decide">Compare plans</a>
          <a href="#prepare">Prepare</a>
          <a href="#timeline">Timeline</a>
        </nav>
        <div className="demo-label">
          <strong>
            {simulated
              ? "FICTIONAL SCENARIO"
              : loading
                ? "LOADING NWS"
                : error ||
                    (weather &&
                      !(
                        weather.availability.alerts ||
                        weather.availability.forecast
                      ))
                  ? "DATA UNAVAILABLE"
                  : "OFFICIAL NWS DATA"}
          </strong>
          {simulated
            ? "Not live weather"
            : weather
              ? "Retrieved " + timeLabel(Date.parse(weather.fetchedAt), zone)
              : "Forecast & alerts"}
        </div>
      </header>
      <div className="modebar">
        <label htmlFor="mode">Weather source</label>
        <select
          id="mode"
          value={mode}
          onChange={(e) => {
            setWeather(null);
            setLoading(true);
            setMode(e.target.value);
          }}
        >
          <option value="live">Live National Weather Service</option>
          <option value="thunderstorm">Demo: thunderstorms</option>
          <option value="tornado">Demo: tornado warning</option>
          <option value="snow">Demo: winter weather</option>
        </select>
        {!simulated && (
          <button onClick={() => setRefresh((v) => v + 1)} disabled={loading}>
            Refresh
          </button>
        )}
        <span>Initial coverage: six Southwest Michigan city centers</span>
      </div>
      {simulated && (
        <div className="simulation" role="status">
          SIMULATED WEATHER · NOT A REAL FORECAST OR ALERT · Sample day:
          November 13, 2026
        </div>
      )}
      {(error || weather?.errors.length || stale) && (
        <div className="service-message" role="status">
          {error || weather?.errors.join(" ")}{" "}
          {stale &&
            "Retrieved data is over 10 minutes old. Refresh or check NWS."}{" "}
          <a href={officialUrl} target="_blank" rel="noopener">
            Open official weather ↗
          </a>
        </div>
      )}
      {urgent && (
        <div className="urgent" role="alert">
          <strong>
            {simulated ? "SIMULATED: " : ""}
            {urgent.event} — protective action comes first.
          </strong>
          <p>
            {urgent.instruction ||
              "Read and follow the official NWS alert and local emergency instructions immediately."}
          </p>
          <a href="#official-alerts">Read full alert ↓</a>
        </div>
      )}
      <main>
        <div className="workspace">
          <div className="desk">
            <div className="placebar">
              <div>
                <label htmlFor="location">LOCATION</label>
                <h1>
                  <select
                    id="location"
                    aria-label="Select location"
                    value={locationId}
                    onChange={(e) => {
                      setWeather(null);
                      setLoading(true);
                      setLocationId(e.target.value);
                    }}
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </h1>
              </div>
              <div className="snapshot">
                {simulated ? "SCENARIO TIME" : "LOCAL TIME"}
                <strong>{timeLabel(displayNow, zone)}</strong>
                {dateLabel(displayNow, zone)} · Eastern Time
              </div>
            </div>
            <section className="instrument" aria-label="Weather timing">
              <div className="dial-wrap">
                <h2 className="dial-heading">
                  {simulated
                    ? "Sample weather window"
                    : "Your next twelve hours"}
                </h2>
                <p className="arc-key">
                  <span aria-hidden="true" />
                  {windows.length
                    ? "Forecast weather · timing uncertain"
                    : loading
                      ? "Retrieving hourly forecast…"
                      : weather?.availability.forecast
                        ? "No flagged weather in retrieved forecast"
                        : "Forecast unavailable"}
                </p>
                <Dial
                  anchor={anchor}
                  a={a}
                  b={b}
                  windows={windows}
                  zone={zone}
                  available={Boolean(weather?.availability.forecast)}
                />
                <div className="dial-caption" aria-live="polite">
                  <span>A · {timeLabel(a, zone)}</span>
                  <span>B · {timeLabel(b, zone)}</span>
                </div>
                <p className="dial-context">
                  {dateLabel(anchor, zone)} →{" "}
                  {dateLabel(anchor + 12 * HOUR, zone)} · Eastern Time
                </p>
                <div className="controls" aria-label="Comparison times">
                  <button aria-pressed={!late} onClick={() => setLate(false)}>
                    Now vs. in 3 hours
                  </button>
                  <button aria-pressed={late} onClick={() => setLate(true)}>
                    In 2 vs. 4 hours
                  </button>
                </div>
              </div>
              <div className="outlook">
                <div className="risk-state">
                  {urgent
                    ? "Warning in effect"
                    : windows.length
                      ? "Plan around the forecast"
                      : loading
                        ? "Loading official data"
                        : "Stay weather-aware"}
                </div>
                <h2>
                  {urgent
                    ? "Follow official instructions."
                    : windows.length
                      ? "Weather may affect your plans."
                      : loading
                        ? "Checking your local outlook."
                        : "Make a plan. Keep checking."}
                </h2>
                <p>
                  {firstPeriod
                    ? firstPeriod.forecast
                    : loading
                      ? "Retrieving NWS hourly forecasts and active alerts."
                      : "Forecast data unavailable. This view cannot assess weather conditions."}
                </p>
                {firstPeriod && (
                  <div className="hazard">
                    <b>Hourly forecast</b>
                    {firstPeriod.temperature ?? "Unknown"}
                    {firstPeriod.temperature !== null
                      ? "°" + firstPeriod.temperatureUnit
                      : ""}{" "}
                    · Wind {firstPeriod.wind || "unknown"}
                    <br />
                    Precipitation chance:{" "}
                    {firstPeriod.precipitation === null
                      ? "unknown"
                      : firstPeriod.precipitation + "%"}
                  </div>
                )}
                {windows.map((w, i) => (
                  <div key={i} className="hazard">
                    <b>
                      {dateLabel(w.start, zone)} · {timeLabel(w.start, zone)}–
                      {timeLabel(w.end, zone)}
                    </b>
                    {w.label}
                  </div>
                ))}
                <p className="small">
                  Amber marks hours whose NWS wording mentions thunderstorms,
                  snow, freezing precipitation, or sleet. It is not a
                  severe-weather rating or a complete hazard assessment.
                </p>
                <a
                  className="small"
                  href={officialUrl}
                  target="_blank"
                  rel="noopener"
                >
                  Official point forecast ↗
                </a>
              </div>
            </section>
            <section
              className="alert-list"
              id="official-alerts"
              aria-label="Official alerts"
            >
              <h2>{simulated ? "Simulated alerts" : "Official NWS alerts"}</h2>
              {loading ? (
                <p>Checking alerts…</p>
              ) : !weather?.availability.alerts ? (
                <p className="small">
                  Alert status unknown. Retrieval failed. Check NWS directly.
                </p>
              ) : !weather.alerts.length ? (
                <p className="small">
                  No active alerts returned for this city center at retrieval
                  time. This is not an all-clear.
                </p>
              ) : (
                weather.alerts.map((alert) => (
                  <article className="official" key={alert.id}>
                    <span className="symbol" aria-hidden="true">
                      !
                    </span>
                    <div>
                      <strong>
                        {simulated ? "SIMULATED: " : ""}
                        {alert.event}
                      </strong>
                      <p>{alert.headline}</p>
                      <p>
                        {alert.area} · Issued{" "}
                        {dateLabel(Date.parse(alert.sent), zone)}{" "}
                        {timeLabel(Date.parse(alert.sent), zone)} · Expires{" "}
                        {dateLabel(Date.parse(alert.expires), zone)}{" "}
                        {timeLabel(Date.parse(alert.expires), zone)}
                      </p>
                    </div>
                    <a href={officialUrl} target="_blank" rel="noopener">
                      Check NWS ↗
                    </a>
                    <details open={/warning|emergency/i.test(alert.event)}>
                      <summary>Read alert and protective instructions</summary>
                      <h3>Instructions</h3>
                      <p className="alert-text">
                        {alert.instruction ||
                          "No instruction text provided. Read the full official message and follow local guidance."}
                      </p>
                      <h3>Full description</h3>
                      <p className="alert-text">{alert.description}</p>
                    </details>
                  </article>
                ))
              )}
            </section>
            <section id="decide">
              <div className="sectiontop">
                <h2>What if you went earlier?</h2>
                <span className="small">Compare activity intervals</span>
              </div>
              <div className="plan-controls">
                <div>
                  <label htmlFor="activity" className="eyebrow">
                    YOUR PLAN
                  </label>
                  <select
                    id="activity"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                  >
                    <option value="errand">Run a 45-minute errand</option>
                    <option value="walk">Take a 30-minute walk</option>
                    <option value="charge">Charge essential devices</option>
                  </select>
                </div>
              </div>
              <div className="comparison">
                {[
                  { letter: "A", start: a },
                  { letter: "B", start: b },
                ].map(({ letter, start }) => {
                  const result = weather
                    ? comparePlan(weather, start, minutes, displayNow)
                    : {
                        title: loading
                          ? "Loading forecast"
                          : "Comparison unavailable",
                        detail: "Check official weather before making plans.",
                      };
                  return (
                    <div className="option" key={letter}>
                      <span className="letter">{letter}</span>
                      <strong className="clock">
                        {timeLabel(start, zone)}
                      </strong>
                      <div className="endtime">
                        {dateLabel(start, zone)} ·{" "}
                        {activity === "charge"
                          ? "Start charging"
                          : "Finishes " +
                            timeLabel(start + minutes * 60000, zone)}
                      </div>
                      <p>{result.title}</p>
                      <p className="small">
                        {activity === "charge" && !urgent
                          ? "Charge essential devices early. An outage cannot be predicted from this comparison."
                          : result.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="note">
                Timing does not establish safety. Unknown weather, rapidly
                changing conditions, and official warnings override this
                comparison.{" "}
                {stale ? "Data is stale; check current NWS guidance." : ""}
              </p>
            </section>
          </div>
          <aside className="preparation" aria-label="Household preparation">
            <Checklist weather={weather} />
          </aside>
        </div>
        <section className="timeline" id="timeline">
          <div className="sectiontop">
            <span className="num">BEFORE / DURING / AFTER</span>
            <span className="small">
              {simulated
                ? "Fictional scenario"
                : "Preparation guidance, not a forecast"}
            </span>
          </div>
          <h2>Your preparation timeline.</h2>
          <div className="steps">
            {[
              [
                "Now",
                "Set the basics.",
                "Enable official alerts. Identify a sturdy shelter and charge essential devices.",
              ],
              [
                "Before hazardous conditions",
                "Prepare early.",
                "Review travel and equipment backup plans. Secure outdoor items only if conditions allow.",
              ],
              [
                "During a warning",
                "Follow official instructions.",
                "Do not wait for the forecast window or finish tasks before taking protective action.",
              ],
              [
                "After, when cleared",
                "Reassess first.",
                "Check updated alerts and local guidance. Avoid floodwater and downed lines.",
              ],
            ].map(([when, title, detail]) => (
              <div className="step" key={when}>
                <div className="eyebrow">{when}</div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
            ))}
          </div>
        </section>
        <aside className="caveat">
          <div>
            <div className="eyebrow">Read before relying</div>
            <h3>Official instructions come first.</h3>
          </div>
          <div>
            <p>
              Storm Signal is a planning aid, not an emergency warning system.
              It does not send warnings or guarantee safe travel. A warning or
              evacuation order overrides every comparison and checklist. Refresh
              for current data and keep another way to receive alerts.
            </p>
            <p className="small">
              Tornado warning: seek shelter immediately in a basement or
              interior room on the lowest floor of a sturdy building, away from
              windows.{" "}
              <a
                href="https://www.weather.gov/safety/tornado-during"
                target="_blank"
                rel="noopener"
              >
                NWS shelter guidance ↗
              </a>{" "}
              ·{" "}
              <a
                href="https://www.weather.gov/safety/thunderstorm"
                target="_blank"
                rel="noopener"
              >
                Thunderstorm safety ↗
              </a>
            </p>
          </div>
        </aside>
      </main>
      <footer>
        <span>STORM SIGNAL / LOCAL DEVELOPMENT</span>
        <span>
          {weather?.forecastUpdatedAt
            ? "Forecast updated " +
              dateLabel(Date.parse(weather.forecastUpdatedAt), zone) +
              " " +
              timeLabel(Date.parse(weather.forecastUpdatedAt), zone)
            : "Forecast update time unavailable"}{" "}
          · {simulated ? "Simulated data" : "National Weather Service"}
        </span>
      </footer>
    </div>
  );
}
