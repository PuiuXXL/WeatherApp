import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendations } from "./index.js";

function forecast(now = "2026-10-10T10:15") {
  const time = [];
  for (const day of [10, 11, 12]) {
    for (let hour = 0; hour < 24; hour += 1) {
      time.push(`2026-10-${day}T${String(hour).padStart(2, "0")}:00`);
    }
  }
  const fill = (value) => time.map(() => value);
  return {
    current: { time: now },
    hourly: {
      time,
      apparent_temperature: fill(22),
      precipitation_probability: fill(10),
      wind_speed_10m: fill(8),
      wind_gusts_10m: fill(15),
      uv_index: fill(2),
      is_day: time.map((value) => Number(value.slice(11, 13)) >= 8 && Number(value.slice(11, 13)) < 19 ? 1 : 0),
      weather_code: fill(1),
    },
  };
}

test("uses future local hours, verified park, and an indoor evening", () => {
  const park = { name: "Parc test", distanceKm: 1 };
  const result = buildRecommendations(forecast(), [park]);
  assert.equal(result.length, 3);
  assert.equal(result[0].interval.start, "2026-10-10T11:00");
  assert.equal(result[0].interval.end, "2026-10-10T13:00");
  assert.equal(result[0].place, park);
  assert.equal(result[1].activity, "movie_at_home");
  assert.equal(result[2].interval.start, "2026-10-11T08:00");
});

test("rain, excessive heat, gusts, UV, storms and missing values prevent outdoor recommendations", () => {
  for (const [field, value] of [
    ["precipitation_probability", 80], ["apparent_temperature", 35],
    ["wind_gusts_10m", 60], ["uv_index", 8], ["weather_code", 95],
    ["wind_speed_10m", null],
  ]) {
    const data = forecast();
    data.hourly[field].fill(value);
    assert.ok(buildRecommendations(data).every((item) => item.activity !== "park_walk"), field);
  }
});

test("does not join interrupted good weather or different dates", () => {
  const data = forecast();
  data.hourly.precipitation_probability = data.hourly.time.map((_, index) => index % 3 === 2 ? 80 : 10);
  assert.ok(buildRecommendations(data).every((item) => item.activity !== "park_walk"));
  const late = buildRecommendations(forecast("2026-10-10T23:30"));
  assert.equal(late[0].interval, null);
  assert.equal(late[1].interval, null);
  assert.equal(late[2].interval.start, "2026-10-11T08:00");
});

test("can suggest an evening walk in daylight without inventing a place", () => {
  const data = forecast("2026-10-10T18:30");
  data.hourly.is_day.fill(1);
  const result = buildRecommendations(data);
  assert.equal(result[1].activity, "park_walk");
  assert.equal(result[1].interval.start, "2026-10-10T19:00");
  assert.equal(result[1].place, null);
});
