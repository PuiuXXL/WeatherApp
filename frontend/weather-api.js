import { recommendationParams, rememberRecommendations } from './recommendation-history.js';

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function fetchApi(path, params, signal, timeout = 25000) {
  const response = await fetch(`${apiBase}/api/${path}?${params}`, {
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Serviciul nu este disponibil.');
  return data;
}

export function weatherCondition(code) {
  if (code == null) return { key: 'cloudy', label: 'Indisponibil' };
  if (code === 0) return { key: 'sunny', label: 'Senin' };
  if (code <= 3) return { key: 'cloudy', label: code === 3 ? 'Innorat' : 'Partial noros' };
  if (code <= 48) return { key: 'cloudy', label: 'Ceata' };
  if (code >= 95) return { key: 'thunder', label: 'Furtuna' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { key: 'snow', label: 'Ninsoare' };
  return { key: 'rain', label: 'Ploaie' };
}

const dateLabel = (date, options) => new Intl.DateTimeFormat('ro-RO', {
  ...options, timeZone: 'UTC',
}).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));

export function adaptWeather(data) {
  const current = data.current;
  const condition = weatherCondition(current.weather_code);
  const rounded = value => value == null ? null : Math.round(value);
  return {
    current_location: data.location?.displayName || `${data.location?.latitude}, ${data.location?.longitude}`,
    current_temp: rounded(current.temperature_2m),
    current_weather: condition.key,
    weather_label: condition.label,
    date_label: dateLabel(current.time, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    humidity: current.relative_humidity_2m,
    wind_speed: current.wind_speed_10m,
    feels_like: rounded(current.apparent_temperature),
    timezone: data.location?.timezone || '',
    hourly_today: (data.hourly?.time || []).flatMap((time, index) => {
      if (time.slice(0, 10) !== current.time.slice(0, 10)) return [];
      const weather = weatherCondition(data.hourly.weather_code?.[index]);
      return [{ time, hour: time.slice(11, 16),
        temp: rounded(data.hourly.temperature_2m?.[index]),
        rain: data.hourly.precipitation_probability?.[index] ?? null,
        wind: data.hourly.wind_speed_10m?.[index] ?? null,
        weather: weather.key, label: weather.label,
        isNight: data.hourly.is_day?.[index] === 0,
        isCurrent: time.slice(0, 13) === current.time.slice(0, 13),
        isPast: time.slice(0, 13) < current.time.slice(0, 13),
      }];
    }),
    forecast_7_days: data.daily.time.map((date, i) => {
      const weather = weatherCondition(data.daily.weather_code[i]);
      return { day: dateLabel(date, { weekday: 'short' }), temp: rounded(data.daily.temperature_2m_max[i]),
        min: rounded(data.daily.temperature_2m_min[i]), weather: weather.key, label: weather.label };
    }),
  };
}

function paragraph(parent, text, tag = 'p') {
  if (!text) return;
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
  return element;
}

function renderRecommendations(data) {
  const container = document.getElementById('recommendation-days');
  container.replaceChildren();
  const status = document.getElementById('chatbot-message');
  status.textContent = data.assistant?.status === 'generated'
    ? 'Plan personalizat cu AI.' : 'Sugestii bazate pe prognoza locala. AI indisponibil momentan.';
  if (data.placesStatus === 'unavailable') status.textContent += ' Locurile apropiate nu sunt disponibile momentan.';
  const days = data.days?.length ? data.days : [{ date: data.forecastTime.slice(0, 10),
    suggestions: (data.recommendations || []).map(item => ({ ...item, description: item.reason })) }];
  days.forEach((day, index) => {
    const section = document.createElement('section');
    section.className = 'recommendation-day';
    if (index === 1) paragraph(container, 'Idei pentru zilele urmatoare', 'h3');
    paragraph(section, index === 0 ? 'Recomandari pentru azi' : dateLabel(day.date, { weekday: 'long', day: 'numeric', month: 'short' }), 'h3');
    if (day.temperatureMin != null || day.temperatureMax != null) {
      paragraph(section, `Min. ${day.temperatureMin ?? '--'} / Max. ${day.temperatureMax ?? '--'} °C`);
    }
    if (index === 0) paragraph(section, day.summary);
    for (const item of day.suggestions || []) {
      const article = document.createElement('article');
      paragraph(article, item.title, 'h4');
      if (index === 0 && item.interval) paragraph(article, `${item.interval.start.slice(11, 16)} - ${item.interval.end.slice(11, 16)} (${data.timezone})`);
      paragraph(article, item.description);
      if (index === 0 && item.itinerary?.length) {
        const timeline = document.createElement('ol');
        for (const step of item.itinerary) paragraph(timeline, `${step.start.slice(11, 16)} - ${step.end.slice(11, 16)}: ${step.title}`, 'li');
        article.append(timeline);
      }
      if (index === 0 && item.takeWith?.length) paragraph(article, `De luat: ${item.takeWith.join(', ')}.`);
      if (item.place) {
        const link = paragraph(article, item.place.name, 'a');
        try {
          const url = new URL(item.place.url);
          if (['http:', 'https:'].includes(url.protocol)) {
            link.href = url.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
          }
        } catch { /* A place without a valid URL remains plain text. */ }
        const route = item.place.route;
        paragraph(article, route
          ? `Dus: ${route.distanceKm} km, ~${route.durationMinutes} min. Intors: ${route.returnDistanceKm} km, ~${route.returnDurationMinutes} min. Fara trafic in timp real.`
          : `Aprox. ${item.place.distanceKm} km in linie dreapta.`);
        if (index === 0) paragraph(article, 'Verifica accesul, parcarea si programul inainte de plecare.');
      }
      section.append(article);
    }
    container.append(section);
  });
}

export function initializeApi(renderWeather) {
  const status = document.getElementById('weather-status');
  const message = document.getElementById('chatbot-message');
  const results = document.getElementById('location-results');
  const input = document.getElementById('city-query');
  let selected = null;
  let active;
  let search;
  let locating = 0;

  async function load(params) {
    active?.abort();
    const controller = new AbortController();
    active = controller;
    selected = params;
    status.textContent = 'Se incarca vremea...';
    message.textContent = 'Se pregatesc recomandarile...';
    document.getElementById('recommendation-days').replaceChildren();
    try {
      const weather = await fetchApi('weather', params, controller.signal);
      if (controller.signal.aborted) return;
      renderWeather(adaptWeather(weather));
      status.textContent = 'Vreme actualizata.';
    } catch (error) {
      if (controller.signal.aborted) return;
      status.textContent = `Nu am putut actualiza vremea. ${error.message} Reincearca.`;
      message.textContent = 'Recomandarile nu sunt disponibile pentru aceasta cautare.';
      return;
    }
    try {
      const recommendations = await fetchApi('recommendations', recommendationParams(params), controller.signal, 110000);
      if (!controller.signal.aborted) {
        renderRecommendations(recommendations);
        rememberRecommendations(params, recommendations.days);
      }
    } catch {
      if (!controller.signal.aborted) message.textContent = 'Recomandarile nu sunt disponibile momentan. Vremea ramane afisata.';
    }
  }

  document.getElementById('location-form').addEventListener('submit', async event => {
    event.preventDefault();
    const query = input.value.trim();
    if (query.length < 2) return;
    locating++;
    search?.abort();
    active?.abort();
    search = new AbortController();
    const controller = search;
    results.replaceChildren();
    status.textContent = 'Se cauta orasul...';
    try {
      const data = await fetchApi('locations', new URLSearchParams({ query }), controller.signal);
      if (controller.signal.aborted) return;
      if (!data.locations.length) {
        status.textContent = 'Nu am gasit orasul. Incearca alta denumire.';
        return;
      }
      const choose = location => {
        input.value = location.displayName || location.name;
        results.replaceChildren();
        void load(new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude) }));
      };
      if (data.locations.length === 1) return choose(data.locations[0]);
      status.textContent = 'Alege localitatea:';
      for (const location of data.locations) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = location.displayName || location.name;
        button.addEventListener('click', () => choose(location));
        results.append(button);
      }
    } catch (error) {
      if (!controller.signal.aborted) status.textContent = `Cautarea nu a reusit. ${error.message}`;
    }
  });
  document.getElementById('refresh').addEventListener('click', () => {
    if (!selected) {
      locate();
      return;
    }
    locating++;
    search?.abort();
    results.replaceChildren();
    void load(selected);
  });
  function locate() {
    const request = ++locating;
    search?.abort();
    active?.abort();
    results.replaceChildren();
    message.textContent = 'Recomandarile vor fi incarcate dupa stabilirea locatiei.';
    if (!navigator.geolocation || !window.isSecureContext) {
      status.textContent = 'Localizarea necesita localhost sau HTTPS. Poti cauta un oras.';
      return;
    }
    status.textContent = 'Se obtine locatia...';
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (request !== locating) return;
      void load(new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude) }));
    }, error => {
      if (request !== locating) return;
      status.textContent = error.code === 1 ? 'Accesul la locatie a fost refuzat. Poti cauta un oras.' : 'Locatia nu este disponibila. Poti cauta un oras.';
    }, { timeout: 15000, maximumAge: 60000 });
  }
  document.getElementById('locate').addEventListener('click', locate);
  locate();
}
