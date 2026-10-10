import { setTimeout as delay } from "node:timers/promises";

const cache = new Map();
let active = null;
let lastRequest = 0;

async function lookup(latitude, longitude) {
  // The public Nominatim service permits at most one request per second.
  await delay(Math.max(0, lastRequest + 1000 - Date.now()));
  lastRequest = Date.now();
  const url = new URL(process.env.REVERSE_GEOCODING_URL ?? "https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    lat: String(latitude), lon: String(longitude), format: "jsonv2",
    zoom: "10", addressdetails: "1", "accept-language": "ro",
  }).toString();
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "WeatherWise/0.0.0 (local weather application)" },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error("Reverse geocoding unavailable");
  const data = await response.json();
  if (!data.address || data.error) throw new Error("No address found");
  const address = data.address;
  const name = address.city ?? address.town ?? address.village ?? address.municipality ?? address.hamlet ?? null;
  const admin1 = address.county ?? address.state ?? null;
  const country = address.country ?? null;
  const displayName = [...new Set([name, admin1, country].filter(Boolean))].join(", ");
  return {
    name, admin1, country,
    countryCode: address.country_code?.toUpperCase() ?? null,
    displayName: displayName || null,
    source: "OpenStreetMap / Nominatim",
  };
}

export async function resolveCoordinateLocation(latitude, longitude, timezone) {
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const base = { name: null, admin1: null, country: null, countryCode: null,
    displayName: null, source: null, latitude, longitude, timezone };
  let entry = cache.get(key);
  if (!entry || entry.expires <= Date.now()) {
    if (active?.key === key) {
      entry = await active.promise;
    } else if (active) {
      return { ...base, status: "unavailable" };
    } else {
      const promise = lookup(latitude, longitude).then(
        (value) => ({ value, expires: Date.now() + 60 * 60 * 1000 }),
        () => ({ value: null, expires: Date.now() + 60 * 1000 }),
      );
      active = { key, promise };
      try {
        entry = await promise;
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, entry);
      } finally {
        active = null;
      }
    }
  }
  return { ...base, ...entry.value, status: entry.value ? "resolved" : "unavailable" };
}
