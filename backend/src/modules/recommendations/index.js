function suitable(hour) {
  return [hour.feelsLike, hour.rain, hour.wind, hour.gusts, hour.uv].every(Number.isFinite) &&
    hour.feelsLike >= 15 && hour.feelsLike <= 28 && hour.rain <= 25 &&
    hour.wind <= 20 && hour.gusts <= 35 && hour.uv <= 5 &&
    hour.daylight === 1 && [0, 1, 2, 3].includes(hour.code);
}

function findWindow(hours) {
  // Three hourly samples bound a two-hour outing; never join separate days.
  for (let index = 0; index <= hours.length - 3; index += 1) {
    const window = hours.slice(index, index + 3);
    if (window.every(suitable) && window.every((hour, offset) =>
      hour.time.slice(0, 10) === window[0].time.slice(0, 10) &&
      Number(hour.time.slice(11, 13)) === Number(window[0].time.slice(11, 13)) + offset)) {
      return window;
    }
  }
  return null;
}

function indoor(period, hours, reason) {
  return {
    period,
    activity: period === "evening" ? "movie_at_home" : "indoor_activity",
    title: period === "evening" ? "O seara de film acasa" : "O activitate in interior",
    interval: hours.length ? { start: hours[0].time, end: hours.at(-1).time } : null,
    reason,
    place: null,
    weather: null,
  };
}

function outdoor(period, window, park) {
  const weather = {
    feelsLikeMin: Math.min(...window.map((hour) => hour.feelsLike)),
    feelsLikeMax: Math.max(...window.map((hour) => hour.feelsLike)),
    precipitationProbabilityMax: Math.max(...window.map((hour) => hour.rain)),
    windSpeedMax: Math.max(...window.map((hour) => hour.wind)),
  };
  return {
    period,
    activity: "park_walk",
    title: park ? `Plimbare in ${park.name}` : "O plimbare in apropiere",
    interval: { start: window[0].time, end: window.at(-1).time },
    reason: `Temperatura resimtita este intre ${weather.feelsLikeMin} si ${weather.feelsLikeMax} °C, riscul de ploaie de cel mult ${weather.precipitationProbabilityMax}%, iar vantul de cel mult ${weather.windSpeedMax} km/h. Intervalul este pe lumina naturala.`,
    place: park ?? null,
    weather,
  };
}

export function buildRecommendations(forecast, parks = []) {
  const hourly = forecast.hourly;
  const now = forecast.current.time;
  const today = now.slice(0, 10);
  const hours = hourly.time.map((time, index) => ({
    time,
    feelsLike: hourly.apparent_temperature[index],
    rain: hourly.precipitation_probability[index],
    wind: hourly.wind_speed_10m[index],
    gusts: hourly.wind_gusts_10m[index],
    uv: hourly.uv_index[index],
    daylight: hourly.is_day[index],
    code: hourly.weather_code[index],
  })).filter((hour) => hour.time >= now);
  const todayHours = hours.filter((hour) => hour.time.startsWith(today));
  const daytime = todayHours.filter((hour) => Number(hour.time.slice(11, 13)) < 19);
  const evening = todayHours.filter((hour) => Number(hour.time.slice(11, 13)) >= 19);
  const future = hours.filter((hour) => hour.time.slice(0, 10) > today);
  const todayWindow = findWindow(daytime);
  const eveningWindow = findWindow(evening);
  const futureWindow = findWindow(future);
  return [
    todayWindow ? outdoor("today", todayWindow, parks[0]) : indoor("today", daytime,
      daytime.length ? "Nu am identificat doua ore consecutive potrivite pentru o plimbare astazi, inainte de ora 19." : "Intervalul de zi pentru astazi s-a incheiat. Poti alege o activitate in interior."),
    eveningWindow ? outdoor("evening", eveningWindow, parks[0]) : indoor("evening", evening,
      evening.length ? "Nu am identificat doua ore consecutive cu lumina naturala si conditii confortabile pentru o plimbare dupa ora 19. Iti propun un film acasa." : "Nu mai sunt ore de prognoza disponibile pentru seara de astazi."),
    futureWindow ? outdoor("upcoming", futureWindow, parks[0]) : indoor("upcoming", [],
      "Nu am identificat un interval de doua ore care sa indeplineasca criteriile pentru plimbare in urmatoarele zile. Reverifica prognoza mai tarziu."),
  ];
}
