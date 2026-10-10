import test from "node:test";
import assert from "node:assert/strict";
import { getDrivingRoute } from "./index.js";

test("uses longitude first, returns separate outbound/return estimates and caches", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async (url) => {
    calls += 1;
    assert.ok(url.pathname.includes("23,46;23.1,46.1;23,46"));
    return { ok: true, json: async () => ({ code: "Ok", routes: [{ legs: [
      { distance: 12340, duration: 1201 }, { distance: 13000, duration: 1300 },
    ] }] }) };
  });
  const origin = { latitude: 46, longitude: 23 };
  const destination = { latitude: 46.1, longitude: 23.1 };
  const route = await getDrivingRoute(origin, destination);
  assert.equal(route.distanceKm, 12.3);
  assert.equal(route.durationMinutes, 21);
  assert.equal(route.returnDurationMinutes, 22);
  assert.equal(route.trafficIncluded, false);
  await getDrivingRoute(origin, destination);
  assert.equal(calls, 1);
});

test("does not invent travel times when there is no route", async (context) => {
  context.mock.method(globalThis, "fetch", async () => ({ ok: true,
    json: async () => ({ code: "NoRoute", routes: [] }) }));
  assert.equal(await getDrivingRoute({ latitude: 45, longitude: 24 }, { latitude: 45.1, longitude: 24.1 }), null);
});
