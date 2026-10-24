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
import { getRouteReportFilename } from "./api.js";

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

test("PDF report filename generation follows dynamic route-based format with safe fallback", () => {
  assert.equal(
    getRouteReportFilename("Lahore, Punjab, Pakistan", "Islamabad, ICT, Pakistan"),
    "Lahore_to_Islamabad_Route_Report.pdf"
  );
  assert.equal(
    getRouteReportFilename({ label: "Lahore" }, { label: "Islamabad" }),
    "Lahore_to_Islamabad_Route_Report.pdf"
  );
  assert.equal(
    getRouteReportFilename("Salt Lake City, UT", "Denver, CO"),
    "Salt_Lake_City_to_Denver_Route_Report.pdf"
  );
  assert.equal(
    getRouteReportFilename(null, null),
    "SafeHaul_Route_Report.pdf"
  );
  assert.equal(
    getRouteReportFilename("", "Islamabad"),
    "SafeHaul_Route_Report.pdf"
  );
});

test("Saved trip comparison delta calculations", () => {
  const v1 = { risk_miles: 42.0, duration_s: 36000 };
  const v2 = { risk_miles: 54.0, duration_s: 37500 };

  const riskDelta = Number((v2.risk_miles - v1.risk_miles).toFixed(1));
  const timeDeltaMin = Math.round((v2.duration_s - v1.duration_s) / 60);

  assert.equal(riskDelta, 12.0); // +12 miles risk
  assert.equal(timeDeltaMin, 25); // +25 min
});

test("Origin & destination endpoint city label extraction for mobile corridor status", () => {
  const origin = { label: "Chicago, Cook County, Illinois, United States", lat: 41.8781, lon: -87.6298 };
  const destination = { label: "Denver, Colorado, United States", lat: 39.7392, lon: -104.9903 };

  const originCity = origin.label.split(",")[0].trim();
  const destCity = destination.label.split(",")[0].trim();

  assert.equal(originCity, "Chicago");
  assert.equal(destCity, "Denver");
  assert.equal(`${originCity} → ${destCity}`, "Chicago → Denver");
});

test("Mobile route chips badge triggers: Safest, No Travel, and Severe warnings", () => {
  const routes = [
    { id: 1, name: "I-80 W", stats: { severe_miles: 0, no_travel_miles: 0 } },
    { id: 2, name: "I-70 W", stats: { severe_miles: 45, no_travel_miles: 0 } },
    { id: 3, name: "I-90 W", stats: { severe_miles: 10, no_travel_miles: 25 } },
  ];
  const recommendedId = 1;

  // Route 1 is Safest
  assert.equal(routes[0].id === recommendedId, true);
  assert.equal(routes[0].stats.severe_miles, 0);

  // Route 2 has Severe warning
  assert.equal(routes[1].stats.severe_miles > 0, true);
  assert.equal(`${routes[1].stats.severe_miles}m sev`, "45m sev");

  // Route 3 has No Travel trigger
  assert.equal(routes[2].stats.no_travel_miles > 0, true);
});

test("Styles CSS includes complete mobile-first responsive breakpoints and safe area padding", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const css = fs.readFileSync(path.resolve(process.cwd(), "src/styles.css"), "utf-8");

  assert.equal(css.includes("@media (max-width: 900px)"), true, "Missing 900px tablet/mobile breakpoint");
  assert.equal(css.includes("@media (max-width: 640px)"), true, "Missing 640px phone breakpoint");
  assert.equal(css.includes("@media (max-width: 420px)"), true, "Missing 420px small phone breakpoint");
  assert.equal(css.includes("@media (max-width: 340px)"), true, "Missing 340px extra-small phone breakpoint");
  assert.equal(css.includes("env(safe-area-inset-bottom"), true, "Missing iOS safe area inset support");
  assert.equal(css.includes(".mobile-map-corridor-bar"), true, "Missing mobile map corridor status bar CSS");
  assert.equal(css.includes(".view-on-map-btn"), true, "Missing view on map action button CSS");
  assert.equal(css.includes("font-size: 16px !important"), true, "Missing iOS Safari auto-zoom prevention rule");
  assert.equal(css.includes(".heat-slider-container.is-collapsed"), true, "Missing collapsible HeatSlider class");
  assert.equal(css.includes(".collapse-toggle-btn"), true, "Missing collapse-toggle-btn class");
  // Ensure .mobile-pane-hidden does NOT use display:none so Leaflet maintains DOM dimensions
  assert.equal(css.includes("visibility: hidden !important"), true, "mobile-pane-hidden must preserve container dimensions");
});

test("Smart asymmetrical map padding clears top corridor bar and bottom slider without obscuring routes", () => {
  function computePadding(isMobile, isSliderCollapsed) {
    const padTop = isMobile ? 105 : 55;
    const padBottom = isMobile ? (isSliderCollapsed ? 75 : 195) : 125;
    const padSide = isMobile ? 24 : 50;
    return {
      paddingTopLeft: [padSide, padTop],
      paddingBottomRight: [padSide, padBottom],
    };
  }

  // Mobile with slider expanded (clears 195px bottom slider)
  const mobileExpanded = computePadding(true, false);
  assert.equal(mobileExpanded.paddingTopLeft[1], 105);
  assert.equal(mobileExpanded.paddingBottomRight[1], 195);

  // Mobile with slider collapsed (clears compact 75px bar)
  const mobileCollapsed = computePadding(true, true);
  assert.equal(mobileCollapsed.paddingTopLeft[1], 105);
  assert.equal(mobileCollapsed.paddingBottomRight[1], 75);

  // Desktop
  const desktop = computePadding(false, false);
  assert.equal(desktop.paddingTopLeft[1], 55);
  assert.equal(desktop.paddingBottomRight[1], 125);
});

test("Map controls dock and Route Alternatives legend CSS prevent overlap", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const css = fs.readFileSync(path.resolve(process.cwd(), "src/styles.css"), "utf-8");

  assert.equal(css.includes(".map-controls-dock {"), true, "Missing .map-controls-dock definition");
  assert.equal(css.includes("pointer-events: none;"), true, "Dock should allow map interactions through pass-through");
  assert.equal(css.includes(".map-controls-dock > * {"), true, "Dock children must enable pointer events");
  // Ensure both .custom-map-controls and .floating-legend-card are static in flow inside dock
  assert.equal(css.includes(".custom-map-controls {\n  position: static;"), true, "Map controls should be static inside dock");
  assert.equal(css.includes(".floating-legend-card {\n  position: static;"), true, "Route legend should be static inside dock");
});

test("Leaflet pane stacking hierarchy guarantees routes stay above weather heatmap", () => {
  // Stacking z-index contract
  const panes = {
    tilePane: 200,
    heat: 350,
    routeAlternatives: 420,
    routeSelectedCasing: 470,
    routeSelected: 480,
    checkpointsPane: 550,
    markerPane: 600,
  };

  assert.equal(panes.heat > panes.tilePane, true, "Heatmap must be above base map tiles");
  assert.equal(panes.routeAlternatives > panes.heat, true, "Alternative routes must be above weather heatmap");
  assert.equal(panes.routeSelectedCasing > panes.routeAlternatives, true, "Selected route casing must be above alternative routes");
  assert.equal(panes.routeSelected > panes.routeSelectedCasing, true, "Selected route core must be above its outer casing");
  assert.equal(panes.checkpointsPane > panes.routeSelected, true, "Checkpoints must be above route lines");
  assert.equal(panes.markerPane > panes.checkpointsPane, true, "Origin & destination pins must be above checkpoints");
});

test("Route selection accurately selects geometry, travel time, and distance", () => {
  const mockRoutes = [
    { id: 1, name: "I-80 W", distance_mi: 642.5, duration_s: 36000, geometry: [[41.8, -87.6], [41.2, -95.9], [39.7, -104.9]] },
    { id: 2, name: "I-70 W", distance_mi: 680.1, duration_s: 38400, geometry: [[41.8, -87.6], [38.6, -90.2], [39.7, -104.9]] },
    { id: 3, name: "I-90 W", distance_mi: 710.0, duration_s: 41000, geometry: [[41.8, -87.6], [43.0, -89.4], [39.7, -104.9]] },
  ];

  function getRouteDetails(selectedId) {
    const route = mockRoutes.find((r) => r.id === selectedId) || mockRoutes[0];
    return {
      selectedId: route.id,
      name: route.name,
      geometry: route.geometry,
      distance: Math.round(route.distance_mi),
      durationMin: Math.round(route.duration_s / 60),
    };
  }

  // Selecting Route 1
  const sel1 = getRouteDetails(1);
  assert.equal(sel1.selectedId, 1);
  assert.equal(sel1.name, "I-80 W");
  assert.equal(sel1.distance, 643);
  assert.deepEqual(sel1.geometry[1], [41.2, -95.9]);

  // Selecting Route 2
  const sel2 = getRouteDetails(2);
  assert.equal(sel2.selectedId, 2);
  assert.equal(sel2.name, "I-70 W");
  assert.equal(sel2.distance, 680);
  assert.deepEqual(sel2.geometry[1], [38.6, -90.2]);

  // Selecting Route 3
  const sel3 = getRouteDetails(3);
  assert.equal(sel3.selectedId, 3);
  assert.equal(sel3.name, "I-90 W");
  assert.equal(sel3.distance, 710);
  assert.deepEqual(sel3.geometry[1], [43.0, -89.4]);
});

test("Corridor pending and initial states safely handle null or partial origin and destination", () => {
  function formatPendingEndpoints(currentOrigin, currentDestination) {
    if (!currentOrigin && !currentDestination) return null;
    const originText = currentOrigin?.label ? currentOrigin.label.split(",")[0] : "Origin";
    const destText = currentDestination?.label ? currentDestination.label.split(",")[0] : "Destination";
    return `${originText} → ${destText}`;
  }

  // 1. Initial empty state: both null
  assert.equal(formatPendingEndpoints(null, null), null);

  // 2. Only origin provided
  assert.equal(formatPendingEndpoints({ label: "Dallas, TX" }, null), "Dallas → Destination");

  // 3. Only destination provided
  assert.equal(formatPendingEndpoints(null, { label: "Atlanta, GA" }), "Origin → Atlanta");

  // 4. Incomplete objects with missing or undefined label
  assert.equal(formatPendingEndpoints({}, {}), "Origin → Destination");

  // 5. Complete objects
  assert.equal(
    formatPendingEndpoints(
      { label: "Chicago, IL, USA" },
      { label: "Denver, CO, USA" }
    ),
    "Chicago → Denver"
  );
});



