export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}
export interface Period {
  start: string;
  end: string;
  temperature: number | null;
  temperatureUnit: string;
  wind: string;
  forecast: string;
  precipitation: number | null;
}
export interface Alert {
  id: string;
  event: string;
  severity: string;
  headline: string;
  description: string;
  instruction: string;
  sent: string;
  expires: string;
  onset: string | null;
  ends: string | null;
  area: string;
  url: string;
}
export interface Weather {
  source: "live" | "simulated";
  location: Location;
  fetchedAt: string;
  forecastUpdatedAt: string | null;
  periods: Period[];
  alerts: Alert[];
  availability: { forecast: boolean; alerts: boolean };
  errors: string[];
}
export interface Window {
  start: number;
  end: number;
  label: string;
}
