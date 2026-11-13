import { useMemo } from "react";
import type { Classification, Weather } from "../shared/types";
import { LEVELS } from "../shared/types";
import { computeDrift, fmt } from "../shared/drift";
import { levelName } from "../shared/rules";
import type { HistoryState } from "./useHistory";
import { clock, day } from "./format";

const TREND: Record<string, { word: string; glyph: string }> = {
  worse: { word: "Trending worse", glyph: "↗" },
  better: { word: "Trending better", glyph: "↘" },
  stable: { word: "Steady", glyph: "→" },
  shifting: { word: "Shifting", glyph: "↕" },
  unknown: { word: "Collecting history", glyph: "·" },
};

export function DriftPanel({
  weather,
  level,
  history,
  now,
  simulated,
}: {
  weather: Weather | null;
  level: Classification | null;
  history: HistoryState;
  now: number;
  simulated: boolean;
}) {
  const zone = weather?.location.timeZone ?? "America/Detroit";
  const drift = useMemo(
    () => (weather && level ? computeDrift(weather, history.snapshots, level, now) : null),
    [weather, level, history.snapshots, now],
  );
  return (
    <section className="drift" aria-labelledby="drift-h">
      <h2 id="drift-h" className="section-h">
        How the forecast has changed{simulated ? " (simulated history)" : ""}
      </h2>
      {!history.tracked ? (
        <p className="muted">
          Forecast history is saved for the listed cities only. Pick one to see how its forecast has shifted.
        </p>
      ) : history.loading ? (
        <p className="muted">Loading saved forecasts…</p>
      ) : history.error ? (
        <p className="notice">Forecast history is unavailable right now. The current forecast above is unaffected.</p>
      ) : !drift ? (
        <p className="muted">Waiting for the current forecast.</p>
      ) : (
        <>
          <p className={`trend trend-${drift.trend}`}>
            <span aria-hidden="true">{TREND[drift.trend].glyph}</span> {TREND[drift.trend].word}
          </p>
          <p className="drift-summary">{drift.summary}</p>
          {drift.changes.length > 0 && (
            <ul className="drift-changes">
              {drift.changes.map((c) => (
                <li key={c.key}>
                  <span>{c.label}, same hours</span>
                  <span className="num">
                    {fmt(c.before, c.unit)} → {fmt(c.after, c.unit)}{" "}
                    <b>
                      ({c.delta > 0 ? "+" : "−"}
                      {fmt(Math.abs(c.delta), c.unit)})
                    </b>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {drift.levels.length > 1 && (
            <figure className="level-strip">
              <div
                className="strip"
                role="img"
                aria-label={`Storm Signal level in ${drift.levels.length} saved forecasts: ${drift.levels
                  .map((l) => levelName(l.level))
                  .join(", ")}`}
              >
                {drift.levels.map((l) => (
                  <i
                    key={l.at}
                    className={`lv-${l.level}`}
                    style={{ height: `${l.level === "unknown" ? 4 : (LEVELS.indexOf(l.level) + 1) * 6}px` }}
                    title={`${day(Date.parse(l.at), zone)} ${clock(Date.parse(l.at), zone)}: ${levelName(l.level)}`}
                  />
                ))}
              </div>
              <figcaption className="fine">
                Level in each saved forecast, oldest to newest ({day(Date.parse(drift.levels[0].at), zone)}{" "}
                {clock(Date.parse(drift.levels[0].at), zone)} → now).
              </figcaption>
            </figure>
          )}
          <p className="fine">
            {simulated
              ? "Fictional history for this scenario."
              : "A scheduled AWS Lambda saves a copy of each new NWS forecast. Comparisons use the same forecast hours in both copies."}{" "}
            A forecast that keeps changing is less certain.
          </p>
        </>
      )}
    </section>
  );
}
