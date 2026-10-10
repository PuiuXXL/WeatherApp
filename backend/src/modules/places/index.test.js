import test from "node:test";
import assert from "node:assert/strict";
import { findNearbyParks } from "./index.js";

test("returns nearest named park with source link and caches results", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return { ok: true, json: async () => ({ elements: [
      { type: "way", id: 2, center: { lat: 44.44, lon: 26.1 }, tags: { name: "Parc departat" } },
      { type: "node", id: 1, lat: 44.43, lon: 26.1, tags: { name: "Parc apropiat" } },
      { type: "way", id: 3, center: { lat: 45.5, lon: 26.1 }, tags: { name: "Prea departe" } },
    ] }) };
  });
  const result = await findNearbyParks(44.43, 26.1);
  assert.equal(result.status, "available");
  assert.equal(result.parks.length, 2);
  assert.equal(result.parks[0].name, "Parc apropiat");
  assert.equal(result.parks[0].url, "https://www.openstreetmap.org/node/1");
  await findNearbyParks(44.43, 26.1);
  assert.equal(calls, 1);
});

test("place failures and partial responses degrade without rejecting", async (context) => {
  context.mock.method(globalThis, "fetch", async () => { throw new Error("Timeout"); });
  assert.deepEqual(await findNearbyParks(45, 25), { status: "unavailable", parks: [], places: [] });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ elements: [], remark: "runtime error" }) });
  assert.equal((await findNearbyParks(45, 25)).status, "unavailable");
});
