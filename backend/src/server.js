import http from "node:http";
import { handleCurrentLocation } from "./modules/current-location/index.js";

const port = Number(process.env.PORT ?? 3000);
const openMeteoForecastUrl = "https://api.open-meteo.com/v1/forecast";
const openMeteoGeocodingUrl = "https://geocoding-api.open-meteo.com/v1/search";

const weatherParams = {
  current: [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "is_day",
    "precipitation",
    "weather_code",
    "cloud_cover",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
  ].join(","),
  hourly: [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation_probability",
    "weather_code",
    "wind_speed_10m",
  ].join(","),
  daily: [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
    "wind_speed_10m_max",
  ].join(","),
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(data));
}

function getRequestUrl(request) {
  return new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
}

function getNumberParam(searchParams, name) {
  const value = searchParams.get(name);

  if (value === null || value.trim() === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function validateCoordinates(latitude, longitude) {
  if (latitude === null || longitude === null) {
    return "Trimite fie city, fie latitude si longitude.";
  }

  if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
    return "latitude trebuie sa fie un numar intre -90 si 90.";
  }

  if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
    return "longitude trebuie sa fie un numar intre -180 si 180.";
  }

  return null;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const reason = data?.reason ?? "Serviciul extern nu a putut procesa cererea.";
    throw new Error(reason);
  }

  return data;
}

function normalizeLocation(location) {
  if (!location) {
    return null;
  }

  return {
    name: location.name,
    country: location.country,
    countryCode: location.country_code,
    admin1: location.admin1,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
  };
}

async function findLocation(city, count = 1) {
  const url = new URL(openMeteoGeocodingUrl);
  url.searchParams.set("name", city);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const data = await fetchJson(url);
  return data.results ?? [];
}

async function getForecast({ latitude, longitude, timezone }) {
  const url = new URL(openMeteoForecastUrl);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", weatherParams.current);
  url.searchParams.set("hourly", weatherParams.hourly);
  url.searchParams.set("daily", weatherParams.daily);
  url.searchParams.set("timezone", timezone ?? "auto");
  url.searchParams.set("forecast_days", "7");

  return fetchJson(url);
}

async function handleLocations(requestUrl, response) {
  const query = requestUrl.searchParams.get("query")?.trim();

  if (!query || query.length < 2) {
    sendJson(response, 400, { message: "query trebuie sa aiba cel putin 2 caractere." });
    return;
  }

  const locations = await findLocation(query, 10);
  sendJson(response, 200, { locations: locations.map(normalizeLocation) });
}

async function handleWeather(requestUrl, response) {
  const city = requestUrl.searchParams.get("city")?.trim();
  let latitude = getNumberParam(requestUrl.searchParams, "latitude");
  let longitude = getNumberParam(requestUrl.searchParams, "longitude");
  let location = null;

  if (city) {
    const locations = await findLocation(city);

    if (locations.length === 0) {
      sendJson(response, 404, { message: "Nu am gasit orasul cerut." });
      return;
    }

    location = normalizeLocation(locations[0]);
    latitude = location.latitude;
    longitude = location.longitude;
  }

  const coordinateError = validateCoordinates(latitude, longitude);

  if (coordinateError) {
    sendJson(response, 400, { message: coordinateError });
    return;
  }

  const forecast = await getForecast({
    latitude,
    longitude,
    timezone: location?.timezone,
  });

  sendJson(response, 200, {
    location: location ?? {
      latitude,
      longitude,
      timezone: forecast.timezone,
    },
    units: {
      current: forecast.current_units,
      hourly: forecast.hourly_units,
      daily: forecast.daily_units,
    },
    current: forecast.current,
    hourly: forecast.hourly,
    daily: forecast.daily,
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { message: "Method not allowed" });
    return;
  }

  const requestUrl = getRequestUrl(request);

  if (requestUrl.pathname === "/api/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  try {
    if (await handleCurrentLocation(requestUrl, response)) {
      return;
    }

    if (requestUrl.pathname === "/api/locations") {
      await handleLocations(requestUrl, response);
      return;
    }

    if (requestUrl.pathname === "/api/weather") {
      await handleWeather(requestUrl, response);
      return;
    }

    sendJson(response, 404, { message: "Not found" });
  } catch (error) {
    sendJson(response, 502, {
      message: "Nu am putut obtine datele meteo momentan.",
      details: error.message,
    });
  }
});

server.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
