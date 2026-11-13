import type { Assessment, Weather } from "../shared/types";
import { HOUR } from "../shared/rules";
import { OVERVIEW_RULES } from "../shared/riskEngine";
import {
  AlertItem,
  FactorList,
  LevelScale,
  Limitations,
  WhatWouldChange,
} from "./components";
import { DriftPanel } from "./Drift";
import { hourlySignal, peakRun } from "../shared/ribbon";
import { levelName } from "../shared/rules";
import { EndedAlerts } from "./AlertArea";
import { activeStory, endedStories } from "../shared/alertHistory";
import type { HistoryState } from "./useHistory";
import { clock, day, hourOnly, stamp, unknown } from "./format";

interface Props {
  weather: Weather | null;
  assessment: Assessment | null;
  loading: boolean;
  now: number;
  history: HistoryState;
  simulated: boolean;
}

const gustRule = OVERVIEW_RULES.find((r) => r.id === "gust")!;
/** Level a value would get from a rule, for marking timeline cells. */
function cellLevel(id: string, v: number | null) {
  const rule = OVERVIEW_RULES.find((r) => r.id === id);
  if (!rule || v === null) return "";
  const hit = rule.thresholds.find(([, t]) =>
    rule.agg === "min" ? v <= t : v >= t,
  );
  return hit ? `lv-${hit[0]} hot` : "";
}

export function Overview({
  weather,
  assessment,
  loading,
  now,
  history,
  simulated,
}: Props) {
  const zone = weather?.location.timeZone ?? "America/Detroit";
  const next = weather
    ? weather.periods.filter(
        (p) => Date.parse(p.end) > now && Date.parse(p.start) < now + 24 * HOUR,
      )
    : [];
  const obs = weather?.observation;
  const gustMax = Math.max(60, ...next.map((p) => p.gustMph ?? 0));
  const officialUrl = weather
    ? `https://forecast.weather.gov/MapClick.php?lat=${weather.location.latitude}&lon=${weather.location.longitude}`
    : "https://www.weather.gov/";

  return (
    <div className="page overview">
      <h1 className="sr" tabIndex={-1}>
        Weather overview{weather ? " for " + weather.location.name : ""}
      </h1>
      <div className={`hero tone-${assessment?.level ?? "unknown"}`}>
        <section className="verdict" aria-labelledby="verdict-h">
          <p className="eyebrow" id="verdict-h">
            Storm Signal level · next 24 hours
          </p>
          <h2 className="hero-place">{weather?.location.name ?? "Your weather"}</h2>
          {assessment ? (
            <>
              <LevelScale level={assessment.level} />
              <p className="verdict-summary">
                {assessment.level === "low"
                  ? "No Storm Signal hazard threshold is met in the next 24 hours. Conditions can change; this is not an all-clear."
                  : assessment.summary}
              </p>
              <details className="risk-details">
                <summary>Why this level and what could change it</summary>
                <FactorList factors={assessment.factors} />
                <Limitations items={assessment.limitations} title="What this assessment could not check" />
                <WhatWouldChange level={assessment.level} factors={assessment.factors} />
              </details>
              <p className="fine">
                {stamp(assessment.windowStart, zone)} → {stamp(assessment.windowEnd, zone)}. Storm Signal’s own
                classification. <a href="#method">How levels work</a>
              </p>
            </>
          ) : (
            <p className="verdict-summary">
              {loading ? "Retrieving National Weather Service data…" : "No assessment: weather data could not be retrieved."}
            </p>
          )}
        </section>

        <div className="hero-side">
          <section className="current-weather" aria-label={simulated ? "Simulated current conditions" : "Current conditions"}>
            <p className="eyebrow">{simulated ? "Simulated now" : "Now"}</p>
            <p className="current-temperature">
              {obs?.temperatureF == null ? "—" : unknown(obs.temperatureF, "°F")}
            </p>
            <p className="current-desc">
              {obs?.description || (loading ? "Checking the nearest station…" : "Current observation unavailable.")}
            </p>
            <dl className="current-metrics">
              <div>
                <dt>Wind</dt>
                <dd>
                  {unknown(obs?.windMph ?? null, " mph")}
                  {obs?.gustMph != null ? `, gusts ${Math.round(obs.gustMph)}` : ""}
                </dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>{unknown(obs?.visibilityMi ?? null, " mi", 1)}</dd>
              </div>
            </dl>
            {obs && (
              <p className="current-source fine" title={obs.stationName}>
                {obs.station} · observed {stamp(Date.parse(obs.timestamp), zone)}
              </p>
            )}
          </section>
          {weather && <NextDay weather={weather} periods={next} zone={zone} />}
        </div>
      </div>

      <div className="overview-context">
        <section className="official-col" aria-labelledby="alerts-h">
          <h2 id="alerts-h" className="section-h">
            {simulated ? "Simulated alerts" : "Official NWS alerts"}
          </h2>
          {loading && !weather ? (
            <p className="muted">Checking alerts…</p>
          ) : !weather?.availability.alerts ? (
            <p className="notice notice-bad">
              Alert status unknown: retrieval failed. Check weather.gov
              directly.
            </p>
          ) : weather.alerts.length === 0 ? (
            <p className="muted">
              NWS returned no active alerts for this point at{" "}
              {stamp(Date.parse(weather.fetchedAt), zone)}. That is not an
              all-clear.
            </p>
          ) : (
            weather.alerts.map((a) => (
              <AlertItem
                key={a.id}
                alert={a}
                zone={zone}
                simulated={simulated}
                map={{
                  lat: weather.location.latitude,
                  lon: weather.location.longitude,
                  place: weather.location.name.replace(/^Near /, ""),
                }}
                story={activeStory(a, history.snapshots, now)}
              />
            ))
          )}
          {weather && (
            <EndedAlerts
              stories={endedStories(
                weather.availability.alerts ? weather.alerts : null,
                history.snapshots,
                now,
              )}
              zone={zone}
              simulated={simulated}
            />
          )}
        </section>

      </div>

      <div className="overview-main">
        {weather && assessment && <SignalRibbon weather={weather} assessment={assessment} zone={zone} />}
        <div className="cta-row">
          <a className="cta" href="#whatif">Compare when to go →</a>
          <a className="cta secondary" href="#prep">Build a prep checklist →</a>
        </div>
        <DriftPanel weather={weather} level={assessment?.level ?? null} history={history} now={now} simulated={simulated} />
      <details className="hourly" open aria-labelledby="hourly-h">
        <summary id="hourly-h">Hourly forecast</summary>
        {next.length ? (
          <div
            className="hourly-scroll"
            tabIndex={0}
            role="region"
            aria-label="Hourly forecast table, scrolls sideways"
          >
            <table>
              <thead>
                <tr>
                  <th scope="row">Hour</th>
                  {next.map((p) => {
                    const t = Date.parse(p.start);
                    return (
                      <th key={p.start} scope="col">
                        {hourOnly(t, zone)}
                        {hourOnly(t, zone) === "12AM" && (
                          <small>{day(t, zone).split(",")[0]}</small>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Temp</th>
                  {next.map((p) => (
                    <td key={p.start}>{p.temperature ?? "–"}°</td>
                  ))}
                </tr>
                <tr className="gust-row">
                  <th scope="row">Gust</th>
                  {next.map((p) => (
                    <td key={p.start} className={cellLevel("gust", p.gustMph)}>
                      <span
                        className="bar"
                        style={{
                          height: `${((p.gustMph ?? 0) / gustMax) * 32}px`,
                        }}
                        aria-hidden="true"
                      />
                      {p.gustMph ?? "?"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Wind</th>
                  {next.map((p) => (
                    <td key={p.start} className={cellLevel("wind", p.windMph)}>
                      {p.windMph ?? "?"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Thunder</th>
                  {next.map((p) => (
                    <td
                      key={p.start}
                      className={cellLevel("thunder", p.thunderChance)}
                    >
                      {p.thunderChance === null ? "?" : p.thunderChance + "%"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Precip</th>
                  {next.map((p) => (
                    <td key={p.start}>
                      {p.precipitation === null ? "?" : p.precipitation + "%"}
                    </td>
                  ))}
                </tr>
                <tr className="words">
                  <th scope="row">Forecast</th>
                  {next.map((p) => (
                    <td key={p.start}>{p.forecast}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            {loading
              ? "Retrieving hourly forecast…"
              : "Hourly forecast unavailable."}
          </p>
        )}
        <p className="fine">
          Wind and gusts in mph. “?” means NWS did not supply a value. Marked
          cells meet a Storm Signal threshold (gusts:{" "}
          {gustRule.thresholds
            .slice()
            .reverse()
            .map(([l, t]) => `${l} ≥${t}`)
            .join(", ")}
          ).{" "}
          <a href={officialUrl} target="_blank" rel="noopener noreferrer">
            Official point forecast ↗
          </a>
        </p>
      </details>
      </div>
      <section className="product-intro" aria-labelledby="intro-h">
        <div>
          <h2 id="intro-h">Weather you can plan around.</h2>
        </div>
        <div className="intro-copy">
          <p>See approaching weather, compare when to go, and build a preparation checklist from National Weather Service forecasts.</p>
          <details className="intro-guide">
            <summary>How to use Storm Signal</summary>
            <ol>
              <li><strong>Overview:</strong> Choose your location to see approaching hazards, official alerts, and what has changed in the forecast.</li>
              <li><a href="#whatif">What If?</a> Compare a drive, outdoor event, or home preparation at different times. Each option explains its weather exposure.</li>
              <li><a href="#prep">Storm Prep:</a> Pick your priorities and work through a sourced checklist for before, during, and after hazardous weather.</li>
            </ol>
            <p className="fine">Storm Signal’s levels are its own assessment. Official NWS warnings and their instructions take priority.</p>
          </details>
        </div>
      </section>

      <section className="method" id="method" aria-labelledby="method-h">
        <h2 id="method-h" className="section-h">
          How levels work
        </h2>
        <details className="method-details">
          <summary>Read the rules and limitations</summary>
          <ol className="method-list">
            <li>
              Every <b>official NWS alert</b> sets a floor: advisory or
              statement → Moderate, watch → Elevated, warning → High,
              tornado/extreme warnings → Critical. NWS’s own severity is shown
              next to it, unchanged.
            </li>
            <li>
              Forecast values from the NWS hourly and gridpoint data are checked
              against fixed thresholds: gusts, sustained wind, thunder chance,
              snow and ice totals, and feels-like temperature.
            </li>
            <li>
              The highest matching rule sets the level. Each rule shows the
              value, the threshold and the hours it applies to.
            </li>
            <li>
              If any source is missing or the forecast doesn’t cover the window,
              the level can’t be <b>Low</b>. It shows as <b>Unknown</b> instead.
            </li>
          </ol>
          <p className="fine">
            Every threshold is published as JSON at{" "}
            <a href="/api/rules">/api/rules</a> so anyone can check or reuse
            them. Storm Signal does not predict damage or the chance of an
            accident.
          </p>
        </details>
      </section>
    </div>
  );
}

/** The handful of numbers that drive most decisions, for the next 24 hours. */
function NextDay({ weather, periods, zone }: { weather: Weather; periods: Weather["periods"]; zone: string }) {
  const peak = (pick: (p: Weather["periods"][number]) => number | null) => {
    let best: { v: number; at: number } | null = null;
    for (const p of periods) {
      const v = pick(p);
      if (v !== null && (!best || v > best.v)) best = { v, at: Date.parse(p.start) };
    }
    return best;
  };
  const sum = (pick: (p: Weather["periods"][number]) => number | null) =>
    periods.some((p) => pick(p) !== null) ? periods.reduce((n, p) => n + (pick(p) ?? 0), 0) : null;
  const gust = peak((p) => p.gustMph);
  const thunder = peak((p) => p.thunderChance);
  const snow = sum((p) => p.snowIn);
  const ice = sum((p) => p.iceIn);
  const alerts = weather.availability.alerts ? weather.alerts.length : null;
  const when = (b: { v: number; at: number } | null) => (b && b.v > 0 ? `at ${hourOnly(b.at, zone)}` : "");
  return (
    <section className="next-day" aria-label="Next 24 hours at a glance">
      <p className="eyebrow">Next 24 hours</p>
      <dl>
        <div>
          <dt>Peak gust</dt>
          <dd>{gust ? `${Math.round(gust.v)} mph` : "—"}</dd>
          <dd className="fine">{gust ? when(gust) : "not provided"}</dd>
        </div>
        <div>
          <dt>Thunder chance</dt>
          <dd>{thunder ? `${Math.round(thunder.v)}%` : "—"}</dd>
          <dd className="fine">{thunder ? when(thunder) : "not provided"}</dd>
        </div>
        <div>
          <dt>Snow / ice</dt>
          <dd>
            {snow === null ? "—" : `${snow.toFixed(1)}″`} / {ice === null ? "—" : `${ice.toFixed(2)}″`}
          </dd>
          <dd className="fine">forecast totals</dd>
        </div>
        <div>
          <dt>Official alerts</dt>
          <dd>{alerts === null ? "unknown" : alerts}</dd>
          <dd className="fine">{alerts === null ? "retrieval failed" : alerts ? "active now" : "none active"}</dd>
        </div>
      </dl>
    </section>
  );
}

/** 24 hourly cells coloured by the highest factor that applies to each hour. */
function SignalRibbon({ weather, assessment, zone }: { weather: Weather; assessment: Assessment; zone: string }) {
  const hours = hourlySignal(weather, assessment);
  const peak = peakRun(hours, assessment.factors);
  const runs: string[] = [];
  for (let i = 0; i < hours.length; ) {
    let j = i;
    while (j + 1 < hours.length && hours[j + 1].level === hours[i].level) j++;
    runs.push(`${levelName(hours[i].level)} ${hourOnly(hours[i].start, zone)} to ${hourOnly(hours[j].start + HOUR, zone)}`);
    i = j + 1;
  }
  return (
    <figure className="ribbon">
      <figcaption className="ribbon-cap">
        <span className="eyebrow">Hour by hour</span>
        <span>
          {peak
            ? <>Highest: <b className={`lv-${peak.level} lv-text`}>{levelName(peak.level)}</b>, {clock(peak.start, zone)} – {clock(peak.end, zone)}</>
            : hours.some((h) => h.level === "unknown")
              ? "Some hours have no NWS data"
              : "No hour meets a Storm Signal threshold"}
        </span>
      </figcaption>
      <div className="ribbon-cells" role="img" aria-label={`Storm Signal level by hour: ${runs.join("; ")}.`}>
        {hours.map((h, i) => (
          <i key={h.start} className={`lv-${h.level}${i === 0 ? " now" : ""}`} title={`${hourOnly(h.start, zone)}: ${levelName(h.level)}`} />
        ))}
      </div>
      <div className="ribbon-ticks" aria-hidden="true">
        {hours.map((h, i) => (
          <span key={h.start}>{i === 0 ? "Now" : i % 3 === 0 ? hourOnly(h.start, zone) : ""}</span>
        ))}
      </div>
    </figure>
  );
}
