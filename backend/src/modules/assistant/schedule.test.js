import test from "node:test";
import assert from "node:assert/strict";
import { buildDayChoices } from "./schedule.js";

function weather() {
  const time = Array.from({ length: 24 }, (_, hour) => `2026-10-10T${String(hour).padStart(2, "0")}:00`);
  const fill = (value) => time.map(() => value);
  return { current: { time: "2026-10-10T10:15" }, timezone: "Europe/Bucharest",
    hourly: { time, temperature_2m: fill(22), apparent_temperature: fill(21),
      precipitation_probability: fill(10), uv_index: fill(2), is_day: fill(1),
      weather_code: fill(1), wind_gusts_10m: fill(15) } };
}

test("lake schedule includes preparation, driving, snack and asymmetric return in future hours", () => {
  const forecast = weather();
  const choices = buildDayChoices(forecast, "2026-10-10", [{ id: "way/1", name: "Lac test", kind: "lake",
    route: { durationMinutes: 25, returnDurationMinutes: 30 }, forecast }]);
  const outing = choices[0];
  assert.equal(outing.place.name, "Lac test");
  assert.equal(outing.interval.start, "2026-10-10T10:20");
  assert.equal(outing.interval.end, "2026-10-10T13:00");
  assert.equal(outing.itinerary.length, 5);
  assert.ok(outing.itinerary[3].title.includes("sandwich"));
  for (let index = 1; index < outing.itinerary.length; index += 1) {
    assert.equal(outing.itinerary[index].start, outing.itinerary[index - 1].end);
  }
});

test("uses destination weather and refuses unverified trips or after-dark returns", () => {
  const local = weather();
  const destination = weather();
  destination.hourly.precipitation_probability.fill(90);
  const place = { id: "way/1", name: "Lac test", kind: "lake", route: { durationMinutes: 25, returnDurationMinutes: 30 }, forecast: destination };
  assert.ok(buildDayChoices(local, "2026-10-10", [place]).every((choice) => !choice.place));
  assert.ok(buildDayChoices(local, "2026-10-10", [{ ...place, route: null }]).every((choice) => !choice.place));
  local.current.time = "2026-10-10T18:30";
  assert.ok(buildDayChoices(local, "2026-10-10", [{ ...place, forecast: weather() }]).every((choice) => !choice.place));
});

test("late night never creates past or midnight-to-evening activities", () => {
  const local = weather();
  local.current.time = "2026-10-10T23:45";
  const choices = buildDayChoices(local, "2026-10-10", []);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].interval, null);
});
