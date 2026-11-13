import { useMemo, useState, type ReactNode } from "react";
import type { Weather, Assessment } from "../shared/types";
import { assess } from "../shared/riskEngine";
import { ForecastDial } from "./ForecastDial";
import { RoutePlanner } from "./RoutePlanner";
import {
  ACTIVITIES,
  compareOptions,
  explainDifferences,
  type Activity,
  optionsSummary,
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

export interface WhatIfProps {
  weather: Weather | null;
  loading: boolean;
  now: number;
  activity: Activity;
  setActivity: (a: Activity) => void;
  hours: number;
  setHours: (h: number) => void;
  custom: number | null;
  setCustom: (t: number | null) => void;
  embedded?: boolean;
  assessment?: Assessment | null;
  routeOrigin?: string;
  simulated?: boolean;
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
  embedded = false,
  assessment,
  routeOrigin = "kalamazoo",
  simulated = false,
}: WhatIfProps) {
  const [selected, setSelected] = useState("A");
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
  const activeKey = options.some((o) => o.key === selected) ? selected : "A";
  const shown = embedded ? options.filter((o) => o.key === activeKey) : options;
  const dialAssessment = useMemo(() => {
    const base = assessment ?? (weather ? assess(weather, now) : null);
    // The dial and option A share one clock, even if the API assessment arrived a few seconds later.
    return base ? { ...base, windowStart: now, windowEnd: now + 24 * HOUR } : null;
  }, [assessment, weather, now]);

  return (
    <div className={`page whatif${embedded ? " embedded" : ""}`}>
      <header className="page-head">
        {embedded ? <h2>Compare your plans</h2> : <h1 tabIndex={-1}>When to go</h1>}
        {!embedded && <p className="lede">
          Pick what you’re planning. Storm Signal checks the forecast for starting now, in 3 hours, in 6 hours or at
          a time you choose, rates the weather risk of each, and explains what’s different.
        </p>}
      </header>

      {!embedded && <RoutePlanner origin={routeOrigin} simulated={simulated} />}
      <div className="decision-workspace">
      {weather && dialAssessment && <ForecastDial weather={weather} assessment={dialAssessment} options={options} selected={activeKey} />}
      <div className="decision-panel">

      <div className="controls" role="group" aria-label="Plan">
        {embedded ? <label className="simple-activity"><span>I’m planning to</span><select value={activity} onChange={(e) => { const a = e.target.value as Activity; setActivity(a); setHours(ACTIVITIES[a].defaultHours); }}>
          {(Object.keys(ACTIVITIES) as Activity[]).map((a) => <option key={a} value={a}>{ACTIVITIES[a].label}</option>)}
        </select></label> : (
        <fieldset className="segmented">
          <legend><b className="step">1</b> What are you planning?</legend>
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
        )}
        <AdvancedControls compact={embedded}>
        <label className="duration">
          <span><b className="step">2</b> How long?</span>
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
          <span id="yourtime-l"><b className="step">3</b> Your own time (optional, shown as D)</span>
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
        </AdvancedControls>
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
            {embedded && <div className="plan-starts" role="group" aria-label="Choose a start time to inspect">
              {options.map((o) => <button key={o.key} type="button" className={o.key === activeKey ? "selected" : ""} aria-pressed={o.key === activeKey} onClick={() => setSelected(o.key)}>
                <span className="plan-start-label"><b>{o.key}</b>{o.label}</span>
                <LevelMark level={o.level} size="sm" />
              </button>)}
            </div>}
            <ol className="options" aria-label="Compared options">
              {shown.map((o) => (
                <li key={o.key} className={`option lv-${o.level}`}>
                  <div className="option-head">
                    {embedded ? <span className="key" aria-hidden="true">{o.key}</span> : <button type="button" className="key" aria-label={`Show option ${o.key} on dial`} aria-pressed={o.key === activeKey} onClick={() => setSelected(o.key)}>{o.key}</button>}
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
                      : "Weather risk for this plan"}
                  </p>
                  {embedded && <p className="selection-summary">{o.factors[0]?.evidence ?? (o.level === "low" ? "No activity-specific threshold is met in this window. This does not establish safety." : o.limitations[0] ?? "Data is incomplete for this window.")}</p>}
                  <OptionExplanation compact={embedded}>
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
                  </OptionExplanation>
                </li>
              ))}
            </ol>
          </PausedDuringWarning>

          <ComparisonDetails compact={embedded}>
          <section className="diffs" aria-labelledby="diffs-h">
            <h2 id="diffs-h" className="section-h">
              How the options compare
            </h2>
            <p className="options-summary">{optionsSummary(options)}</p>
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
          </ComparisonDetails>
          {embedded && <a className="prep-next" href="#prep">Next: build my preparation checklist →</a>}
        </>
      )}
      </div>
      </div>
    </div>
  );
}

function OptionExplanation({compact, children}: {compact: boolean; children: ReactNode}) {
  return compact ? <details className="option-explanation"><summary>Forecast evidence and limitations</summary><div>{children}</div></details> : <>{children}</>;
}

function AdvancedControls({compact, children}: {compact: boolean; children: ReactNode}) {
  return compact ? <details className="advanced-controls"><summary>Duration and custom time</summary><div>{children}</div></details> : <>{children}</>;
}

function ComparisonDetails({compact, children}: {compact: boolean; children: ReactNode}) {
  return compact ? <details className="comparison-details"><summary>Why the options differ</summary>{children}</details> : <>{children}</>;
}
