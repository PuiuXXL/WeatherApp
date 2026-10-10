import test from "node:test";
import assert from "node:assert/strict";
import { parseGenerationOptions, varyChoices } from "./variation.js";

test("a new request gets a unique generation id; invalid history is rejected", () => {
  assert.notEqual(parseGenerationOptions(new URLSearchParams()).variation, parseGenerationOptions(new URLSearchParams()).variation);
  const history = [{ date: "2026-10-10", ids: ["2026-10-10-home-reading"] }];
  const params = new URLSearchParams({ generation: "new-plan-123", previous: JSON.stringify(history) });
  assert.deepEqual(parseGenerationOptions(params), { variation: "new-plan-123", previousChoices: history });
  for (const previous of ["bad-json", "null", "{}", '[{"date":"bad","ids":[]}]', JSON.stringify([{ date: "2026-10-10", ids: Array(7).fill("id") }])]) {
    assert.throws(() => parseGenerationOptions(new URLSearchParams({ previous })));
  }
  assert.throws(() => parseGenerationOptions(new URLSearchParams({ generation: "bad value" })));
});

test("recent choices are excluded per date, with a fallback when no alternatives remain", () => {
  const choices = [{ id: "one", activity: "home_reading" }, { id: "two", activity: "home_games" }];
  const location = { latitude: 46, longitude: 23 };
  const options = { variation: "request-1", previousChoices: [{ date: "2026-10-10", ids: ["one"] }] };
  assert.deepEqual(varyChoices(choices, "2026-10-10", location, options).map(choice => choice.id), ["two"]);
  assert.equal(varyChoices(choices, "2026-10-11", location, options).length, 2);
  assert.equal(varyChoices([choices[0]], "2026-10-10", location, options).length, 1);
});

test("ordering varies across generations but retries are stable and verified destinations retain priority", () => {
  const choices = Array.from({ length: 8 }, (_, index) => ({ id: `choice-${index}`, activity: "home_reading" }));
  const location = { latitude: 46, longitude: 23 };
  const order = variation => varyChoices(choices, "2026-10-10", location, { variation }).map(choice => choice.id).join();
  assert.equal(order("one"), order("one"));
  assert.notEqual(order("one"), order("two"));
  const place = { id: "museum", activity: "local_visit", place: { name: "Verified museum" } };
  assert.equal(varyChoices([...choices, place], "2026-10-10", location, { variation: "one" })[0].id, "museum");
});
