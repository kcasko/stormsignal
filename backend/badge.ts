// Embeddable status badge: a small SVG anyone can put on a school, event or club website.
// Pure rendering here; the handler resolves the place and level. No script, no external fonts.
import type { Classification } from "../shared/types";
import { levelName } from "../shared/rules";

// Light-mode level colours from the app (each ≥ 5:1 against white text).
const FILL: Record<Classification, string> = {
  low: "#33604c",
  moderate: "#735800",
  elevated: "#9a4607",
  high: "#a31f15",
  critical: "#6e1c93",
  unknown: "#5d626a",
};

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Rough width of 12px system sans text, so the badge sizes itself without a font engine. */
const textWidth = (s: string) =>
  [...s].reduce((w, c) => w + (/[ilj.,'|!:;]/.test(c) ? 3.6 : /[mwMW]/.test(c) ? 10 : /[A-Z0-9]/.test(c) ? 8 : 6.6), 0);

export function renderBadge(level: Classification, place: string): string {
  const name = place.length > 32 ? place.slice(0, 31) + "…" : place;
  const word = level === "unknown" ? "Unavailable" : levelName(level);
  const right = name ? `${word} · ${name}` : word;
  const lw = 126,
    rw = Math.ceil(textWidth(right)) + 22,
    w = lw + rw,
    h = 28;
  const label = `Storm Signal level${place ? ` for ${place}` : ""}: ${level === "unknown" ? "unavailable" : levelName(level)}. Not an official NWS rating.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(label)}">
<title>${escape(label)}</title>
<rect width="${w}" height="${h}" rx="4" fill="#102238"/>
<rect x="${lw}" width="${rw}" height="${h}" rx="4" fill="${FILL[level]}"/>
<rect x="${lw}" width="6" height="${h}" fill="${FILL[level]}"/>
<path d="M11 15h4l2.5-6 4 12 3-9 2 3h4" fill="none" stroke="#f29a50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<g font-family="system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif" font-size="12" fill="#fff">
<text x="38" y="18" font-weight="700">Storm Signal</text>
<text x="${lw + 11}" y="18" font-weight="600">${escape(right)}</text>
</g>
</svg>`;
}
