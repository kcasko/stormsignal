// Builds compact lookup tables from the U.S. Census Bureau 2024 Gazetteer files (public domain).
// Source: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/
//   npx tsx scripts/build-gazetteer.ts <dir containing 2024_Gaz_zcta_national.txt and 2024_Gaz_place_national.txt>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw Error("usage: build-gazetteer.ts <dir>");
const rows = (f: string) =>
  readFileSync(join(dir, f), "latin1")
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((l) => l.split("\t").map((c) => c.trim()));
const r3 = (n: string) => Math.round(Number(n) * 1000) / 1000;

const zips: Record<string, [number, number]> = {};
for (const [zip, , , , , lat, lon] of rows("2024_Gaz_zcta_national.txt"))
  if (/^\d{5}$/.test(zip)) zips[zip] = [r3(lat), r3(lon)];

// [name, state, lat, lon, land area km² (rounded) for ranking]
const SUFFIX = / (city|town|village|borough|CDP|municipality|city and borough|urban county|consolidated government|metropolitan government|unified government|\(balance\))+$/i;
const places: [string, string, number, number, number][] = [];
for (const [st, , , name, , , aland, , , , lat, lon] of rows("2024_Gaz_place_national.txt")) {
  let n = name;
  for (let i = 0; i < 3; i++) n = n.replace(SUFFIX, "").trim();
  places.push([n, st, r3(lat), r3(lon), Math.round(Number(aland) / 1e6)]);
}
mkdirSync("backend/data", { recursive: true });
writeFileSync("backend/data/zips.json", JSON.stringify(zips));
writeFileSync("backend/data/places.json", JSON.stringify(places));
console.log(Object.keys(zips).length, "zips;", places.length, "places");
