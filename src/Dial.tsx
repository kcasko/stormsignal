import type { Window } from "../shared/types";
import { HOUR, timeLabel } from "../shared/planning";
const xy = (angle: number, r: number) => ({
  x: 280 + r * Math.sin((angle * Math.PI) / 180),
  y: 280 - r * Math.cos((angle * Math.PI) / 180),
});
const angle = (time: number, anchor: number) => ((time - anchor) / HOUR) * 30;
function arc(start: number, end: number, anchor: number) {
  const a = angle(start, anchor),
    b = angle(end, anchor);
  const p = xy(a, 258),
    q = xy(b, 258);
  return `M${p.x} ${p.y}A258 258 0 ${b - a > 180 ? 1 : 0} 1 ${q.x} ${q.y}`;
}
export function Dial({
  anchor,
  a,
  b,
  windows,
  zone,
  available,
}: {
  anchor: number;
  a: number;
  b: number;
  windows: Window[];
  zone: string;
  available: boolean;
}) {
  const first = windows[0];
  return (
    <svg
      className="dial"
      viewBox="0 0 560 560"
      role="img"
      aria-label={`Twelve-hour forecast timeline. Option A ${timeLabel(a, zone)}. Option B ${timeLabel(b, zone)}. ${available ? windows.length + " flagged weather windows." : "Forecast unavailable."} Timing does not establish safety.`}
    >
      <circle cx="280" cy="280" r="258" fill="none" stroke="#34383e" />
      {Array.from({ length: 12 }, (_, i) => {
        const p = xy(i * 30, 211),
          t = xy(i * 30, 243),
          u = xy(i * 30, 250);
        return (
          <g key={i}>
            <path d={`M${t.x} ${t.y}L${u.x} ${u.y}`} stroke="#778393" />
            <text
              x={p.x}
              y={p.y + 5}
              textAnchor="middle"
              fill="#c3cbd6"
              fontSize="14"
              fontFamily="Arial,sans-serif"
            >
              {timeLabel(anchor + i * HOUR, zone).replace(":00", "")}
            </text>
          </g>
        );
      })}
      {windows.map((w, i) => (
        <path
          key={i}
          d={arc(w.start, Math.min(w.end, w.start + 12 * HOUR - 1000), anchor)}
          fill="none"
          stroke="#e5b865"
          strokeWidth="8"
        />
      ))}
      {[
        { name: "A", time: a, color: "#a9c8ff" },
        { name: "B", time: b, color: "#e5b865" },
      ].map((m) => (
        <g
          key={m.name}
          style={{
            transform: `rotate(${angle(m.time, anchor)}deg)`,
            transformOrigin: "280px 280px",
            transition: "transform .3s ease",
          }}
        >
          <circle cx="280" cy="22" r="18" fill={m.color} />
          <text
            x="280"
            y="27"
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="#11151b"
            style={{
              transform: `rotate(${-angle(m.time, anchor)}deg)`,
              transformOrigin: "280px 22px",
              transition: "transform .3s ease",
            }}
          >
            {m.name}
          </text>
        </g>
      ))}
      <text
        x="280"
        y="242"
        textAnchor="middle"
        fill="#b4bdc9"
        fontSize="12"
        letterSpacing="1"
      >
        {available ? "FORECAST WEATHER WINDOW" : "DATA UNAVAILABLE"}
      </text>
      <text
        x="280"
        y="285"
        textAnchor="middle"
        fill="#f1f3f6"
        fontSize={first ? 27 : 22}
      >
        {first
          ? timeLabel(first.start, zone) + "–" + timeLabel(first.end, zone)
          : available
            ? "No flagged window"
            : "Check weather.gov"}
      </text>
      <text x="280" y="319" textAnchor="middle" fill="#e5b865" fontSize="11">
        {first
          ? "TIMING UNCERTAIN"
          : available
            ? "NOT AN ALL-CLEAR"
            : "DO NOT RELY ON THIS VIEW"}
      </text>
    </svg>
  );
}
