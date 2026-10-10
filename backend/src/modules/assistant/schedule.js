function minutes(time) {
  return Number(time.slice(11, 13)) * 60 + Number(time.slice(14, 16));
}

function timestamp(date, minute) {
  return `${date}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function interval(date, start, end) {
  return { start: timestamp(date, start), end: timestamp(date, end) };
}

function step(date, start, end, title) {
  return { ...interval(date, start, end), title };
}

export function buildDayChoices(forecast, date, destinations = []) {
  const now = forecast.current.time;
  const isToday = date === now.slice(0, 10);
  const firstMinute = isToday ? Math.ceil(minutes(now) / 15) * 15 : 9 * 60;
  const choices = [];
  for (const place of destinations) {
    if (!place.route || !place.forecast || place.route.durationMinutes > 90) continue;
    const indoor = ["museum", "cafe"].includes(place.kind);
    const stay = indoor ? 60 : 90;
    const hourly = place.forecast.hourly;
    const windowIndex = hourly.time.findIndex((time, index) => {
      if (!time.startsWith(date) || minutes(time) - place.route.durationMinutes - 15 < firstMinute ||
          minutes(time) + stay + place.route.returnDurationMinutes > 19 * 60) return false;
      const last = Math.ceil(stay / 60);
      for (let offset = 0; offset <= last; offset += 1) {
        const sample = index + offset;
        if (hourly.time[sample] !== timestamp(date, minutes(time) + offset * 60) ||
            !Number.isFinite(hourly.wind_gusts_10m[sample]) || hourly.wind_gusts_10m[sample] > 40 ||
            ![0, 1, 2, 3, 45, 48, 51, 53, 61, 63].includes(hourly.weather_code[sample])) return false;
        if (!indoor && (!Number.isFinite(hourly.apparent_temperature[sample]) ||
            hourly.apparent_temperature[sample] < 8 || hourly.apparent_temperature[sample] > 28 ||
            !Number.isFinite(hourly.precipitation_probability[sample]) || hourly.precipitation_probability[sample] > 30 ||
            !Number.isFinite(hourly.uv_index[sample]) || hourly.uv_index[sample] > 5 || hourly.is_day[sample] !== 1)) return false;
      }
      return true;
    });
    if (windowIndex < 0) continue;
    const arrival = minutes(hourly.time[windowIndex]);
    const departure = arrival - place.route.durationMinutes;
    const end = arrival + stay;
    const returnEnd = end + place.route.returnDurationMinutes;
    const title = place.kind === "lake" ? `Plimbare si picnic la ${place.name}` :
      place.kind === "museum" ? `Vizita la ${place.name}` :
      place.kind === "cafe" ? `O pauza la ${place.name}` : `Plimbare in ${place.name}`;
    const itinerary = [
      step(date, departure - 15, departure, "Pregatire pentru iesire"),
      step(date, departure, arrival, "Drum cu masina pana la destinatie"),
      step(date, arrival, end - 15, indoor ? "Vizita si relaxare" : "Plimbare in zona accesibila publicului"),
      step(date, end - 15, end, indoor ? "Pauza inainte de plecare" : "Pauza pentru un sandwich si apa"),
      step(date, end, returnEnd, "Drum de intoarcere"),
    ];
    const { forecast: destinationForecast, ...publicPlace } = place;
    choices.push({ id: `${date}-${place.id}`, title, activity: indoor ? "local_visit" : "local_outing",
      interval: interval(date, departure - 15, returnEnd), itinerary,
      place: publicPlace, weather: {
        temperature: destinationForecast.hourly.temperature_2m[windowIndex],
        feelsLike: hourly.apparent_temperature[windowIndex],
        precipitationProbability: hourly.precipitation_probability[windowIndex],
        source: "Open-Meteo", timezone: destinationForecast.timezone,
      },
      reason: indoor ? "O oprire in interior; verifica programul inainte de plecare." : "Interval cu lumina naturala si conditii potrivite la destinatie.",
    });
  }
  const homeStart = Math.max(firstMinute, choices.length ? 19 * 60 : firstMinute);
  if (homeStart < 23 * 60) {
    const end = Math.min(homeStart + 150, 23 * 60);
    const mealEnd = Math.min(homeStart + 40, end);
    choices.push({ id: `${date}-home`, title: homeStart < 17 * 60 ? "O masa simpla si timp pentru un proiect personal" : "Cina si o seara relaxata acasa", activity: "home_evening",
      interval: interval(date, homeStart, end),
      itinerary: [step(date, homeStart, mealEnd, "Pregateste o masa simpla"),
        ...(end > mealEnd ? [step(date, mealEnd, end, homeStart < 17 * 60 ? "Un proiect creativ sau un joc de societate" : "Film sau joc de societate")] : [])],
      place: null, weather: null, reason: "Un program flexibil acasa, fara dependenta de vreme.",
    });
    if (homeStart < 17 * 60 && isToday) choices.push({
      id: `${date}-evening`, title: "Cina si film pentru incheierea zilei", activity: "home_evening",
      interval: interval(date, 19 * 60, 21 * 60 + 30),
      itinerary: [step(date, 19 * 60, 19 * 60 + 40, "Cina"),
        step(date, 19 * 60 + 40, 21 * 60 + 30, "Film acasa")],
      place: null, weather: null, reason: "Incheie ziua cu o masa si un film, fara deplasari.",
    });
  }
  if (!choices.length) choices.push({ id: `${date}-rest`, title: "Odihna pentru seara tarzie", activity: "rest",
    interval: null, itinerary: [], place: null, weather: null,
    reason: "Ziua este aproape incheiata; nu mai programam iesiri sau deplasari." });
  return choices;
}
