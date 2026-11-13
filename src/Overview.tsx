import type { Assessment, Weather } from "../shared/types";
import { HOUR } from "../shared/rules";
import { OVERVIEW_RULES } from "../shared/riskEngine";
import { AlertItem, FactorList, LevelMark, Limitations } from "./components";
import { day, hourOnly, stamp, unknown } from "./format";

interface Props {
  weather: Weather | null;
  assessment: Assessment | null;
  loading: boolean;
  now: number;
  go: (page: string) => void;
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

export function Overview({ weather, assessment, loading, now, go }: Props) {
  const zone = weather?.location.timeZone ?? "America/Detroit";
  const simulated = weather?.source === "simulated";
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
      <section className="verdict" aria-labelledby="verdict-h">
        <p className="eyebrow" id="verdict-h">
          Storm Signal level · next 24 hours
        </p>
        {assessment ? (
          <>
            <LevelMark level={assessment.level} size="lg" />
            <p className="verdict-summary">{assessment.summary}</p>
            <p className="fine">
              {stamp(assessment.windowStart, zone)} →{" "}
              {stamp(assessment.windowEnd, zone)}. A Storm Signal level comes
              from documented rules applied to NWS data. It is not an official
              NWS rating. <a href="#method">How levels work</a>
            </p>
          </>
        ) : (
          <p className="verdict-summary">
            {loading
              ? "Retrieving National Weather Service data…"
              : "No assessment: weather data could not be retrieved."}
          </p>
        )}
        <div className="verdict-actions">
          <button className="primary" onClick={() => go("whatif")}>
            Compare my plans →
          </button>
          <button onClick={() => go("prep")}>Build a prep list →</button>
        </div>
      </section>

      <section className="official-col" aria-labelledby="alerts-h">
        <h2 id="alerts-h" className="section-h">
          {simulated ? "Simulated alerts" : "Official NWS alerts"}
        </h2>
        {loading && !weather ? (
          <p className="muted">Checking alerts…</p>
        ) : !weather?.availability.alerts ? (
          <p className="notice notice-bad">
            Alert status unknown: retrieval failed. Check weather.gov directly.
          </p>
        ) : weather.alerts.length === 0 ? (
          <p className="muted">
            NWS returned no active alerts for this point at{" "}
            {stamp(Date.parse(weather.fetchedAt), zone)}. That is not an
            all-clear.
          </p>
        ) : (
          weather.alerts.map((a) => (
            <AlertItem key={a.id} alert={a} zone={zone} simulated={simulated} />
          ))
        )}

        <h2 className="section-h">Now</h2>
        {obs ? (
          <>
            <dl className="obs">
              <div>
                <dt>Conditions</dt>
                <dd>{obs.description || "not reported"}</dd>
              </div>
              <div>
                <dt>Temperature</dt>
                <dd className="num">{unknown(obs.temperatureF, "°F")}</dd>
              </div>
              <div>
                <dt>Wind</dt>
                <dd className="num">
                  {unknown(obs.windMph, " mph")}
                  {obs.gustMph !== null
                    ? `, gusts ${Math.round(obs.gustMph)}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd className="num">{unknown(obs.visibilityMi, " mi", 1)}</dd>
              </div>
            </dl>
            <p className="fine">
              Observed at <span className="num">{obs.station}</span>{" "}
              {obs.stationName}, {stamp(Date.parse(obs.timestamp), zone)}
            </p>
          </>
        ) : (
          <p className="muted">
            {loading
              ? "Checking the nearest station…"
              : "Current observation unavailable."}
          </p>
        )}
      </section>

      <section className="why" aria-labelledby="why-h">
        <h2 id="why-h" className="section-h">
          Why this level
        </h2>
        {assessment &&
          assessment.factors.length === 0 &&
          assessment.level === "low" && (
            <p className="muted">
              No wind, thunder, snow, ice or temperature threshold is met and no
              alerts are active.
            </p>
          )}
        {assessment && <FactorList factors={assessment.factors} />}
        {assessment && (
          <Limitations
            items={assessment.limitations}
            title="What this assessment could not check"
          />
        )}
      </section>

      <section className="hourly" aria-labelledby="hourly-h">
        <h2 id="hourly-h" className="section-h">
          Hourly forecast
        </h2>
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
      </section>

      <section className="method" id="method" aria-labelledby="method-h">
        <h2 id="method-h" className="section-h">
          How levels work
        </h2>
        <ol className="method-list">
          <li>
            Every <b>official NWS alert</b> sets a floor: advisory or statement
            → Moderate, watch → Elevated, warning → High, tornado/extreme
            warnings → Critical. NWS’s own severity is shown next to it,
            unchanged.
          </li>
          <li>
            Forecast values from the NWS hourly and gridpoint data are checked
            against fixed thresholds: gusts, sustained wind, thunder chance,
            snow and ice totals, and feels-like temperature.
          </li>
          <li>
            The highest matching rule sets the level. Each rule shows the value,
            the threshold and the hours it applies to.
          </li>
          <li>
            If any source is missing or the forecast doesn’t cover the window,
            the level can’t be <b>Low</b>. It shows as <b>Unknown</b> instead.
          </li>
        </ol>
        <p className="fine">
          Thresholds and their sources are listed in the project’s architecture
          notes. Storm Signal does not predict damage or the chance of an
          accident.
        </p>
      </section>
    </div>
  );
}
