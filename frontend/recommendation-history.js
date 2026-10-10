const storageKey = 'weather-match-recommendation-history-v1';
let memory = {};

function locationKey(params) {
  return ['latitude', 'longitude'].map(name => Number(params.get(name)).toFixed(2)).join(',');
}

function read() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) memory = saved;
  } catch { /* Memory history remains available if browser storage is blocked. */ }
  return memory;
}

function cleanDays(days) {
  return Array.isArray(days) ? days.filter(day => day && /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Array.isArray(day.ids))
    .slice(-7).map(day => ({ date: day.date, ids: day.ids.filter(id =>
      typeof id === 'string' && /^[a-zA-Z0-9_:/.-]{1,120}$/.test(id)).slice(-6) })) : [];
}

export function recommendationParams(params) {
  const query = new URLSearchParams(params);
  query.set('generation', crypto.randomUUID());
  const previous = cleanDays(read()[locationKey(params)]?.days);
  if (previous.length) query.set('previous', JSON.stringify(previous));
  return query;
}

export function rememberRecommendations(params, days = []) {
  const key = locationKey(params);
  const history = read();
  const previous = cleanDays(history[key]?.days);
  const dates = days.slice(0, 7).map(day => ({ date: day.date, ids: [...new Set([
    ...(previous.find(item => item.date === day.date)?.ids || []),
    ...(day.suggestions || []).map(item => item.id).filter(id => typeof id === 'string'),
  ])].slice(-6) }));
  // Bound storage to ten recent locations and seven forecast dates per location.
  delete history[key];
  history[key] = { days: dates };
  memory = Object.fromEntries(Object.entries(history).slice(-10));
  try { window.localStorage.setItem(storageKey, JSON.stringify(memory)); } catch { /* Keep in memory. */ }
}
