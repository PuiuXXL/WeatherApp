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

const homeActivities = [
  { key: "reading", title: "Lectura si o pauza de la ecrane", steps: ["Alege o carte si pregateste un colt linistit", "Citeste cateva capitole si noteaza ideile preferate"] },
  { key: "creative", title: "Desen, colaj sau un mic proiect creativ", steps: ["Alege materialele pe care le ai deja", "Realizeaza un desen, un colaj sau o decoratiune simpla"] },
  { key: "games", title: "Puzzle sau jocuri de societate", steps: ["Alege un puzzle ori un joc potrivit pentru timpul disponibil", "Joaca singur sau invita pe cineva, daca doresti"] },
  { key: "learning", title: "Invata ceva nou printr-un proiect practic", steps: ["Alege o lectie scurta de limba straina sau o abilitate care te intereseaza", "Aplica lectia intr-un exercitiu si pastreaza rezultatul"] },
  { key: "music", title: "Descopera un album si creeaza un playlist", steps: ["Alege un gen muzical pe care vrei sa il explorezi", "Asculta un album si adauga piesele preferate intr-un playlist"] },
  { key: "cooking", title: "Un experiment culinar cu ingredientele de acasa", steps: ["Alege o reteta noua folosind ingredientele disponibile", "Gateste in ritmul tau si noteaza ce ai schimba data viitoare"] },
  { key: "photos", title: "Creeaza un album cu fotografiile preferate", steps: ["Selecteaza fotografii dintr-o excursie sau din ultima luna", "Aranjeaza un album si adauga cateva amintiri in descrieri"] },
  { key: "movement", title: "Miscare usoara si relaxare acasa", steps: ["Pregateste un spatiu liber si alege muzica potrivita", "Fa miscari usoare in ritmul tau, cu pauze, apoi relaxeaza-te"] },
];

function homeReason(forecast, date) {
  const index = forecast.daily?.time.indexOf(date) ?? -1;
  const maximum = forecast.daily?.temperature_2m_max[index];
  const rain = forecast.daily?.precipitation_probability_max[index];
  if (maximum != null && maximum < 12) return `Maxima de ${maximum} C favorizeaza o activitate confortabila in interior.`;
  if (rain != null && rain >= 50) return `Probabilitatea zilnica de precipitatii este ${rain}%; activitatea nu depinde de ploaie.`;
  return "O alternativa flexibila acasa, fara deplasari sau dependenta de vreme.";
}

function localChoices(forecast, date, firstMinute, location) {
  const hourly = forecast.hourly;
  if (!hourly?.time) return [];
  const index = hourly.time.findIndex((time, index) => {
    if (!time.startsWith(date) || minutes(time) < firstMinute || minutes(time) + 60 > 19 * 60) return false;
    return [index, index + 1].every((sample, offset) =>
      hourly.time[sample] === timestamp(date, minutes(time) + offset * 60) &&
      hourly.is_day?.[sample] === 1 && [0, 1, 2, 3].includes(hourly.weather_code?.[sample]) &&
      Number.isFinite(hourly.apparent_temperature?.[sample]) && hourly.apparent_temperature[sample] >= 8 && hourly.apparent_temperature[sample] <= 28 &&
      Number.isFinite(hourly.precipitation_probability?.[sample]) && hourly.precipitation_probability[sample] <= 30 &&
      Number.isFinite(hourly.wind_gusts_10m?.[sample]) && hourly.wind_gusts_10m[sample] <= 40 &&
      Number.isFinite(hourly.uv_index?.[sample]) && hourly.uv_index[sample] <= 5);
  });
  if (index < 0) return [];
  const start = minutes(hourly.time[index]);
  const area = location?.name ? ` in ${location.name}` : " in apropiere";
  return [
    { key: "walking", title: `O plimbare pe strazile cunoscute${area}`, detail: "Plimbare intr-o zona cunoscuta, cu acces public" },
    { key: "outdoor_photos", title: `Fotografie de arhitectura si detalii${area}`, detail: "Fotografiaza detalii ale cladirilor si strazilor din zone publice cunoscute" },
    { key: "observation", title: `Observa natura din apropiere${area}`, detail: "Observa copacii, culorile si pasarile dintr-o zona publica cunoscuta" },
  ].map((activity) => ({
    id: `${date}-local-${activity.key}`, activity: `local_${activity.key}`, diversityKey: activity.key,
    title: activity.title, interval: interval(date, start, start + 60),
    itinerary: [step(date, start, start + 10, "Pregatire pentru o iesire scurta"),
      step(date, start + 10, start + 50, activity.detail), step(date, start + 50, start + 60, "Intoarcere spre casa")],
    place: null, scope: "local_area", weather: {
      temperature: hourly.temperature_2m?.[index] ?? null, feelsLike: hourly.apparent_temperature[index],
      precipitationProbability: hourly.precipitation_probability[index], source: "Open-Meteo", timezone: forecast.timezone,
    },
    reason: `Prognoza la locatia selectata indica ${hourly.apparent_temperature[index]} C resimtite si ${hourly.precipitation_probability[index]}% probabilitate de ploaie in intervalul ales. Zona concreta si accesul se aleg local; nu este un traseu verificat.`,
  }));
}

export function buildDayChoices(forecast, date, destinations = [], location = null) {
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
    choices.push({ id: `${date}-${place.id}`, title, activity: indoor ? "local_visit" : "local_outing", diversityKey: place.kind,
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
  choices.push(...localChoices(forecast, date, firstMinute, location));
  const homeStart = Math.max(firstMinute, choices.length ? 19 * 60 : firstMinute);
  if (homeStart < 23 * 60) {
    const end = Math.min(homeStart + 120, 23 * 60);
    const preparationEnd = Math.min(homeStart + 15, end);
    // Rotate equally suitable home options by date; the weekly planner tracks category reuse.
    const rotation = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000) % homeActivities.length;
    const activities = [...homeActivities.slice(rotation), ...homeActivities.slice(0, rotation)];
    for (const [index, activity] of activities.entries()) {
      choices.push({ id: `${date}-home-${activity.key}`, title: activity.title,
        activity: `home_${activity.key}`, diversityKey: activity.key,
        interval: interval(date, homeStart, end),
        itinerary: [step(date, homeStart, preparationEnd, activity.steps[0]),
          ...(end > preparationEnd ? [step(date, preparationEnd, end, activity.steps[1])] : [])],
        place: null, weather: null, reason: homeReason(forecast, date),
      });
      if (index === 0 && end <= 19 * 60 && isToday) choices.push({
        id: `${date}-evening`, title: "O seara de film acasa", activity: "home_evening", diversityKey: "film",
        interval: interval(date, 19 * 60, 21 * 60 + 30),
        itinerary: [step(date, 19 * 60, 19 * 60 + 15, "Alege un film din sursele la care ai acces"),
          step(date, 19 * 60 + 15, 21 * 60 + 30, "Vizionare si relaxare")],
        place: null, weather: null, reason: "O activitate de seara acasa, fara deplasari.",
      });
    }
  }
  if (!choices.length) choices.push({ id: `${date}-rest`, title: "Odihna pentru seara tarzie", activity: "rest",
    interval: null, itinerary: [], place: null, weather: null,
    reason: "Ziua este aproape incheiata; nu mai programam iesiri sau deplasari." });
  return choices;
}
