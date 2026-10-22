import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVELS,
  LEVEL_COLORS,
  calcETA,
  fmtDuration,
  fmtTime,
  getRiskLevelBadge,
  levelColor,
} from "./risk.js";

test("Risk levels constants and colors", () => {
  assert.strictEqual(LEVELS.length, 6);
  assert.strictEqual(LEVELS[0], "Low");
  assert.strictEqual(LEVELS[1], "Moderate");
  assert.strictEqual(LEVELS[2], "High");
  assert.strictEqual(LEVELS[3], "Severe");
  assert.strictEqual(LEVELS[4], "No Travel");
  assert.strictEqual(LEVELS[5], "Unknown");

  assert.strictEqual(LEVEL_COLORS.length, 6);
});

test("getRiskLevelBadge returns proper badge metadata", () => {
  const low = getRiskLevelBadge(0);
  assert.strictEqual(low.name, "Low");
  assert.strictEqual(low.color, "#10b981");

  const mod = getRiskLevelBadge(1);
  assert.strictEqual(mod.name, "Moderate");

  const high = getRiskLevelBadge(2);
  assert.strictEqual(high.name, "High");

  const severe = getRiskLevelBadge(3);
  assert.strictEqual(severe.name, "Severe");

  const noTravel = getRiskLevelBadge(4);
  assert.strictEqual(noTravel.name, "No Travel");

  const unknown = getRiskLevelBadge(5);
  assert.strictEqual(unknown.name, "Unknown");
});

test("fmtDuration converts seconds to readable hours and minutes", () => {
  assert.strictEqual(fmtDuration(0), "0 m");
  assert.strictEqual(fmtDuration(1800), "30 m");
  assert.strictEqual(fmtDuration(3600), "1h 00m");
  assert.strictEqual(fmtDuration(5400), "1h 30m");
  assert.strictEqual(fmtDuration(50000), "13h 53m");
});

test("calcETA calculates projected arrival timestamp accurately", () => {
  const depart = "2026-06-01T12:00:00.000Z";
  const duration = 7200; // 2 hours
  const arrival = calcETA(depart, duration);
  assert.strictEqual(arrival, "2026-06-01T14:00:00.000Z");

  assert.strictEqual(calcETA("", 100), "—");
  assert.strictEqual(calcETA("invalid-date", 100), "—");
});

test("fmtTime handles ISO timestamps safely", () => {
  assert.strictEqual(fmtTime(""), "—");
  assert.strictEqual(fmtTime(null), "—");
  assert.strictEqual(fmtTime("invalid-date"), "—");
  const valid = fmtTime("2026-06-01T14:30:00.000Z");
  assert.ok(typeof valid === "string" && valid.length > 3);
});

test("levelColor interpolates smoothly across risk boundaries", () => {
  const c0 = levelColor(0);
  assert.ok(c0.startsWith("rgb("));

  const c4 = levelColor(4);
  assert.ok(c4.startsWith("rgb("));

  // Clamps negative and excessive values
  const cNeg = levelColor(-1);
  assert.strictEqual(cNeg, c0);

  const cHigh = levelColor(10);
  assert.strictEqual(cHigh, c4);
});
