function updateNavigation() {
  const track = document.getElementById('hourly-forecast');
  document.getElementById('hourly-previous').disabled = track.scrollLeft <= 1;
  document.getElementById('hourly-next').disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
}

function scrollToCurrentHour() {
  const track = document.getElementById('hourly-forecast');
  const current = track.querySelector('.is-current');
  track.scrollLeft = current ? current.offsetLeft : 0;
  updateNavigation();
}

export function initializeHourlyForecast() {
  const track = document.getElementById('hourly-forecast');
  track.addEventListener('scroll', updateNavigation, { passive: true });
  window.addEventListener('resize', scrollToCurrentHour);
  for (const [id, direction] of [['hourly-previous', -1], ['hourly-next', 1]]) {
    document.getElementById(id).addEventListener('click', () => {
      track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.75, 160), behavior: 'smooth' });
    });
  }
  updateNavigation();
}

export function renderHourlyForecast(data, iconPath) {
  const track = document.getElementById('hourly-forecast');
  track.replaceChildren();
  document.getElementById('hourly-date').textContent = [data.date_label, data.timezone].filter(Boolean).join(' / ');
  const hours = data.hourly_today || [];
  document.getElementById('hourly-status').textContent = hours.length ? '' : 'Prognoza orara nu este disponibila momentan.';
  for (const hour of hours) {
    const item = document.createElement('li');
    item.className = `hourly-item${hour.isCurrent ? ' is-current' : ''}${hour.isPast ? ' is-past' : ''}`;
    if (hour.isCurrent) item.setAttribute('aria-current', 'time');
    item.title = `${hour.hour}: ${hour.label}. Vant: ${hour.wind ?? '--'} km/h`;
    const time = document.createElement('time');
    time.dateTime = hour.time;
    time.textContent = hour.isCurrent ? 'Acum' : hour.hour;
    const icon = document.createElement('img');
    icon.src = iconPath(hour.weather);
    icon.alt = hour.label;
    icon.width = 32;
    icon.height = 32;
    let visual = icon;
    if (hour.isNight && hour.weather === 'sunny') {
      visual = document.createElement('span');
      visual.className = 'hourly-moon';
      visual.setAttribute('role', 'img');
      visual.setAttribute('aria-label', 'Noapte senina');
    }
    const temperature = document.createElement('strong');
    temperature.textContent = hour.temp == null ? '--' : `${hour.temp}\u00b0`;
    const rain = document.createElement('span');
    rain.className = 'hourly-rain';
    rain.textContent = hour.rain == null ? '--' : `${hour.rain}%`;
    rain.setAttribute('aria-label', `Probabilitate de precipitatii: ${rain.textContent}`);
    item.append(time, visual, temperature, rain);
    track.append(item);
  }
  // API timestamps are already local to the destination, not the browser's timezone.
  scrollToCurrentHour();
}
