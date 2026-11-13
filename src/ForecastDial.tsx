import { useId } from "react";
import type { Assessment, Weather } from "../shared/types";
import type { OptionResult } from "../shared/impactEngine";
import { dialModel } from "../shared/dial";
import { HOUR, levelName } from "../shared/rules";
import { clock, day, stamp, zoneName } from "./format";

const xy = (angle: number, r: number) => ({ x: 260 + r * Math.sin(angle), y: 260 - r * Math.cos(angle) });
const radians = (hours: number) => hours * Math.PI / 6;
const segment = (from: number, to: number) => {
  const a = xy(radians(from), 212), b = xy(radians(to), 212);
  return `M${a.x} ${a.y}A212 212 0 ${to - from > 6 ? 1 : 0} 1 ${b.x} ${b.y}`;
};

export function ForecastDial({ weather, assessment, options, selected }: {
  weather: Weather; assessment: Assessment; options: OptionResult[]; selected: string;
}) {
  const hatch = useId().replace(/:/g, "");
  const model = dialModel(weather, assessment, options);
  const zone = weather.location.timeZone;
  const unknown = model.hours.some((h) => h.level === "unknown");
  const level = model.peak?.level ?? (unknown ? "unknown" : "low");
  const selectedOption = options.find((o) => o.key === selected);
  return (
    <figure className="forecast-dial">
      <figcaption className="dial-caption">
        <span className="eyebrow">Your next 12 hours</span>
        <span>{day(model.start, zone)} · {zoneName(model.start, zone)}</span>
      </figcaption>
      <svg viewBox="-12 -12 544 544" role="img" aria-label={`Twelve-hour forecast timeline. ${stamp(model.start, zone)} to ${stamp(model.end, zone)}. ${model.hours.map((h) => `${clock(h.start, zone)}: ${levelName(h.level)}`).join("; ")}. ${model.markers.map((o) => `Option ${o.key}: ${o.label}, ${clock(o.start, zone)}`).join(". ")}`}>
        <defs><pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V6" stroke="var(--lv-unknown)" strokeWidth="2" /></pattern></defs>
        <circle className="dial-track" cx="260" cy="260" r="212" />
        <circle className="dial-inner" cx="260" cy="260" r="145" />
        {model.hours.map((h, i) => {
          const p = xy(radians(i), 176);
          return <g key={h.start}>
            <path className={`dial-hour lv-${h.level}`} d={segment(i + 0.025, i + 0.975)} style={h.level === "unknown" ? { stroke: `url(#${hatch})` } : undefined}>
              <title>{clock(h.start, zone)}: {levelName(h.level)}</title>
            </path>
            <text className="dial-hour-label" x={p.x} y={p.y + 4} textAnchor="middle">{i === 0 ? "NOW" : clock(h.start, zone).replace(":00", "")}</text>
          </g>;
        })}
        {selectedOption && selectedOption.start >= model.start && selectedOption.start < model.end && (
          <path transform="translate(260 260) scale(1.08) translate(-260 -260)" className="dial-duration" d={segment((selectedOption.start - model.start) / HOUR, Math.min(12, (selectedOption.end - model.start) / HOUR))} />
        )}
        {model.markers.map((o, i) => {
          // Offset the optional D marker onto its own track to keep coincident start times legible.
          const p = xy(radians((o.start - model.start) / HOUR), i === 3 ? 254 : 239);
          return <g key={o.key} className={`dial-marker${o.key === selected ? " selected" : ""}`}>
            <circle cx={p.x} cy={p.y} r={14} />
            <text x={p.x} y={p.y + 4} textAnchor="middle">{o.key}</text>
          </g>;
        })}
        <text x="260" y="222" textAnchor="middle" className="dial-center-caption">{model.peak ? "HIGHEST WEATHER LEVEL" : "FORECAST OUTLOOK"}</text>
        <text x="260" y="265" textAnchor="middle" className={`dial-center-level lv-${level}`}>{model.peak ? levelName(level) : unknown ? "Incomplete data" : "No flagged window"}</text>
        <text x="260" y="298" textAnchor="middle" className="dial-center-time">{model.peak ? `${clock(model.peak.start, zone)}–${clock(model.peak.end, zone)}` : "Check official NWS alerts"}</text>
        <text x="260" y="324" textAnchor="middle" className="dial-center-caption">{model.peak ? "APPROXIMATE FORECAST WINDOW" : "NOT AN ALL-CLEAR"}</text>
      </svg>
      <div className="dial-legend"><span><i className="dial-key" />Hourly Storm Signal level</span><span><i className="duration-key" />Selected activity duration</span></div>
      <p className="fine">{stamp(model.start, zone)} → {stamp(model.end, zone)}.</p>
      {model.outside.map((o) => <p className="fine" key={o.key}>Option {o.key} starts {stamp(o.start, zone)}, outside this 12-hour dial.</p>)}
      {selectedOption && selectedOption.start < model.end && selectedOption.end > model.end && <p className="fine">Option {selectedOption.key} continues beyond the dial to {stamp(selectedOption.end, zone)}.</p>}
      <details className="dial-text-timeline"><summary>Read the hourly timeline</summary><p>Letter markers match the compared start times. The ring shows general weather; the options use activity-specific rules.</p>{model.peak && <p>Highest window: {levelName(model.peak.level)}, {stamp(model.peak.start, zone)} → {stamp(model.peak.end, zone)}.</p>}<ul>{model.hours.map((h) => <li key={h.start}>{stamp(h.start, zone)}: <strong>{levelName(h.level)}</strong></li>)}</ul></details>
    </figure>
  );
}
