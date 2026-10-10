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
  const used = new Set();
  return { days: context.days.map((day, index) => {
    const first = day.choices.find(choice => !used.has(choice.diversityKey)) ?? day.choices[0];
    const selected = [first];
    if (index === 0 && first.interval) {
      const second = day.choices.find(choice => choice.interval && choice.interval.start >= first.interval.end);
      if (second) selected.push(second);
    }
    for (const choice of selected) used.add(choice.diversityKey);
    return { date: day.date, summary: "O zi potrivita pentru activitatile propuse.",
      suggestions: selected.map(choice => ({ choiceId: choice.id, title: choice.title,
        description: "Alege intervalul indicat in prognoza.", takeWith: ["O jacheta usoara"] })),
    };
  }) };
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
  const overlapping = planFor(context);
  const second = context.days[0].choices.find(choice => choice.id === overlapping.days[0].suggestions[1].choiceId);
  second.interval = context.days[0].choices[0].interval;
  assert.throws(() => validateAssistantPlan(overlapping, context));
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
    assert.ok(body.instructions.includes("diversityKey"));
    assert.ok(JSON.parse(body.input).days[1].choices.length >= 8);
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

test("rejects repeated categories when an unused eligible activity exists", () => {
  const context = fixture();
  const plan = planFor(context);
  const repeated = context.days[1].choices.find((choice) =>
    choice.diversityKey === context.days[0].choices[0].diversityKey);
  plan.days[1].suggestions[0].choiceId = repeated.id;
  assert.throws(() => validateAssistantPlan(plan, context), /repetitive_response/);
  context.days[1].choices = [repeated];
  assert.equal(validateAssistantPlan(plan, context).length, 2);
});

test("fallback keeps seven cold days varied without verified destinations or AI", async (context) => {
  configure(context, "");
  const input = fixture("Cold week");
  const { buildDayChoices } = await import("./schedule.js");
  const dates = Array.from({ length: 7 }, (_, index) => `2026-10-${10 + index}`);
  const forecast = { current: input.current, daily: {
    time: dates, temperature_2m_max: dates.map(() => 6), precipitation_probability_max: dates.map(() => 80),
  } };
  input.days = dates.map((date) => ({ date, temperatureMin: 0, temperatureMax: 6,
    choices: buildDayChoices(forecast, date),
  }));
  const result = await getAssistantPlan(input);
  assert.equal(result.assistant.status, "fallback");
  const suggestions = result.days.flatMap((day) => day.suggestions);
  assert.equal(new Set(suggestions.map((item) => item.diversityKey)).size, suggestions.length);
  assert.ok(suggestions.every((item) => !item.place));
  const today = result.days[0].suggestions;
  assert.equal(today.length, 2);
  assert.ok(today[0].interval.end <= today[1].interval.start);
});

test("repetitive model output falls back to varied activities", async (context) => {
  configure(context, "test-key-not-a-secret");
  const input = fixture("Repetitive model test");
  const plan = planFor(input);
  plan.days[1].suggestions[0].choiceId = input.days[1].choices.find((choice) =>
    choice.diversityKey === input.days[0].choices[0].diversityKey).id;
  context.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({
    status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(plan) }] }],
  }) }));
  const result = await getAssistantPlan(input);
  assert.equal(result.assistant.reason, "repetitive_response");
  assert.notEqual(result.days[0].suggestions[0].diversityKey, result.days[1].suggestions[0].diversityKey);
});

test("new generations exclude previous choices even without AI and keep location-specific weather", async (context) => {
  configure(context, "");
  const base = fixture("Location-specific test");
  const { varyChoices } = await import("./variation.js");
  const first = await getAssistantPlan(base);
  const previousChoices = first.days.map(day => ({ date: day.date, ids: day.suggestions.map(item => item.id) }));
  const next = { ...base, generation: "second-request", days: base.days.map(day => ({ ...day,
    choices: varyChoices(day.choices, day.date, base.location, { variation: "second-request", previousChoices }),
  })) };
  const second = await getAssistantPlan(next);
  for (const day of second.days) {
    assert.ok(day.suggestions.every(item => !previousChoices.find(previous => previous.date === day.date).ids.includes(item.id)));
  }
});

test("AI can write concrete titles, but cannot replace the verified destination title", () => {
  const context = fixture();
  const plan = planFor(context);
  plan.days[0].suggestions[0].title = "Fotografiaza trei detalii de arhitectura din apropiere";
  assert.equal(validateAssistantPlan(plan, context)[0].suggestions[0].title, plan.days[0].suggestions[0].title);
  const choice = context.days[0].choices.find(item => item.id === plan.days[0].suggestions[0].choiceId);
  choice.place = { name: "Muzeu verificat" };
  assert.equal(validateAssistantPlan(plan, context)[0].suggestions[0].title, choice.title);
  plan.days[0].suggestions[0].title = "";
  assert.throws(() => validateAssistantPlan(plan, context), /invalid_response/);
});

test("different generation ids request new AI plans instead of returning the previous cached plan", async (context) => {
  configure(context, "test-key-not-a-secret");
  const first = { ...fixture("Fresh generation test"), generation: "first-request" };
  let calls = 0;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    calls += 1;
    const input = JSON.parse(JSON.parse(options.body).input);
    return { ok: true, json: async () => ({ status: "completed", output: [{ content: [
      { type: "output_text", text: JSON.stringify(planFor(input)) },
    ] }] }) };
  });
  const firstPlan = await getAssistantPlan(first);
  assert.equal(firstPlan.assistant.status, "generated");
  const { varyChoices } = await import("./variation.js");
  const previousChoices = firstPlan.days.map(day => ({ date: day.date, ids: day.suggestions.map(item => item.id) }));
  const second = { ...first, generation: "second-request", days: first.days.map(day => ({ ...day,
    choices: varyChoices(day.choices, day.date, first.location, { variation: "second-request", previousChoices }),
  })) };
  const secondPlan = await getAssistantPlan(second);
  assert.equal(secondPlan.assistant.status, "generated");
  assert.notEqual(firstPlan.days[0].suggestions[0].id, secondPlan.days[0].suggestions[0].id);
  await getAssistantPlan(second);
  assert.equal(calls, 2);
});
