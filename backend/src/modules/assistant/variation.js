import { createHash, randomUUID } from "node:crypto";

export function parseGenerationOptions(params) {
  const variation = params.get("generation") ?? randomUUID();
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(variation)) throw new Error("generation invalid.");
  const raw = params.get("previous") ?? "[]";
  if (raw.length > 5000) throw new Error("Istoricul recomandarilor este prea mare.");
  let previousChoices;
  try { previousChoices = JSON.parse(raw); } catch { throw new Error("Istoric invalid."); }
  if (!Array.isArray(previousChoices) || previousChoices.length > 7 || previousChoices.some((day) =>
    !day || typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
    !Array.isArray(day.ids) || day.ids.length > 6 || day.ids.some((id) =>
      typeof id !== "string" || !/^[a-zA-Z0-9_:/.-]{1,120}$/.test(id)))) throw new Error("Istoric invalid.");
  return { variation, previousChoices: previousChoices.map(({ date, ids }) => ({ date, ids })) };
}

export function varyChoices(choices, date, location, options) {
  const previous = new Set((options.previousChoices ?? []).filter((day) => day.date === date).flatMap((day) => day.ids));
  const fresh = choices.filter((choice) => !previous.has(choice.id));
  const eligible = fresh.length ? fresh : choices;
  if (!options.variation) return eligible;
  const seed = `${options.variation}:${location.latitude}:${location.longitude}:${date}`;
  const rank = (choice) => createHash("sha256").update(`${seed}:${choice.id}`).digest("hex");
  const tier = (choice) => choice.place ? 0 : choice.activity.startsWith("local_") ? 1 : 2;
  return eligible.toSorted((a, b) => tier(a) - tier(b) ||
    (a.interval?.start ?? "").localeCompare(b.interval?.start ?? "") || rank(a).localeCompare(rank(b)));
}
