import type { ReactNode } from "react";
import type { Alert, Classification, Factor } from "../shared/types";
import { LEVELS } from "../shared/types";
import { levelName } from "../shared/rules";
import { stamp } from "./format";
import { whatWouldChange } from "../shared/counterfactual";
import type { AlertStory } from "../shared/alertHistory";
import { AlertMap, AlertTimeline } from "./AlertArea";

/** Level word + five-segment glyph. Never colour alone. */
export function LevelMark({
  level,
  size = "md",
}: {
  level: Classification;
  size?: "sm" | "md" | "lg";
}) {
  const filled = level === "unknown" ? 0 : LEVELS.indexOf(level) + 1;
  return (
    <span
      className={`level level-${level} level-${size}`}
      role="img"
      aria-label={
        level === "unknown"
          ? "Storm Signal level: Unknown (not enough data)"
          : `Storm Signal level: ${levelName(level)}, ${filled} of 5`
      }
    >
      <span className="level-word" aria-hidden="true">
        {levelName(level)}
      </span>
      <span className="level-glyph" aria-hidden="true">
        {LEVELS.map((_, i) => (
          <i
            key={i}
            className={level === "unknown" ? "hatch" : i < filled ? "on" : ""}
          />
        ))}
      </span>
    </span>
  );
}

/** The headline level: the word, then all five steps labelled so the scale explains itself. */
export function LevelScale({ level }: { level: Classification }) {
  const at = level === "unknown" ? -1 : LEVELS.indexOf(level);
  return (
    <div
      className={`scale level-${level}`}
      role="img"
      aria-label={
        level === "unknown"
          ? "Storm Signal level: Unknown (not enough data)"
          : `Storm Signal level: ${levelName(level)}, step ${at + 1} of 5`
      }
    >
      <span className="scale-word" aria-hidden="true">
        {levelName(level)}
      </span>
      <ol className="scale-steps" aria-hidden="true">
        {LEVELS.map((l, i) => (
          <li
            key={l}
            className={`lv-${l}${level === "unknown" ? " hatch" : i <= at ? " on" : ""}${i === at ? " here" : ""}`}
          >
            <i />
            <span>{levelName(l)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function FactorList({ factors }: { factors: Factor[] }) {
  if (!factors.length) return null;
  return (
    <ul className="factors">
      {factors.map((f) => (
        <li key={f.id} className={`factor lv-${f.level}`}>
          <div className="factor-head">
            <strong>{f.title}</strong>
            {f.basis === "official" && (
              <span className="tag tag-official">Official NWS</span>
            )}
            <LevelMark level={f.level} size="sm" />
          </div>
          <p className="evidence">
            {f.evidence.charAt(0).toUpperCase() + f.evidence.slice(1)}.
          </p>
          {f.impact && <p className="impact">{f.impact}</p>}
        </li>
      ))}
    </ul>
  );
}

export function Limitations({
  items,
  title = "Limitations",
}: {
  items: string[];
  title?: string;
}) {
  if (!items.length) return null;
  return (
    <div className="limits">
      <h4>{title}</h4>
      <ul>
        {Array.from(new Set(items)).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

export function AlertItem({
  alert,
  zone,
  simulated,
  map,
  story,
}: {
  alert: Alert;
  zone: string;
  simulated: boolean;
  /** Where the user is, for the area map. */
  map?: { lat: number; lon: number; place: string };
  story?: AlertStory;
}) {
  return (
    <article className={`alert alert-${alert.kind}`}>
      <header>
        <span className="tag tag-official">
          {simulated ? "Simulated" : "Official NWS"} {alert.kind}
        </span>
        <h3>{alert.event}</h3>
        <p className="meta">
          NWS severity <b>{alert.severity || "not given"}</b> · urgency{" "}
          {alert.urgency || "not given"}
          <br />
          {alert.onset ? `From ${stamp(Date.parse(alert.onset), zone)} · ` : ""}
          until {stamp(Date.parse(alert.ends || alert.expires), zone)}
        </p>
      </header>
      {alert.headline && <p className="headline">{alert.headline}</p>}
      {map && <AlertMap alert={alert} lat={map.lat} lon={map.lon} place={map.place} simulated={simulated} />}
      {story && <AlertTimeline story={story} zone={zone} />}
      <details open={alert.kind === "warning"}>
        <summary>Instructions and full text</summary>
        <h4>Instructions</h4>
        <p className="prose">
          {alert.instruction ||
            "No instruction text was provided. Read the full message and follow local officials."}
        </p>
        <h4>Description</h4>
        <p className="prose">
          {alert.description || "No description provided."}
        </p>
        <p className="meta">Area: {alert.area}</p>
      </details>
    </article>
  );
}

/** During an urgent warning, routine content collapses behind a labelled, full-contrast disclosure. */
export function PausedDuringWarning({
  active,
  label,
  children,
}: {
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  if (!active) return <>{children}</>;
  return (
    <details className="paused">
      <summary>{label}</summary>
      {children}
    </details>
  );
}

/** "What would change the level": the forecast changes needed to lower it. */
export function WhatWouldChange({ level, factors }: { level: Classification; factors: Factor[] }) {
  const cf = whatWouldChange(level, factors);
  if (!cf) return null;
  return (
    <div className="cf">
      <p className="cf-head">{cf.headline}</p>
      <ul>
        {cf.conditions.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}
