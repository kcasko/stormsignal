import type { ReactNode } from "react";
import type { Alert, Classification, Factor } from "../shared/types";
import { LEVELS } from "../shared/types";
import { levelName } from "../shared/rules";
import { stamp } from "./format";

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
}: {
  alert: Alert;
  zone: string;
  simulated: boolean;
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
