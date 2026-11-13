/** Mirrors backend/geocode parsePointId so the browser can validate shared or saved point ids. */
export function parsePointLike(id: string) {
  const m = id.match(/^pt:(-?\d{1,2}\.\d{1,3}),(-?\d{1,3}\.\d{1,3})$/);
  if (!m) return null;
  const lat = Number(m[1]),
    lon = Number(m[2]);
  return lat >= 17 && lat <= 72 && lon >= -180 && lon <= -64 ? { lat, lon } : null;
}
