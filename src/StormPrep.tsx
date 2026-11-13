import { useEffect, useMemo, useState } from "react";
import type { Assessment, Weather } from "../shared/types";
import {
  buildPlan,
  CATEGORIES,
  HAZARD_LABEL,
  hazardWindows,
  type Category,
} from "../shared/preparationEngine";
import { LevelMark, PausedDuringWarning } from "./components";
import { download, LEAD_MINUTES, prepCalendar } from "./ics";

interface Saved {
  categories: Category[];
  done: string[];
}
const KEY = "stormsignal-prep-v2";
const DEFAULT: Saved = {
  categories: ["home", "household", "electronics"],
  done: [],
};

function load(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && Array.isArray(v.categories) && Array.isArray(v.done))
      return {
        categories: v.categories.filter((c: unknown) =>
          CATEGORIES.some((x) => x.id === c),
        ),
        done: v.done
          .filter((x: unknown) => typeof x === "string")
          .slice(0, 100),
      };
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return DEFAULT;
}

export function StormPrep({
  weather,
  assessment,
}: {
  weather: Weather | null;
  assessment: Assessment | null;
}) {
  const [saved, setSaved] = useState<Saved>(load);
  const [storageOk, setStorageOk] = useState(true);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
  }, [saved]);
  const zone = weather?.location.timeZone ?? "America/Detroit";
  // With no data at all, still offer the baseline steps (hazards treated as unknown, never as none).
  const plan = useMemo(
    () =>
      buildPlan(
        assessment ?? {
          level: "unknown",
          summary: "",
          factors: [],
          limitations: [],
          hazards: [],
          windowStart: Date.now(),
          windowEnd: Date.now(),
          urgent: null,
        },
        saved.categories,
        zone,
      ),
    [assessment, saved.categories, zone],
  );
  const windows = assessment ? hazardWindows(assessment, zone) : [];
  const toggleCat = (c: Category) =>
    setSaved((s) => ({
      ...s,
      categories: s.categories.includes(c)
        ? s.categories.filter((x) => x !== c)
        : [...s.categories, c],
    }));
  const toggleTask = (id: string) =>
    setSaved((s) => ({
      ...s,
      done: s.done.includes(id)
        ? s.done.filter((x) => x !== id)
        : [...s.done, id],
    }));
  const before = plan?.before ?? [];
  const calendarReady =
    weather?.source === "live" && before.some((t) => t.due && t.due - LEAD_MINUTES * 60000 > Date.now());
  const doneCount = before.filter((t) => saved.done.includes(t.id)).length;
  const simulated = weather?.source === "simulated";

  return (
    <div className="page prep">
      <header className="page-head">
        <h1 tabIndex={-1}>Storm prep</h1>
        <p className="lede">
          A checklist built from the hazards in your forecast, with what to do
          before, during and after.
        </p>
      </header>

      {plan?.urgent && (
        <div className="override" role="alert">
          <strong>
            {simulated ? "SIMULATED: " : ""}
            {plan.urgent.event}. Stop preparing and act now.
          </strong>
          <p>
            Follow the official instructions at the top of the page. Protective
            actions are listed first and routine tasks are paused.
          </p>
        </div>
      )}

      <fieldset className="cats">
        <legend>What matters to you</legend>
        {CATEGORIES.map((c) => (
          <label
            key={c.id}
            className={saved.categories.includes(c.id) ? "on" : ""}
          >
            <input
              type="checkbox"
              checked={saved.categories.includes(c.id)}
              onChange={() => toggleCat(c.id)}
            />
            {c.label}
          </label>
        ))}
      </fieldset>

      <section className="hazards" aria-labelledby="hz-h">
        <h2 id="hz-h" className="section-h">
          Hazards driving this plan
        </h2>
        {plan.baselineOnly ? (
          <p className="notice">
            {!assessment || assessment.level === "unknown"
              ? "Hazards can't be determined because weather data is incomplete. These are baseline steps only."
              : "Storm Signal's rules found no specific hazard in the next 24 hours. These are baseline steps worth having in place."}
          </p>
        ) : (
          <ul className="hazard-list">
            {plan.hazards.map((h) => (
              <li key={h}>
                <strong>{HAZARD_LABEL[h]}</strong>
                <span className="num">
                  {windows.find((w) => w.hazard === h)?.label ?? ""}
                </span>
              </li>
            ))}
            <li className="hz-level">
              Overall{" "}
              <LevelMark level={assessment?.level ?? "unknown"} size="sm" />
            </li>
          </ul>
        )}
        <p className="fine">
          Times are approximate forecast windows from NWS data, not exact
          arrival times.
        </p>
      </section>

      <div className="prep-actions">
        <button
          type="button"
          onClick={() => {
            const ics = prepCalendar(before, weather?.location.name ?? "your area");
            if (ics) download("storm-signal-prep.ics", ics, "text/calendar");
          }}
          disabled={!calendarReady}
        >
          Add deadlines to my calendar
        </button>
        <button type="button" onClick={() => window.print()}>
          Print this plan
        </button>
        <p className="fine">
          {weather?.source === "simulated"
            ? "Calendar export is turned off for simulated scenarios."
            : calendarReady
              ? `Creates reminders ${LEAD_MINUTES / 60} hours before each forecast deadline (a .ics file for any calendar app). Nothing is sent anywhere.`
              : "No task has a forecast deadline yet, so there is nothing to add to a calendar."}{" "}
          The plan also stays available offline on this device.
        </p>
      </div>
      <p className="print-only print-meta">
        Storm Signal prep plan · {weather?.location.name ?? ""} · printed {new Date().toLocaleString()}
        {weather?.source === "simulated" ? " · SIMULATED SCENARIO, NOT A REAL FORECAST" : ""}. Follow NWS warnings and local
        officials over this plan.
      </p>

      <div className="phases">
        <section className="phase before" aria-labelledby="before-h">
          <div className="phase-head">
            <h2 id="before-h">Before</h2>
            <p>While conditions are still safe</p>
          </div>
          {saved.categories.length === 0 ? (
            <p className="muted">Choose at least one area above.</p>
          ) : (
            <>
              <div className="progress-line" aria-live="polite">
                <span className="num">
                  {doneCount} of {before.length} done
                </span>
                <span
                  className="progress"
                  role="progressbar"
                  aria-label="Checklist progress"
                  aria-valuemin={0}
                  aria-valuemax={before.length}
                  aria-valuenow={doneCount}
                >
                  <i
                    style={{
                      width: before.length
                        ? `${(doneCount / before.length) * 100}%`
                        : 0,
                    }}
                  />
                </span>
                <button
                  className="text-btn"
                  onClick={() => setSaved((s) => ({ ...s, done: [] }))}
                  disabled={!saved.done.length}
                >
                  Reset
                </button>
              </div>
              <PausedDuringWarning
                active={!!plan?.urgent}
                label="Routine preparation is paused during this warning. Show it anyway."
              >
                <ul className="tasks">
                  {before.map((t) => (
                    <li
                      key={t.id}
                      className={saved.done.includes(t.id) ? "done" : ""}
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={saved.done.includes(t.id)}
                          onChange={() => toggleTask(t.id)}
                        />
                        <span className="task-title">{t.title}</span>
                      </label>
                      <p className="task-why">{t.reason}</p>
                      <p className="task-meta">
                        <span className="when">{t.timing}</span>
                        <a
                          href={t.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t.source.label} ↗
                        </a>
                      </p>
                    </li>
                  ))}
                </ul>
              </PausedDuringWarning>
              {before.length > 0 && doneCount === before.length && (
                <p className="notice">
                  All listed steps checked. That doesn't guarantee safety. Keep
                  watching for warnings.
                </p>
              )}
            </>
          )}
        </section>

        <section
          className={`phase during ${plan?.urgent ? "first" : ""}`}
          aria-labelledby="during-h"
        >
          <div className="phase-head">
            <h2 id="during-h">During</h2>
            <p>Protective actions from official guidance</p>
          </div>
          <ul className="guidance">
            {plan?.during.map((g) => (
              <li key={g.id}>
                <strong>{g.title}</strong>
                <p>{g.detail}</p>
                <a
                  href={g.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {g.source.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="phase after" aria-labelledby="after-h">
          <div className="phase-head">
            <h2 id="after-h">After</h2>
            <p>Once officials say it's over</p>
          </div>
          <ul className="guidance">
            {plan?.after.map((g) => (
              <li key={g.id}>
                <strong>{g.title}</strong>
                <p>{g.detail}</p>
                <a
                  href={g.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {g.source.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="fine">
        {storageOk
          ? "Your choices and checked tasks are saved only in this browser."
          : "Browser storage is unavailable, so changes last only while this tab is open."}{" "}
        Nothing is sent to a server.
      </p>
    </div>
  );
}
