import { useMemo } from "react";
import type { Weather } from "../shared/types";
import {
  ACTIVITIES,
  compareOptions,
  explainDifferences,
  type Activity,
} from "../shared/impactEngine";
import {
  FactorList,
  LevelMark,
  Limitations,
  PausedDuringWarning,
  WhatWouldChange,
} from "./components";
import { HOUR } from "../shared/rules";
import { clock, day, hourOnly, unknown } from "./format";

interface Props {
  weather: Weather | null;
  loading: boolean;
  now: number;
  activity: Activity;
  setActivity: (a: Activity) => void;
  hours: number;
  setHours: (h: number) => void;
  custom: number | null;
  setCustom: (t: number | null) => void;
}

const durationLabel = (h: number) =>
  h < 1 ? `${h * 60} minutes` : `${h} hour${h === 1 ? "" : "s"}`;

export function WhatIf({
  weather,
  loading,
  now,
  activity,
  setActivity,
  hours,
  setHours,
  custom,
  setCustom,
}: Props) {
  const zone = weather?.location.timeZone ?? "America/Detroit";
  const spec = ACTIVITIES[activity];
  const options = useMemo(
    () => (weather ? compareOptions(weather, activity, hours, now, custom) : []),
    [weather, activity, hours, now, custom],
  );
  // Start-hour choices come from the forecast itself, so they are always absolute, zone-correct times.
  const hourStarts = (weather?.periods ?? [])
    .map((p) => Date.parse(p.start))
    .filter((t) => t + HOUR > now && t < now + 48 * HOUR);
  const customHour = custom === null ? "" : String(hourStarts.find((t) => custom >= t && custom < t + HOUR) ?? "");
  const customMinute = custom === null || !customHour ? 0 : Math.round((custom - Number(customHour)) / 60000);
  const setYourTime = (hourMs: string, minute: number) =>
    setCustom(hourMs ? Math.max(Number(hourMs) + minute * 60000, now) : null);
  const diffs = useMemo(
    () => explainDifferences(options, zone),
    [options, zone],
  );
  const urgent = options[0]?.urgent;

  return (
    <div className="page whatif">
      <header className="page-head">
        <h1 tabIndex={-1}>What if?</h1>
        <p className="lede">
          Same forecast, different choices. Compare what the forecast shows for
          three start times.
        </p>
      </header>

      <div className="controls" role="group" aria-label="Plan">
        <fieldset className="segmented">
          <legend>Activity</legend>
          {(Object.keys(ACTIVITIES) as Activity[]).map((a) => (
            <label key={a} className={a === activity ? "on" : ""}>
              <input
                type="radio"
                name="activity"
                value={a}
                checked={a === activity}
                onChange={() => {
                  setActivity(a);
                  setHours(ACTIVITIES[a].defaultHours);
                }}
              />
              {ACTIVITIES[a].label}
            </label>
          ))}
        </fieldset>
        <label className="duration">
          <span>Duration</span>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            {spec.durations.map((h) => (
              <option key={h} value={h}>
                {durationLabel(h)}
              </option>
            ))}
          </select>
        </label>
        <div className="yourtime" role="group" aria-labelledby="yourtime-l">
          <span id="yourtime-l">Your own start time (D)</span>
          <div>
            <select
              aria-label="Start hour"
              value={customHour}
              onChange={(e) => setYourTime(e.target.value, customMinute)}
              disabled={!hourStarts.length}
            >
              <option value="">Not set</option>
              {hourStarts.map((t) => (
                <option key={t} value={t}>
                  {day(t, zone).split(",")[0]} {hourOnly(t, zone)}
                </option>
              ))}
            </select>
            <select
              aria-label="Start minute"
              value={customMinute}
              onChange={(e) => setYourTime(customHour, Number(e.target.value))}
              disabled={!customHour}
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  :{String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
            {custom !== null && (
              <button type="button" className="text-btn" onClick={() => setCustom(null)}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {urgent && (
        <div className="override" role="alert">
          <strong>
            {weather?.source === "simulated" ? "SIMULATED: " : ""}
            {urgent.event} in effect. Comparing plans doesn't apply right now.
          </strong>
          <p>
            Follow the official instructions at the top of the page. The options
            below are shown for reference only.
          </p>
        </div>
      )}

      {!weather ? (
        <p className="muted">
          {loading
            ? "Retrieving forecast…"
            : "No forecast available, so there's nothing to compare. Check weather.gov."}
        </p>
      ) : (
        <>
          <PausedDuringWarning
            active={!!urgent}
            label="The comparison is paused during this warning. Show it anyway."
          >
            <ol className="options" aria-label="Compared options">
              {options.map((o) => (
                <li key={o.key} className={`option lv-${o.level}`}>
                  <div className="option-head">
                    <span className="key" aria-hidden="true">
                      {o.key}
                    </span>
                    <div>
                      <h2>{o.label}</h2>
                      <p className="num when">
                        {day(o.start, zone)} · {clock(o.start, zone)}–
                        {clock(o.end, zone)}
                      </p>
                    </div>
                  </div>
                  <LevelMark level={o.level} />
                  <p className="exposure-label">
                    {o.level === "unknown"
                      ? "Exposure can't be rated"
                      : "Exposure on forecast evidence"}
                  </p>
                  <WhatWouldChange level={o.level} factors={o.factors} />
                  <dl className="conds">
                    <div>
                      <dt>Peak gust</dt>
                      <dd>{unknown(o.conditions.maxGust, " mph")}</dd>
                    </div>
                    <div>
                      <dt>Wind</dt>
                      <dd>{unknown(o.conditions.maxWind, " mph")}</dd>
                    </div>
                    <div>
                      <dt>Thunder</dt>
                      <dd>{unknown(o.conditions.maxThunder, "%")}</dd>
                    </div>
                    <div>
                      <dt>Precip</dt>
                      <dd>{unknown(o.conditions.maxPrecip, "%")}</dd>
                    </div>
                    <div>
                      <dt>Temp</dt>
                      <dd>
                        {o.conditions.tempLow === null
                          ? "unknown"
                          : o.conditions.tempLow === o.conditions.tempHigh
                            ? `${o.conditions.tempLow}°`
                            : `${o.conditions.tempLow}–${o.conditions.tempHigh}°`}
                      </dd>
                    </div>
                    {(o.conditions.snow ?? 0) > 0 ||
                    (o.conditions.ice ?? 0) > 0 ? (
                      <div>
                        <dt>Snow / ice</dt>
                        <dd>
                          {unknown(o.conditions.snow, " in", 1)} /{" "}
                          {unknown(o.conditions.ice, " in", 2)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="wording">
                    {o.conditions.wording.join(" → ") || "No forecast wording"}
                  </p>
                  {o.factors.length ? (
                    <FactorList factors={o.factors} />
                  ) : o.level === "low" ? (
                    <p className="muted small">
                      No {spec.label.toLowerCase()} threshold met in this
                      window.
                    </p>
                  ) : null}
                  <Limitations items={o.limitations} title="Unknowns" />
                </li>
              ))}
            </ol>
          </PausedDuringWarning>

          <section className="diffs" aria-labelledby="diffs-h">
            <h2 id="diffs-h" className="section-h">
              What changes between options
            </h2>
            <ul>
              {diffs.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <ul className="notes">
              {spec.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>
                No time is called safe. Forecasts change, storms can form
                between updates, and an official warning overrides this
                comparison.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
