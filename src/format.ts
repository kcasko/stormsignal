export const clock = (t: number, zone: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: zone }).format(t);
export const hourOnly = (t: number, zone: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: zone }).format(t).replace(" ", "");
export const day = (t: number, zone: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: zone }).format(t);
export const stamp = (t: number, zone: string) => `${day(t, zone)}, ${clock(t, zone)}`;
export const zoneName = (t: number, zone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZoneName: "short", timeZone: zone })
    .formatToParts(t)
    .find((p) => p.type === "timeZoneName")?.value ?? zone;
export const unknown = (v: number | null, unit: string, digits = 0) =>
  v === null ? "unknown" : (digits ? v.toFixed(digits) : Math.round(v)) + unit;
