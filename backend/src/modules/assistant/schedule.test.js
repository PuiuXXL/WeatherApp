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

test("offers distinct home activities and rotates their order between dates", () => {
  const local = weather();
  const today = buildDayChoices(local, "2026-10-10");
  const tomorrow = buildDayChoices(local, "2026-10-11");
  const home = tomorrow.filter((choice) => choice.activity.startsWith("home_"));
  assert.equal(home.length, 8);
  assert.equal(new Set(home.map((choice) => choice.diversityKey)).size, 8);
  assert.equal(new Set(home.map((choice) => choice.title)).size, 8);
  assert.notEqual(today.find(choice => choice.activity.startsWith("home_")).diversityKey, home[0].diversityKey);
  assert.ok(home.every((choice) => !choice.place && choice.interval.start >= "2026-10-11T09:00"));
});

test("home activities use daily weather context without inventing weather", () => {
  const local = weather();
  local.daily = { time: ["2026-10-10"], temperature_2m_max: [6], precipitation_probability_max: [15] };
  assert.ok(buildDayChoices(local, "2026-10-10").find(choice => choice.activity.startsWith("home_")).reason.includes("6 C"));
  local.daily.temperature_2m_max[0] = 20;
  local.daily.precipitation_probability_max[0] = 80;
  assert.ok(buildDayChoices(local, "2026-10-10").find(choice => choice.activity.startsWith("home_")).reason.includes("80%"));
});

test("local outings use coordinates' hourly weather and location without inventing a destination", () => {
  const forecast = weather();
  const choices = buildDayChoices(forecast, "2026-10-10", [], { name: "Marisel" });
  const local = choices.filter(choice => choice.scope === "local_area");
  assert.equal(local.length, 3);
  assert.ok(local.every(choice => choice.title.includes("Marisel") && choice.place === null));
  assert.ok(local.every(choice => choice.interval.start >= forecast.current.time && choice.weather.feelsLike === 21));
  assert.ok(local.every(choice => !choice.route));
  forecast.hourly.precipitation_probability.fill(80);
  assert.equal(buildDayChoices(forecast, "2026-10-10").filter(choice => choice.scope === "local_area").length, 0);
  forecast.hourly.precipitation_probability.fill(10);
  forecast.hourly.apparent_temperature.fill(2);
  assert.equal(buildDayChoices(forecast, "2026-10-10").filter(choice => choice.scope === "local_area").length, 0);
  forecast.hourly.apparent_temperature.fill(21);
  forecast.hourly.is_day.fill(0);
  assert.equal(buildDayChoices(forecast, "2026-10-10").filter(choice => choice.scope === "local_area").length, 0);
});
