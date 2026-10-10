const cache = new Map();

export async function getDrivingRoute(origin, destination, signal) {
  const key = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const cached = cache.get(key);
  if (cached?.expires > Date.now()) return cached.value;
  let value = null;
  try {
    const url = new URL(`/route/v1/driving/${key};${origin.longitude},${origin.latitude}`,
      process.env.ROUTING_URL ?? "https://router.project-osrm.org");
    url.search = "overview=false&steps=false&radiuses=1000;1000;1000";
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error("Routing unavailable");
    const data = await response.json();
    const legs = data.routes?.[0]?.legs;
    if (data.code !== "Ok" || legs?.length !== 2 ||
        !legs.every((leg) => Number.isFinite(leg.distance) && leg.distance >= 0 &&
          Number.isFinite(leg.duration) && leg.duration >= 0)) throw new Error("No route");
    value = {
      mode: "driving", source: "OSRM", trafficIncluded: false,
      distanceKm: Math.round(legs[0].distance / 100) / 10,
      durationMinutes: Math.ceil(legs[0].duration / 60),
      returnDistanceKm: Math.round(legs[1].distance / 100) / 10,
      returnDurationMinutes: Math.ceil(legs[1].duration / 60),
      note: "Estimare auto fara trafic, pana la un punct rutier apropiat. Accesul si parcarea trebuie verificate.",
    };
  } catch {
    // Missing routing data must never become an invented travel time.
  }
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + (value ? 3600000 : 30000) });
  return value;
}
