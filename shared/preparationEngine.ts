// Hazard-specific preparation plan. Every task carries a reason, timing and a source.
// Completing tasks does not guarantee safety; official warnings override this plan.
import type { Assessment, Hazard } from "./types";
import { rangeLabel, timeLabel } from "./rules";

export type Category = "home" | "vehicle" | "household" | "electronics";
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "home", label: "My home" },
  { id: "vehicle", label: "My vehicle" },
  { id: "household", label: "My household" },
  { id: "electronics", label: "My electronics" },
];

export interface Source {
  label: string;
  url: string;
}
export interface PrepTask {
  id: string;
  category: Category;
  title: string;
  reason: string;
  hazards: Hazard[] | "any";
  source: Source;
  /** Filled in by buildPlan from forecast timing. */
  timing?: string;
}
export interface Guidance {
  id: string;
  title: string;
  detail: string;
  hazards: Hazard[] | "any";
  source: Source;
}

const S = {
  thunder: { label: "NWS Lightning Safety", url: "https://www.weather.gov/safety/lightning" },
  tornado: { label: "NWS Tornado Safety", url: "https://www.weather.gov/safety/tornado" },
  wind: { label: "NWS Wind Safety", url: "https://www.weather.gov/safety/wind" },
  winter: { label: "NWS Winter Safety", url: "https://www.weather.gov/safety/winter" },
  flood: { label: "NWS Flood Safety", url: "https://www.weather.gov/safety/flood" },
  heat: { label: "NWS Heat Safety", url: "https://www.weather.gov/safety/heat" },
  cold: { label: "NWS Cold Safety", url: "https://www.weather.gov/safety/cold" },
  outage: { label: "Ready.gov Power Outages", url: "https://www.ready.gov/power-outages" },
  kit: { label: "Ready.gov Build a Kit", url: "https://www.ready.gov/kit" },
  plan: { label: "Ready.gov Make a Plan", url: "https://www.ready.gov/plan" },
  pets: { label: "Ready.gov Pets", url: "https://www.ready.gov/pets" },
  readyWinter: { label: "Ready.gov Winter Weather", url: "https://www.ready.gov/winter-weather" },
  wea: { label: "NWS Wireless Emergency Alerts", url: "https://www.weather.gov/wrn/wea" },
  roads: { label: "FHWA road conditions by state", url: "https://highways.dot.gov/traffic-info" },
} satisfies Record<string, Source>;

const OUTAGE: Hazard[] = ["wind", "thunderstorm", "tornado", "ice", "winter"];

export const TASKS: PrepTask[] = [
  { id: "e-alerts", category: "electronics", hazards: "any", title: "Turn on emergency alerts on your phone", reason: "Warnings can be issued with little notice. Keep a second way to receive them, like a NOAA Weather Radio.", source: S.wea },
  { id: "e-charge", category: "electronics", hazards: OUTAGE, title: "Charge phones and power banks", reason: "This hazard can cause power outages, and your phone is how warnings reach you.", source: S.outage },
  { id: "e-light", category: "electronics", hazards: OUTAGE, title: "Put flashlights where you can find them in the dark", reason: "Flashlights are safer than candles during an outage.", source: S.outage },
  { id: "e-surge", category: "electronics", hazards: ["thunderstorm", "tornado"], title: "Unplug sensitive electronics before storms arrive", reason: "Lightning can send surges through wiring. Do not unplug devices during a storm.", source: S.thunder },
  { id: "h-secure", category: "home", hazards: ["wind", "thunderstorm", "tornado"], title: "Secure or bring in outdoor furniture, bins and decorations", reason: "Strong winds turn loose objects into projectiles. Do this before winds increase, only while it's safe.", source: S.wind },
  { id: "h-shelter", category: "home", hazards: ["tornado", "thunderstorm"], title: "Choose your shelter spot", reason: "In a tornado warning there's no time to decide. Pick the lowest floor, an interior room away from windows.", source: S.tornado },
  { id: "h-heat", category: "home", hazards: ["winter", "ice", "cold"], title: "Check heating supplies and test CO alarms", reason: "Outages and cold raise the risk of unsafe heating and carbon monoxide.", source: S.readyWinter },
  { id: "h-pipes", category: "home", hazards: ["cold", "winter"], title: "Protect exposed pipes and know your water shutoff", reason: "Very cold temperatures can freeze and burst pipes.", source: S.readyWinter },
  { id: "h-shovel", category: "home", hazards: ["winter", "ice"], title: "Have a shovel and ice melt ready", reason: "Walkways can ice over quickly.", source: S.winter },
  { id: "h-flood", category: "home", hazards: ["flood"], title: "Move valuables off basement floors", reason: "Basements flood first in heavy rain.", source: S.flood },
  { id: "h-cool", category: "home", hazards: ["heat"], title: "Check air conditioning or plan a cool place to go", reason: "Heat illness can develop indoors without cooling.", source: S.heat },
  { id: "v-park", category: "vehicle", hazards: ["wind", "thunderstorm", "ice", "tornado"], title: "Park away from trees and power lines where you can", reason: "Wind and ice bring down limbs and lines.", source: S.wind },
  { id: "v-fuel", category: "vehicle", hazards: ["winter", "ice", "cold", "flood"], title: "Fill the tank or charge your EV", reason: "Travel can take longer and stations may lose power.", source: S.readyWinter },
  { id: "v-kit", category: "vehicle", hazards: ["winter", "ice", "cold"], title: "Pack a winter car kit", reason: "A blanket, scraper, charger, water and snacks help if you get stuck.", source: S.readyWinter },
  { id: "v-roads", category: "vehicle", hazards: ["winter", "ice", "flood", "wind", "thunderstorm"], title: "Check road conditions and travel advisories before leaving", reason: "Storm Signal doesn't retrieve road conditions. Your state 511 service does.", source: S.roads },
  { id: "v-flood", category: "vehicle", hazards: ["flood"], title: "Plan routes that avoid low spots and underpasses", reason: "Just 12 inches of moving water can carry away most cars.", source: S.flood },
  { id: "hh-plan", category: "household", hazards: "any", title: "Agree where everyone goes and how you'll reach each other", reason: "Everyone should know the plan before conditions change.", source: S.plan },
  { id: "hh-kit", category: "household", hazards: ["winter", "ice", "wind", "flood", "tornado", "thunderstorm"], title: "Gather water, food, medicine and first aid", reason: "Plan for several days without power or travel.", source: S.kit },
  { id: "hh-meds", category: "household", hazards: ["winter", "ice", "wind", "heat", "thunderstorm"], title: "Refill prescriptions and plan for powered medical equipment", reason: "An outage can affect medicine that needs refrigeration and devices that need power.", source: S.outage },
  { id: "hh-pets", category: "household", hazards: ["tornado", "thunderstorm", "winter", "cold", "heat", "flood"], title: "Bring pets inside and have a carrier ready", reason: "Pets need shelter too, and carriers speed up moving to shelter.", source: S.pets },
  { id: "hh-check", category: "household", hazards: ["heat", "cold", "winter"], title: "Plan to check on older relatives and neighbors", reason: "Extreme temperatures hit some people harder.", source: S.heat },
];

export const DURING: Guidance[] = [
  { id: "d-official", hazards: "any", title: "Follow official warnings first", detail: "If NWS issues a warning for your area, its instructions come before anything on this page.", source: S.wea },
  { id: "d-tornado", hazards: ["tornado"], title: "Tornado warning: go to shelter now", detail: "Go to a basement or interior room on the lowest floor, away from windows. Protect your head and neck.", source: { label: "NWS Tornado Safety: during", url: "https://www.weather.gov/safety/tornado-during" } },
  { id: "d-thunder", hazards: ["thunderstorm", "tornado"], title: "When thunder roars, go indoors", detail: "Stay inside until 30 minutes after the last thunder. Avoid plumbing and corded electronics.", source: S.thunder },
  { id: "d-wind", hazards: ["wind"], title: "Stay inside, away from windows", detail: "Avoid unnecessary travel, especially in high-profile vehicles. Keep away from downed lines.", source: S.wind },
  { id: "d-flood", hazards: ["flood", "thunderstorm"], title: "Turn around, don't drown", detail: "Never walk or drive through floodwater. Move to higher ground if told to.", source: S.flood },
  { id: "d-winter", hazards: ["winter", "ice"], title: "Stay off the roads if you can", detail: "If you're stranded, stay with your vehicle and keep the exhaust pipe clear of snow.", source: S.winter },
  { id: "d-heat", hazards: ["heat"], title: "Stay cool and hydrated", detail: "Stay in air conditioning, drink water, and never leave people or pets in a parked car.", source: S.heat },
  { id: "d-cold", hazards: ["cold"], title: "Limit time outside", detail: "Cover exposed skin. Watch for signs of frostbite and hypothermia.", source: S.cold },
];

export const AFTER: Guidance[] = [
  { id: "a-recheck", hazards: "any", title: "Check updated alerts before going out", detail: "Warnings can be extended or reissued. An expired forecast window isn't an all-clear.", source: S.wea },
  { id: "a-lines", hazards: OUTAGE, title: "Stay away from downed power lines", detail: "Treat every downed line as live and report it to your utility.", source: S.outage },
  { id: "a-generator", hazards: OUTAGE, title: "Run generators outdoors only", detail: "Keep them at least 20 feet from windows and doors. Carbon monoxide can kill.", source: S.outage },
  { id: "a-food", hazards: OUTAGE, title: "Check refrigerated food after an outage", detail: "Throw out perishable food that has been above 40°F for 2 hours or more.", source: S.outage },
  { id: "a-floodwater", hazards: ["flood", "thunderstorm"], title: "Avoid floodwater", detail: "It can hide debris, be contaminated or be electrified.", source: S.flood },
  { id: "a-shovel", hazards: ["winter"], title: "Shovel slowly and take breaks", detail: "Heavy snow puts real strain on the heart.", source: S.winter },
];

const applies = (h: Hazard[] | "any", hazards: Hazard[]) =>
  h === "any" || h.some((x) => hazards.includes(x));

export interface Plan {
  hazards: Hazard[];
  /** True when hazards could not be determined; baseline tasks only. */
  baselineOnly: boolean;
  urgent: Assessment["urgent"];
  before: PrepTask[];
  during: Guidance[];
  after: Guidance[];
}

export const HAZARD_LABEL: Record<Hazard, string> = {
  tornado: "Tornado",
  thunderstorm: "Thunderstorms",
  wind: "Strong wind",
  winter: "Snow and winter weather",
  ice: "Ice",
  flood: "Flooding",
  heat: "Heat",
  cold: "Extreme cold",
};

export function buildPlan(
  assessment: Assessment,
  categories: Category[],
  zone: string,
): Plan {
  const hazards = assessment.hazards;
  const baselineOnly = assessment.level === "unknown" || hazards.length === 0;
  // Earliest forecast/official start per hazard drives approximate timing.
  const firstStart = (hs: Hazard[] | "any") => {
    const starts = assessment.factors
      .filter((f) => f.start !== null && (hs === "any" || (f.hazard && hs.includes(f.hazard))))
      .map((f) => f.start as number);
    return starts.length ? Math.min(...starts) : null;
  };
  const before = TASKS.filter(
    (t) => categories.includes(t.category) && applies(t.hazards, hazards),
  ).map((t) => {
    const s = firstStart(t.hazards);
    return {
      ...t,
      timing:
        s === null
          ? "Anytime: good to have in place"
          : s <= assessment.windowStart
            ? "Now: conditions may already be developing"
            : `Before about ${timeLabel(s, zone)}, when the forecast first shows this hazard`,
    };
  });
  return {
    hazards,
    baselineOnly,
    urgent: assessment.urgent,
    before,
    during: DURING.filter((g) => applies(g.hazards, hazards)),
    after: AFTER.filter((g) => applies(g.hazards, hazards)),
  };
}

/** Approximate forecast windows per hazard, from the assessment's factors. */
export function hazardWindows(assessment: Assessment, zone: string) {
  const out: { hazard: Hazard; label: string }[] = [];
  for (const h of assessment.hazards) {
    const fs = assessment.factors.filter((f) => f.hazard === h && f.start !== null && f.end !== null);
    if (!fs.length) continue;
    const s = Math.max(assessment.windowStart, Math.min(...fs.map((f) => f.start!)));
    const e = Math.max(...fs.map((f) => f.end!));
    out.push({ hazard: h, label: rangeLabel(s, e, zone) });
  }
  return out;
}
