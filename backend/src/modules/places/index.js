const cache = new Map();

function distanceKm(latitude, longitude, otherLatitude, otherLongitude) {
  const radians = (value) => value * Math.PI / 180;
  const a = Math.sin(radians(otherLatitude - latitude) / 2) ** 2 +
    Math.cos(radians(latitude)) * Math.cos(radians(otherLatitude)) *
    Math.sin(radians(otherLongitude - longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export async function findNearbyPlaces(latitude, longitude) {
  const key = `${latitude},${longitude}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  try {
    const at = `${latitude},${longitude}`;
    const access = "[name][access!=private][access!=no]";
    const query = `[out:json][timeout:8];(nwr(around:8000,${at})[leisure=park]${access};nwr(around:20000,${at})[natural=water][water~"lake|reservoir"]${access};nwr(around:20000,${at})[landuse=reservoir]${access};nwr(around:15000,${at})[tourism=museum]${access};nwr(around:8000,${at})[amenity=cafe]${access};);out center tags 80;`;
    const url = new URL(process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter");
    const response = await fetch(url, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      headers: { Accept: "application/json", "User-Agent": "WeatherWise/0.0.0 (local weather activity planner)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Places service unavailable");
    const data = await response.json();
    if (!Array.isArray(data.elements) || data.remark) throw new Error("Incomplete places response");
    const all = data.elements.flatMap((item) => {
      const lat = item.lat ?? item.center?.lat;
      const lon = item.lon ?? item.center?.lon;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !item.tags?.name) return [];
      return [{
        id: `${item.type}/${item.id}`,
        kind: item.tags.tourism === "museum" ? "museum" : item.tags.amenity === "cafe" ? "cafe" :
          item.tags.natural === "water" || item.tags.landuse === "reservoir" ? "lake" : "park",
        name: item.tags.name,
        latitude: lat,
        longitude: lon,
        distanceKm: Math.round(distanceKm(latitude, longitude, lat, lon) * 10) / 10,
        url: `https://www.openstreetmap.org/${item.type}/${item.id}`,
      }];
    }).filter((place) => place.distanceKm <= 20)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    const unique = [...new Map(all.map((place) => [place.id, place])).values()];
    const kinds = ["lake", "park", "museum", "cafe"];
    const places = [0, 1].flatMap((index) => kinds.flatMap((kind) => {
      const place = unique.filter((item) => item.kind === kind)[index];
      return place ? [place] : [];
    })).slice(0, 6);
    const parks = unique.filter((place) => place.kind === "park" && place.distanceKm <= 5).slice(0, 3);
    const value = { status: places.length ? "available" : "empty", parks, places };
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key, { expires: Date.now() + 15 * 60 * 1000, value });
    return value;
  } catch {
    const value = { status: "unavailable", parks: [], places: [] };
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key, { expires: Date.now() + 60000, value });
    return value;
  }
}

export const findNearbyParks = findNearbyPlaces;
