const button = document.querySelector("#locate");
const status = document.querySelector("#status");
const weather = document.querySelector("#weather");

function getPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

function displayWeather(data, coords, apiUrl) {
  const format = (value, unit) => value == null ? "--" : `${value} ${unit}`;
  const current = data.current;
  const units = data.units.current;
  document.querySelector("#coordinates").textContent =
    `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} (precizie aproximativa: ${Math.round(coords.accuracy)} m)`;
  document.querySelector("#temperature").textContent = format(current.temperature_2m, units.temperature_2m);
  document.querySelector("#feels-like").textContent = format(current.apparent_temperature, units.apparent_temperature);
  document.querySelector("#humidity").textContent = format(current.relative_humidity_2m, units.relative_humidity_2m);
  document.querySelector("#wind").textContent = format(current.wind_speed_10m, units.wind_speed_10m);
  document.querySelector("#api-link").href = apiUrl;
  // API timestamps use the location's timezone, independently of the browser's timezone.
  const today = current.time.slice(0, 10);
  const currentHour = current.time.slice(0, 13);
  const hourlyRows = [];
  data.hourly.time.forEach((time, index) => {
    if (time.slice(0, 10) !== today || time.slice(0, 13) < currentHour) return;
    const row = document.createElement("tr");
    const values = [
      time.slice(11, 16),
      format(data.hourly.temperature_2m[index], data.units.hourly.temperature_2m),
      format(data.hourly.precipitation_probability[index], data.units.hourly.precipitation_probability),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    hourlyRows.push(row);
  });
  document.querySelector("#hourly-forecast").replaceChildren(...hourlyRows);
  const rows = data.daily.time.map((date, index) => {
    const row = document.createElement("tr");
    const values = [
      new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)),
      format(data.daily.temperature_2m_min[index], data.units.daily.temperature_2m_min),
      format(data.daily.temperature_2m_max[index], data.units.daily.temperature_2m_max),
      format(data.daily.precipitation_probability_max[index], data.units.daily.precipitation_probability_max),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  document.querySelector("#forecast").replaceChildren(...rows);
  weather.hidden = false;
}

async function loadLocalWeather() {
  button.disabled = true;
  weather.hidden = true;
  status.textContent = "Se obtine locatia...";
  try {
    if (!window.isSecureContext) {
      throw new Error("Localizarea necesita HTTPS sau acces prin localhost.");
    }
    if (!navigator.geolocation) {
      throw new Error("Browserul nu suporta localizarea.");
    }
    const { coords } = await getPosition();
    status.textContent = "Se incarca vremea...";
    const params = new URLSearchParams({
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
    });
    const apiUrl = `/api/weather?${params}`;
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Serviciul meteo nu este disponibil.");
    displayWeather(data, coords, apiUrl);
    status.textContent = "Vreme actualizata pentru locatia ta.";
  } catch (error) {
    const messages = {
      1: "Accesul la locatie a fost refuzat. Permite localizarea din setarile site-ului si reincearca.",
      2: "Locatia nu este disponibila. Verifica serviciile de localizare ale dispozitivului si reincearca.",
      3: "Obtinerea locatiei a durat prea mult. Reincearca.",
    };
    status.textContent = messages[error.code] ??
      (error.name === "TimeoutError" ? "Serviciul meteo raspunde prea greu. Reincearca." : error.message);
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", loadLocalWeather);
loadLocalWeather();
