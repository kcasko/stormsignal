import type { Location } from "./types";
import config from "../stormsignal.config.json";

// The listed cities come from stormsignal.config.json, the one file a fork edits (see docs/reuse.md).
// City centers, not addresses. Each one gets forecast and alert history saved by the snapshot job.

/** Throws a readable error for a bad config, so a fork fails fast in tests and at build time. */
export function validateCities(raw: unknown): Location[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 25)
    throw Error("stormsignal.config.json: \"cities\" must list 1 to 25 cities.");
  const ids = new Set<string>();
  return raw.map((c, i) => {
    const where = `stormsignal.config.json: city ${i + 1}`;
    const { id, name, latitude, longitude, timeZone } = (c ?? {}) as Record<string, unknown>;
    if (typeof id !== "string" || !/^[a-z0-9-]{2,30}$/.test(id)) throw Error(`${where}: "id" must be 2–30 lowercase letters, digits or dashes.`);
    if (ids.has(id)) throw Error(`${where}: duplicate id "${id}".`);
    ids.add(id);
    if (typeof name !== "string" || !name.trim() || name.length > 60) throw Error(`${where}: "name" is required (up to 60 characters).`);
    if (typeof latitude !== "number" || latitude < 17 || latitude > 72) throw Error(`${where}: "latitude" must be a U.S. latitude (17 to 72). NWS covers the U.S. only.`);
    if (typeof longitude !== "number" || longitude < -180 || longitude > -64) throw Error(`${where}: "longitude" must be a U.S. longitude (-180 to -64).`);
    if (typeof timeZone !== "string") throw Error(`${where}: "timeZone" is required, e.g. "America/Chicago".`);
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
    } catch {
      throw Error(`${where}: unknown timeZone "${timeZone}".`);
    }
    return { id, name: name.trim(), latitude, longitude, timeZone };
  });
}

export const locations: Location[] = validateCities(config.cities);
