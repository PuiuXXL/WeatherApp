import test from "node:test";
import assert from "node:assert/strict";
import { resolveCoordinateLocation } from "./index.js";

test("resolves a village, coalesces concurrent lookups and preserves exact coordinates", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async (url) => {
    calls += 1;
    assert.equal(url.searchParams.get("accept-language"), "ro");
    return { ok: true, json: async () => ({ address: {
      village: "Localitate test", county: "Cluj", country: "Romania", country_code: "ro",
    } }) };
  });
  const results = await Promise.all([
    resolveCoordinateLocation(46.64721, 23.07731, "Europe/Bucharest"),
    resolveCoordinateLocation(46.64722, 23.07732, "Europe/Bucharest"),
  ]);
  assert.equal(calls, 1);
  assert.equal(results[0].displayName, "Localitate test, Cluj, Romania");
  assert.equal(results[0].countryCode, "RO");
  assert.equal(results[0].status, "resolved");
  assert.equal(results[1].latitude, 46.64722);
  assert.equal(results[1].longitude, 23.07732);
  await resolveCoordinateLocation(46.64721, 23.07731, "Europe/Bucharest");
  assert.equal(calls, 1);
});

test("failed lookup preserves coordinates and does not repeat the failing request", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    throw new Error("Network unavailable");
  });
  const result = await resolveCoordinateLocation(44.1, 26.1, "Europe/Bucharest");
  assert.equal(result.status, "unavailable");
  assert.equal(result.name, null);
  assert.equal(result.latitude, 44.1);
  await resolveCoordinateLocation(44.1, 26.1, "Europe/Bucharest");
  assert.equal(calls, 1);
});
