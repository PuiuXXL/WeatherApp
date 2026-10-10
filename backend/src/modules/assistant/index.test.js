import test from "node:test";
import assert from "node:assert/strict";
import { buildAssistantContext, getAssistantPlan, validateAssistantPlan } from "./index.js";

function fixture(name = "Localitate test") {
  const time = Array.from({ length: 48 }, (_, index) =>
    `2026-10-${index < 24 ? "10" : "11"}T${String(index % 24).padStart(2, "0")}:00`);
  const fill = (value) => time.map(() => value);
  const forecast = {
    current: { time: "2026-10-10T12:15", temperature_2m: 22 }, timezone: "Europe/Bucharest",
    hourly_units: { temperature_2m: "C" }, daily_units: { temperature_2m_min: "C" },
    hourly: { time, temperature_2m: fill(22), apparent_temperature: fill(21),
      precipitation_probability: fill(10), wind_speed_10m: fill(8), wind_gusts_10m: fill(15),
      uv_index: fill(2), is_day: fill(1), weather_code: fill(1) },
    daily: { time: ["2026-10-10", "2026-10-11"], temperature_2m_min: [14, 15],
      temperature_2m_max: [25, 26], precipitation_probability_max: [10, 15], wind_speed_10m_max: [8, 9] },
  };
  return buildAssistantContext(forecast, { name, latitude: 46.64721, longitude: 23.07731 }, []);
}

function planFor(context) {
  return { days: context.days.map((day, index) => ({
    date: day.date, summary: "O zi potrivita pentru activitatile propuse.",
    suggestions: day.choices.slice(0, index === 0 ? 2 : 1).map((choice) => ({
      choiceId: choice.id, description: "Alege intervalul indicat in prognoza.", takeWith: ["O jacheta usoara"],
    })),
  })) };
}

function configure(context, key) {
  const before = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = key;
  context.after(() => {
    if (before === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = before;
  });
}

test("context includes every hour today, future daily temperatures and unrounded location", () => {
  const context = fixture();
  assert.equal(context.hourlyToday.time.length, 24);
  assert.equal(context.hourlyToday.time[0], "2026-10-10T00:00");
  assert.equal(context.days[1].temperatureMax, 26);
  assert.equal(context.location.latitude, 46.64721);
  assert.ok(context.days[0].choices[0].interval.start >= context.forecastTime);
});

test("validates day ownership, missing/duplicate dates and invented choices", () => {
  const context = fixture();
  assert.equal(validateAssistantPlan(planFor(context), context)[0].suggestions.length, 2);
  const invalid = planFor(context);
  invalid.days[0].suggestions[0].choiceId = context.days[1].choices[0].id;
  assert.throws(() => validateAssistantPlan(invalid, context));
  invalid.days[1].date = invalid.days[0].date;
  assert.throws(() => validateAssistantPlan(invalid, context));
  assert.throws(() => validateAssistantPlan({ days: [] }, context));
});

test("rejects overlapping activities and keeps future days brief", () => {
  const context = fixture();
  context.days[0].choices[1].interval = context.days[0].choices[0].interval;
  assert.throws(() => validateAssistantPlan(planFor(context), context));
  const other = fixture();
  const plan = planFor(other);
  plan.days[1].suggestions.push(plan.days[1].suggestions[0]);
  assert.throws(() => validateAssistantPlan(plan, other));
});

test("sends structured OpenAI request, returns daily plan and reuses cache", async (context) => {
  configure(context, "test-key-not-a-secret");
  const input = fixture("Generation test");
  let calls = 0;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    calls += 1;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(JSON.parse(body.input).hourlyToday.time.length, 24);
    assert.ok(!body.input.includes("test-key-not-a-secret"));
    return { ok: true, json: async () => ({ status: "completed", output: [
      { type: "message", content: [{ type: "output_text", text: JSON.stringify(planFor(input)) }] },
    ] }) };
  });
  const result = await getAssistantPlan(input);
  assert.equal(result.assistant.status, "generated");
  assert.equal(result.days.length, 2);
  await getAssistantPlan(input);
  assert.equal(calls, 1);
});

test("quota errors produce a useful fallback without exposing provider secrets", async (context) => {
  configure(context, "test-key-not-a-secret");
  context.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 429 }));
  const result = await getAssistantPlan(fixture("Quota test"));
  assert.equal(result.assistant.reason, "quota_or_rate_limit");
  assert.equal(result.days[0].suggestions.length, 2);
  assert.ok(!JSON.stringify(result).includes("test-key-not-a-secret"));
});

test("missing configuration and malformed responses preserve the basic plan", async (context) => {
  configure(context, "");
  assert.equal((await getAssistantPlan(fixture())).assistant.reason, "not_configured");
  process.env.OPENAI_API_KEY = "test-key-not-a-secret";
  context.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({
    status: "completed", output: [{ content: [{ type: "output_text", text: "{\"days\":[]}" }] }],
  }) }));
  assert.equal((await getAssistantPlan(fixture("Malformed test"))).assistant.reason, "invalid_response");
});
