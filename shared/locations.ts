import type { Location } from "./types";
// City centers, not addresses. Initial release is explicitly limited to this catalog.
export const locations: Location[] = [
  {
    id: "kalamazoo",
    name: "Kalamazoo, MI",
    latitude: 42.2917,
    longitude: -85.5872,
    timeZone: "America/Detroit",
  },
  {
    id: "grand-rapids",
    name: "Grand Rapids, MI",
    latitude: 42.9634,
    longitude: -85.6681,
    timeZone: "America/Detroit",
  },
  {
    id: "battle-creek",
    name: "Battle Creek, MI",
    latitude: 42.3212,
    longitude: -85.1797,
    timeZone: "America/Detroit",
  },
  {
    id: "portage",
    name: "Portage, MI",
    latitude: 42.2012,
    longitude: -85.58,
    timeZone: "America/Detroit",
  },
  {
    id: "benton-harbor",
    name: "Benton Harbor, MI",
    latitude: 42.1167,
    longitude: -86.4542,
    timeZone: "America/Detroit",
  },
  {
    id: "south-haven",
    name: "South Haven, MI",
    latitude: 42.4031,
    longitude: -86.2736,
    timeZone: "America/Detroit",
  },
];
