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
  document.querySelector("#location-name").textContent =
    data.location.displayName ?? "Locatia detectata (nume indisponibil)";
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

async function loadRecommendations(params) {
  const message = document.querySelector("#recommendations-status");
  const container = document.querySelector("#recommendations");
  message.textContent = "Se pregateste planul pe zile...";
  container.replaceChildren();
  try {
    const response = await fetch(`/api/recommendations?${params}`, { signal: AbortSignal.timeout(110000) });
    if (!response.ok) throw new Error("Recommendations unavailable");
    const data = await response.json();
    for (const [dayIndex, day] of data.days.entries()) {
      const isToday = dayIndex === 0;
      if (dayIndex === 1) {
        const nextHeading = document.createElement("h3");
        nextHeading.textContent = "Idei pentru zilele urmatoare";
        container.append(nextHeading);
      }
      const dayHeading = document.createElement("h3");
      const dateLabel = new Intl.DateTimeFormat("ro-RO", {
        weekday: "long", day: "numeric", month: "short", timeZone: "UTC",
      }).format(new Date(`${day.date}T00:00:00Z`));
      dayHeading.textContent = isToday ? "Recomandari pentru azi" : dateLabel;
      const temperatures = document.createElement("p");
      temperatures.textContent = `${isToday ? `${dateLabel} · ` : ""}Min. ${day.temperatureMin ?? "--"} / max. ${day.temperatureMax ?? "--"} °C`;
      const summary = document.createElement("p");
      summary.textContent = day.summary;
      const section = document.createElement("section");
      section.append(dayHeading, temperatures);
      if (isToday) section.append(summary);
      for (const item of day.suggestions) {
      const article = document.createElement("article");
      const heading = document.createElement("h4");
      heading.textContent = item.title;
      article.append(heading);
      if (item.interval && isToday) {
        const interval = document.createElement("p");
        const date = item.interval.start.slice(0, 10).split("-").reverse().join(".");
        interval.textContent = `${date}, ${item.interval.start.slice(11, 16)} - ${item.interval.end.slice(11, 16)}`;
        article.append(interval);
      }
      const reason = document.createElement("p");
      reason.textContent = item.description;
      article.append(reason);
      if (isToday && item.itinerary?.length) {
        const timeline = document.createElement("ol");
        timeline.className = "itinerary";
        for (const step of item.itinerary) {
          const entry = document.createElement("li");
          const time = document.createElement("strong");
          time.textContent = `${step.start.slice(11, 16)} - ${step.end.slice(11, 16)}`;
          entry.append(time, document.createTextNode(` ${step.title}`));
          timeline.append(entry);
        }
        article.append(timeline);
      }
      if (item.takeWith.length) {
        const supplies = document.createElement("p");
        supplies.textContent = `De luat: ${item.takeWith.join(", ")}.`;
        article.append(supplies);
      }
      if (item.place) {
        const link = document.createElement("a");
        link.href = item.place.url;
        link.textContent = `${item.place.name} - vezi pe harta`;
        article.append(link);
        const travel = document.createElement("p");
        const route = item.place.route;
        travel.textContent = route ?
          `Cu masina: ${route.distanceKm} km, aprox. ${route.durationMinutes} min dus; ${route.returnDistanceKm} km, aprox. ${route.returnDurationMinutes} min intors. Fara trafic in timp real.` :
          `Aprox. ${item.place.distanceKm} km in linie dreapta; durata drumului nu este disponibila.`;
        article.append(travel);
        if (isToday) {
          const access = document.createElement("p");
          access.textContent = "Verifica accesul, parcarea si programul destinatiei inainte de plecare.";
          article.append(access);
        }
      }
      section.append(article);
      }
      container.append(section);
    }
    const aiMessages = {
      not_configured: "AI-ul nu este configurat.",
      authentication_error: "Cheia OpenAI nu a fost acceptata.",
      quota_or_rate_limit: "OpenAI a atins limita de cereri sau credit disponibil.",
      timeout: "AI-ul nu a raspuns la timp.",
      busy: "AI-ul este ocupat momentan.",
    };
    const messages = [data.assistant.status === "generated" ? "Plan personalizat cu AI." :
      `${aiMessages[data.assistant.reason] ?? "AI-ul nu este disponibil momentan."} Afisam sugestiile de baza.`];
    if (data.placesStatus === "unavailable") messages.push("Locurile apropiate nu sunt disponibile momentan.");
    if (data.placesStatus === "empty") messages.push("Nu am gasit destinatii numite in zona cautata.");
    if (data.placesStatus === "available" && !data.destinations?.length) messages.push("Nu am putut verifica drumul si vremea destinatiilor; planul ramane local, fara distante inventate.");
    message.textContent = messages.join(" ");
  } catch {
    message.textContent = "Recomandarile nu sunt disponibile momentan. Vremea ramane afisata.";
  }
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
    await loadRecommendations(params);
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
