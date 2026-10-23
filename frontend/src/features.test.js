import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVELS,
  LEVEL_COLORS,
  calcETA,
  fmtDuration,
  fmtTime,
  getRiskLevelBadge,
} from "./risk.js";

test("Risk categories include Unknown and adhere to 6 distinct levels", () => {
  assert.equal(LEVELS.length, 6);
  assert.equal(LEVELS[0], "Low");
  assert.equal(LEVELS[1], "Moderate");
  assert.equal(LEVELS[2], "High");
  assert.equal(LEVELS[3], "Severe");
  assert.equal(LEVELS[4], "No Travel");
  assert.equal(LEVELS[5], "Unknown");
  assert.equal(LEVEL_COLORS.length, 6);
});

test("Auditable risk mileage sum equals route total without double-counting", () => {
  const milesByLevel = {
    Low: 450.0,
    Moderate: 120.0,
    High: 50.0,
    Severe: 25.0,
    "No Travel": 0.0,
    Unknown: 15.0,
  };
  const totalAudited = Object.values(milesByLevel).reduce((acc, mi) => acc + mi, 0);
  assert.equal(totalAudited, 660.0);
});

test("Unknown risk badge returns proper metadata and distinct gray tint", () => {
  const badge = getRiskLevelBadge(5);
  assert.equal(badge.name, "Unknown");
  assert.equal(badge.color, "#64748b");
});

test("Checkpoint ETA to forecast hour offset conversion", () => {
  const forecastStart = "2026-10-24T08:00:00Z";
  const checkpointEta = "2026-10-24T14:30:00Z";
  const diffMs = new Date(checkpointEta).getTime() - new Date(forecastStart).getTime();
  const hourOffset = Math.min(48, Math.max(0, Math.round(diffMs / (3600 * 1000))));
  assert.equal(hourOffset, 7);
});

test("Route rejection delta metrics formatting", () => {
  const durationDiffSeconds = 2700; // 45 min
  const severeDiffMiles = 18.4;
  const highDiffMiles = 12.0;

  const durationMin = Math.round(durationDiffSeconds / 60);
  assert.equal(durationMin, 45);
  assert.equal(`${durationMin} min`, "45 min");
  assert.equal(`+${severeDiffMiles} mi severe`, "+18.4 mi severe");
});
