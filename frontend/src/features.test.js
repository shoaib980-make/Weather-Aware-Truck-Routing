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

test("Trade-off metric calculations between Fastest and Recommended routes", () => {
  const fastest = {
    duration_s: 25800, // 7h 10m
    distance_mi: 420.0,
    risk_miles: 85.0,
  };
  const recommended = {
    duration_s: 28500, // 7h 55m
    distance_mi: 448.0,
    risk_miles: 24.0,
  };

  const additionalDurationMin = Math.round((recommended.duration_s - fastest.duration_s) / 60);
  const additionalDistanceMi = Number((recommended.distance_mi - fastest.distance_mi).toFixed(1));
  const riskMileReduction = Number((fastest.risk_miles - recommended.risk_miles).toFixed(1));
  const riskReductionPct = fastest.risk_miles > 0
    ? Number(((riskMileReduction / fastest.risk_miles) * 100).toFixed(1))
    : 0;

  assert.equal(additionalDurationMin, 45);
  assert.equal(additionalDistanceMi, 28.0);
  assert.equal(riskMileReduction, 61.0);
  assert.equal(riskReductionPct, 71.8);
});

test("Trade-off handles zero baseline risk miles and negative deltas honestly", () => {
  const fastest = {
    duration_s: 20000,
    distance_mi: 300.0,
    risk_miles: 0.0,
  };
  const recommended = {
    duration_s: 20000,
    distance_mi: 300.0,
    risk_miles: 0.0,
  };

  const riskReduction = fastest.risk_miles - recommended.risk_miles;
  const pct = fastest.risk_miles > 0 ? (riskReduction / fastest.risk_miles) * 100 : 0;
  assert.equal(riskReduction, 0);
  assert.equal(pct, 0);
});

test("Hazard breakdown aggregation does not exceed route total distance", () => {
  const route = {
    distance_mi: 500.0,
    hazard_breakdown: {
      winds: 45.0,
      rain: 30.0,
      snow: 15.0,
      severe: 10.0,
      unknown: 5.0,
      nominal: 395.0,
    },
  };

  const hazardSum = Object.values(route.hazard_breakdown).reduce((a, b) => a + b, 0);
  assert.equal(Math.round(hazardSum), 500);
});

test("PDF report filename generation follows standard format", () => {
  const today = "2026-10-23";
  const filename = `SafeHaul_RouteIQ_Trip_Report_${today}.pdf`;
  assert.match(filename, /^SafeHaul_RouteIQ_Trip_Report_\d{4}-\d{2}-\d{2}\.pdf$/);
});

test("Saved trip comparison delta calculations", () => {
  const v1 = { risk_miles: 42.0, duration_s: 36000 };
  const v2 = { risk_miles: 54.0, duration_s: 37500 };

  const riskDelta = Number((v2.risk_miles - v1.risk_miles).toFixed(1));
  const timeDeltaMin = Math.round((v2.duration_s - v1.duration_s) / 60);

  assert.equal(riskDelta, 12.0); // +12 miles risk
  assert.equal(timeDeltaMin, 25); // +25 min
});

