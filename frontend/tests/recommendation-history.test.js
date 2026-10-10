import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendationParams, rememberRecommendations } from '../recommendation-history.js';

globalThis.window = undefined;

const params = new URLSearchParams({ latitude: '46.65', longitude: '23.08' });
function storage(context) {
  const values = new Map();
  context.mock.property(globalThis, 'window', { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } });
  return values;
}

test('each refresh uses a new generation id and passes recent choices for the same location', context => {
  storage(context);
  const first = recommendationParams(params);
  rememberRecommendations(params, [{ date: '2026-10-10', suggestions: [{ id: '2026-10-10-home-reading' }] }]);
  const second = recommendationParams(params);
  assert.notEqual(first.get('generation'), second.get('generation'));
  assert.deepEqual(JSON.parse(second.get('previous')), [{ date: '2026-10-10', ids: ['2026-10-10-home-reading'] }]);
  assert.equal(recommendationParams(new URLSearchParams({ latitude: '40', longitude: '20' })).get('previous'), null);
});

test('history survives reload of the module and remains bounded', async context => {
  const values = storage(context);
  for (let index = 0; index < 12; index++) rememberRecommendations(params, [{ date: '2026-10-10', suggestions: [{ id: `activity-${index}` }] }]);
  const reloaded = await import('../recommendation-history.js?reload');
  const previous = JSON.parse(reloaded.recommendationParams(params).get('previous'));
  assert.equal(previous[0].ids.length, 6);
  assert.deepEqual(previous[0].ids, Array.from({ length: 6 }, (_, index) => `activity-${index + 6}`));
  for (let index = 0; index < 15; index++) rememberRecommendations(new URLSearchParams({ latitude: String(index), longitude: '1' }), []);
  assert.equal(Object.keys(JSON.parse([...values.values()][0])).length, 10);
});

test('blocked storage falls back to in-memory history', context => {
  context.mock.property(globalThis, 'window', { localStorage: {
    getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); },
  } });
  const location = new URLSearchParams({ latitude: '-12', longitude: '-30' });
  rememberRecommendations(location, [{ date: '2026-10-10', suggestions: [{ id: 'reading' }] }]);
  assert.deepEqual(JSON.parse(recommendationParams(location).get('previous'))[0].ids, ['reading']);
});

test('malformed stored days are discarded before sending them to the backend', context => {
  const values = storage(context);
  values.set('weather-match-recommendation-history-v1', JSON.stringify({ '46.65,23.08': { days: [null, { date: 'bad', ids: {} }] } }));
  assert.equal(recommendationParams(params).get('previous'), null);
  assert.doesNotThrow(() => rememberRecommendations(params, [{ date: '2026-10-10', suggestions: [{ id: 'valid' }] }]));
});
