import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from .analysis import analyze_trip
from .geometry import cumulative_miles, point_at
from .recommend import recommend, route_stats
from .risk import HIGH, LOW, MODERATE, NO_TRAVEL, SEVERE, UNKNOWN, classify
from .routes import RoutingError, build_checkpoints, pick_interval
from .weather import WeatherData


class RiskBoundaryTests(SimpleTestCase):
    """Phase 7.A - 7.D: Exact threshold boundary and load rule unit tests."""

    def test_wind_exact_boundaries(self):
        # 24.99 -> Low, 25 -> Moderate, 34.99 -> Moderate, 35 -> High,
        # 44.99 -> High, 45 -> Severe, 54.99 -> Severe, 55 -> No Travel
        cases = [
            (24.99, LOW),
            (25.0, MODERATE),
            (34.99, MODERATE),
            (35.0, HIGH),
            (44.99, HIGH),
            (45.0, SEVERE),
            (54.99, SEVERE),
            (55.0, NO_TRAVEL),
            (70.0, NO_TRAVEL),
        ]
        for wind, expected in cases:
            with self.subTest(wind=wind):
                lvl, _ = classify(wind, 0, 0, 10_000)
                self.assertEqual(lvl, expected, f"Wind {wind} mph expected {expected}, got {lvl}")

    def test_rain_exact_boundaries(self):
        # 0.099 -> Low, 0.10 -> Moderate, 0.249 -> Moderate, 0.25 -> High,
        # 0.499 -> High, 0.50 -> Severe, 1.00 -> Severe (inclusive), 1.001 -> No Travel (strictly > 1.00)
        cases = [
            (0.099, LOW),
            (0.10, MODERATE),
            (0.249, MODERATE),
            (0.25, HIGH),
            (0.499, HIGH),
            (0.50, SEVERE),
            (1.00, SEVERE),
            (1.001, NO_TRAVEL),
            (1.50, NO_TRAVEL),
        ]
        for rain, expected in cases:
            with self.subTest(rain=rain):
                lvl, _ = classify(0, rain, 0, 10_000)
                self.assertEqual(lvl, expected, f"Rain {rain} in/hr expected {expected}, got {lvl}")

    def test_snow_exact_boundaries(self):
        # 0.499 -> Low, 0.5 -> Moderate, 0.999 -> Moderate, 1.0 -> High,
        # 1.999 -> High, 2.0 -> Severe, 3.0 -> Severe (inclusive), 3.001 -> No Travel (strictly > 3.0)
        cases = [
            (0.499, LOW),
            (0.5, MODERATE),
            (0.999, MODERATE),
            (1.0, HIGH),
            (1.999, HIGH),
            (2.0, SEVERE),
            (3.0, SEVERE),
            (3.001, NO_TRAVEL),
            (4.0, NO_TRAVEL),
        ]
        for snow, expected in cases:
            with self.subTest(snow=snow):
                lvl, _ = classify(0, 0, snow, 10_000)
                self.assertEqual(lvl, expected, f"Snow {snow} in/hr expected {expected}, got {lvl}")

    def test_load_based_wind_rules(self):
        # Wind 55 mph: universal No Travel regardless of load weight
        for wt in (1_000, 29_999, 30_000, 40_000, 80_000):
            with self.subTest(weight=wt):
                self.assertEqual(classify(55, 0, 0, wt)[0], NO_TRAVEL)

        # Wind 45-54 mph:
        # Load <= 30,000 lb -> base Severe
        self.assertEqual(classify(50, 0, 0, 29_999)[0], SEVERE)
        self.assertEqual(classify(50, 0, 0, 30_000)[0], SEVERE)  # exactly 30k does NOT trigger >30k
        # Load > 30,000 lb -> No Travel
        lvl, reasons = classify(50, 0, 0, 30_001)
        self.assertEqual(lvl, NO_TRAVEL)
        self.assertTrue(any("load > 30,000 lb" in r for r in reasons))

        # Wind 35-44 mph:
        # Load <= 40,000 lb -> base High
        self.assertEqual(classify(40, 0, 0, 39_999)[0], HIGH)
        self.assertEqual(classify(40, 0, 0, 40_000)[0], HIGH)  # exactly 40k does NOT trigger >40k
        # Load > 40,000 lb -> Severe
        lvl, reasons = classify(40, 0, 0, 40_001)
        self.assertEqual(lvl, SEVERE)
        self.assertTrue(any("load > 40,000 lb" in r for r in reasons))

    def test_load_overlays_never_weaken_base_risk(self):
        # Rain 1.5 in/hr is No Travel; a 10,000 lb load with 40 mph wind cannot lower it
        lvl, _ = classify(40, 1.5, 0, 10_000)
        self.assertEqual(lvl, NO_TRAVEL)

        # Rain 0.6 in/hr is Severe; a 20,000 lb load with 38 mph wind (base High) stays Severe
        lvl, _ = classify(38, 0.6, 0, 20_000)
        self.assertEqual(lvl, SEVERE)

    def test_missing_and_unknown_weather_data(self):
        # All missing data must be classified as UNKNOWN, never Low
        lvl, reasons = classify(None, None, None, 40_000)
        self.assertEqual(lvl, UNKNOWN)
        self.assertTrue(any("unavailable" in r for r in reasons))

        # Partial missing data without No Travel condition must be UNKNOWN
        lvl, reasons = classify(10, None, 0, 40_000)
        self.assertEqual(lvl, UNKNOWN)

        # Known No Travel condition takes precedence even if other fields are missing
        lvl, _ = classify(60, None, None, 40_000)
        self.assertEqual(lvl, NO_TRAVEL)


class CheckpointAndEtaTests(SimpleTestCase):
    """Phase 7.E: Checkpoint spacing, ETA calculation, and geometry interpolation."""

    def test_interval_selection(self):
        self.assertEqual(pick_interval(100, "auto"), 10)
        self.assertEqual(pick_interval(300, "auto"), 25)
        self.assertEqual(pick_interval(900, "auto"), 50)
        self.assertEqual(pick_interval(900, "10"), 10)
        self.assertEqual(pick_interval(900, "25"), 25)
        self.assertEqual(pick_interval(900, "50"), 50)

    def test_checkpoints_spacing_and_endpoints(self):
        coords = [(40.0, -100.0), (40.0, -99.0), (40.0, -98.0)]  # ~106 miles
        depart = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)
        cps = build_checkpoints(coords, 7200, depart, 25)

        total = cumulative_miles(coords)[-1]
        self.assertEqual(cps[0]["mile"], 0.0)
        self.assertAlmostEqual(cps[-1]["mile"], total, delta=0.1)

        # Segment miles must sum up to the total route distance
        self.assertAlmostEqual(sum(c["segment_miles"] for c in cps), total, places=2)

        # First checkpoint ETA is departure; final checkpoint ETA is departure + total duration
        self.assertEqual(cps[0]["eta"], depart)
        self.assertEqual(cps[-1]["eta"], depart + timedelta(seconds=7200))

    def test_edge_case_geometries(self):
        depart = datetime(2026, 1, 1, tzinfo=timezone.utc)
        # Empty coords
        self.assertEqual(build_checkpoints([], 3600, depart, 25), [])

        # Single point / zero length
        cps = build_checkpoints([(40.0, -100.0)], 3600, depart, 25)
        self.assertEqual(len(cps), 1)
        self.assertEqual(cps[0]["mile"], 0.0)
        self.assertEqual(cps[0]["segment_miles"], 0.0)

    def test_point_at_interpolation(self):
        coords = [(0.0, 0.0), (0.0, 1.0)]
        cum = cumulative_miles(coords)
        lat, lon = point_at(coords, cum, cum[-1] / 2)
        self.assertAlmostEqual(lon, 0.5, places=3)
        self.assertAlmostEqual(lat, 0.0, places=3)


def _make_route(rid, severe, high, avg, duration_s, no_travel=0, unknown=0):
    cps = []
    if no_travel:
        cps.append({"level": NO_TRAVEL, "segment_miles": no_travel})
    if severe:
        cps.append({"level": SEVERE, "segment_miles": severe})
    if high:
        cps.append({"level": HIGH, "segment_miles": high})
    if unknown:
        cps.append({"level": UNKNOWN, "segment_miles": unknown})
    cps.append({"level": LOW, "segment_miles": 100.0})

    stats = route_stats(cps, duration_s)
    if avg is not None:
        stats["avg_risk"] = avg
    return {"id": rid, "name": f"Route {rid}", "checkpoints": cps, "duration_s": duration_s, "stats": stats}


class RouteRankingTests(SimpleTestCase):
    """Phase 7.F: Lexicographic recommendation ordering and safety constraints."""

    def test_fewest_severe_miles_beats_shorter_route(self):
        # Route 1: 5 Severe miles, 3600s
        # Route 2: 0 Severe miles, 7200s (longer)
        # Route 2 must win because it has fewer Severe miles
        r1 = _make_route(1, severe=5, high=0, avg=0.5, duration_s=3600)
        r2 = _make_route(2, severe=0, high=20, avg=1.2, duration_s=7200)
        best, rationale = recommend([r1, r2])
        self.assertEqual(best["id"], 2)
        self.assertIn("Severe miles", rationale)

    def test_equal_severe_then_fewest_high_miles(self):
        # Route 1: 0 Severe, 30 High miles
        # Route 2: 0 Severe, 10 High miles
        # Route 2 must win
        r1 = _make_route(1, severe=0, high=30, avg=0.5, duration_s=3600)
        r2 = _make_route(2, severe=0, high=10, avg=0.8, duration_s=4000)
        best, rationale = recommend([r1, r2])
        self.assertEqual(best["id"], 2)
        self.assertIn("High miles", rationale)

    def test_equal_severe_and_high_then_lowest_avg_risk(self):
        # Equal Severe (0) and High (10); Route 2 has lower average risk
        r1 = _make_route(1, severe=0, high=10, avg=0.9, duration_s=3600)
        r2 = _make_route(2, severe=0, high=10, avg=0.3, duration_s=4000)
        best, rationale = recommend([r1, r2])
        self.assertEqual(best["id"], 2)
        self.assertIn("average risk", rationale)

    def test_duration_is_final_tie_breaker(self):
        # Equal risk criteria; Route 1 is faster
        r1 = _make_route(1, severe=0, high=10, avg=0.5, duration_s=3600)
        r2 = _make_route(2, severe=0, high=10, avg=0.5, duration_s=4800)
        best, rationale = recommend([r1, r2])
        self.assertEqual(best["id"], 1)
        self.assertIn("faster", rationale)

    def test_no_travel_zero_tolerance_hard_constraint(self):
        # Route 1 has 2 No Travel miles and 0 Severe miles;
        # Route 2 has 0 No Travel miles and 15 Severe miles.
        # Route 2 MUST win because Route 1 violates the hard safety constraint.
        r1 = _make_route(1, severe=0, high=0, avg=0.2, duration_s=3000, no_travel=2)
        r2 = _make_route(2, severe=15, high=0, avg=1.5, duration_s=5000, no_travel=0)
        best, rationale = recommend([r1, r2])
        self.assertEqual(best["id"], 2)
        self.assertIn("No Travel", rationale)

    def test_all_routes_prohibited_scenario(self):
        # When all candidate routes contain No Travel miles, NO route may be recommended as safe.
        r1 = _make_route(1, severe=0, high=0, avg=0.5, duration_s=3600, no_travel=5)
        r2 = _make_route(2, severe=0, high=0, avg=0.8, duration_s=4000, no_travel=10)
        best, rationale = recommend([r1, r2])
        self.assertIsNone(best, "Best route must be None when all routes have No Travel miles")
        self.assertIn("Travel is prohibited", rationale)

    def test_incomplete_weather_reporting(self):
        # When a route contains unknown weather segments, the uncertainty is reported in rationale
        r1 = _make_route(1, severe=0, high=0, avg=0.1, duration_s=3600, unknown=15)
        best, rationale = recommend([r1])
        self.assertEqual(best["id"], 1)
        self.assertIn("incomplete forecast coverage", rationale)


class ApiAndIntegrationTests(SimpleTestCase):
    """Phase 7.G: HTTP endpoints, validation, error handling, and pipeline orchestration."""

    def test_health_check(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"status": "ok"})

    def test_geocode_empty_and_short(self):
        resp = self.client.get("/api/geocode?q=")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"results": []})

        resp = self.client.get("/api/geocode?q=a")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"results": []})

    def test_analyze_validation_errors(self):
        # Empty body
        resp = self.client.post("/api/analyze", data="", content_type="application/json")
        self.assertEqual(resp.status_code, 400)

        # Invalid JSON
        resp = self.client.post("/api/analyze", data="{invalid", content_type="application/json")
        self.assertEqual(resp.status_code, 400)

        # Missing origin / destination
        resp = self.client.post("/api/analyze", data=json.dumps({"origin": {"lat": 40, "lon": -100}}), content_type="application/json")
        self.assertEqual(resp.status_code, 400)

        # Identical origin and destination
        payload = {
            "origin": {"lat": 41.8781, "lon": -87.6298},
            "destination": {"lat": 41.8781, "lon": -87.6298},
            "weight_lb": 42000,
            "departure": "2026-06-01T12:00:00Z",
            "interval_miles": "25",
        }
        resp = self.client.post("/api/analyze", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("same location", resp.json().get("error", ""))

        # Invalid weight
        payload["destination"] = {"lat": 39.7392, "lon": -104.9903}
        payload["weight_lb"] = -500
        resp = self.client.post("/api/analyze", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(resp.status_code, 400)

        payload["weight_lb"] = 300_000
        resp = self.client.post("/api/analyze", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(resp.status_code, 400)

        # Invalid interval
        payload["weight_lb"] = 40_000
        payload["interval_miles"] = "999"
        resp = self.client.post("/api/analyze", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(resp.status_code, 400)

    @patch("routing.analysis.load_weather")
    @patch("routing.analysis.fetch_routes")
    def test_analyze_trip_pipeline(self, mock_fetch_routes, mock_load_weather):
        mock_fetch_routes.return_value = [
            {
                "coords": [(41.8781, -87.6298), (41.5, -95.0), (39.7392, -104.9903)],
                "distance_mi": 1000.0,
                "duration_s": 50000,
            }
        ]

        wx_data = WeatherData()
        base_time = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)
        # Populate mock weather for each coordinate
        for lat, lon in [(41.88, -87.63), (41.5, -95.0), (39.74, -104.99)]:
            wx_data.series[(round(lat, 2), round(lon, 2))] = {
                "base": base_time,
                "wind": [15.0] * 72,
                "rain": [0.0] * 72,
                "snow": [0.0] * 72,
                "temp": [68.0] * 72,
            }
        mock_load_weather.return_value = wx_data

        result = analyze_trip(
            origin={"lat": 41.8781, "lon": -87.6298, "label": "Chicago"},
            destination={"lat": 39.7392, "lon": -104.9903, "label": "Denver"},
            depart=base_time,
            weight_lb=42000,
            interval="50",
        )

        self.assertEqual(len(result["routes"]), 1)
        self.assertEqual(result["recommended_id"], 1)
        self.assertFalse(result["all_prohibited"])
        self.assertIn("routes", result)
        self.assertTrue(len(result["routes"][0]["checkpoints"]) > 0)
        self.assertIn("data_provenance", result)
        self.assertIn("retrieved_at", result["data_provenance"])
        self.assertIn("evaluation", result["routes"][0])
        self.assertIn("audited_miles_sum", result["routes"][0]["stats"])

    def test_auditable_risk_miles_no_double_counting(self):
        """Verify that severe, high, moderate, low, and unknown miles sum precisely to total miles."""
        from .recommend import route_stats

        # 4 checkpoints, segment_miles = 25 each -> total 100 miles
        checkpoints = [
            {"level": "Severe", "segment_miles": 25.0},
            {"level": "High", "segment_miles": 25.0},
            {"level": "Moderate", "segment_miles": 25.0},
            {"level": "Low", "segment_miles": 25.0},
        ]
        stats = route_stats(checkpoints, duration_s=7200)
        self.assertEqual(stats["severe_miles"], 25.0)
        self.assertEqual(stats["high_miles"], 25.0)
        self.assertEqual(stats["moderate_miles"], 25.0)
        self.assertEqual(stats["low_miles"], 25.0)
        self.assertEqual(stats["unknown_miles"], 0.0)
        self.assertEqual(stats["audited_miles_sum"], 100.0)
        self.assertTrue(stats["is_audited_consistent"])

    def test_unknown_weather_never_low_risk(self):
        """Unknown weather segments must be categorized as Unknown and not Low risk."""
        from .recommend import route_stats

        checkpoints = [
            {"level": "Unknown", "segment_miles": 40.0},
            {"level": "Low", "segment_miles": 60.0},
        ]
        stats = route_stats(checkpoints, duration_s=7200)
        self.assertEqual(stats["unknown_miles"], 40.0)
        self.assertEqual(stats["low_miles"], 60.0)
        self.assertTrue(stats["has_unknown"])
        self.assertEqual(stats["audited_miles_sum"], 100.0)

    def test_explainable_recommendation_evaluations(self):
        """Verify transparent evaluations, ranks, and rejection reasons for multi-route comparison."""
        from .recommend import recommend

        r1 = {
            "id": 1,
            "duration_s": 3600,
            "stats": {
                "no_travel_miles": 0,
                "severe_miles": 0,
                "high_miles": 10,
                "moderate_miles": 20,
                "low_miles": 70,
                "unknown_miles": 0,
                "avg_risk": 0.3,
                "worst_risk": 2,
                "duration_s": 3600,
            }
        }
        r2 = {
            "id": 2,
            "duration_s": 4200,
            "stats": {
                "no_travel_miles": 0,
                "severe_miles": 15,
                "high_miles": 20,
                "moderate_miles": 15,
                "low_miles": 50,
                "unknown_miles": 0,
                "avg_risk": 0.8,
                "worst_risk": 3,
                "duration_s": 4200,
            }
        }

        best, rationale, evals = recommend([r1, r2], return_evaluations=True)
        self.assertEqual(best["id"], 1)
        self.assertTrue(evals[1]["is_recommended"])
        self.assertEqual(evals[1]["rank"], 1)
        self.assertFalse(evals[2]["is_recommended"])
        self.assertEqual(evals[2]["rank"], 2)
        self.assertIn("rejection_reason", evals[2])
        self.assertGreater(evals[2]["severe_diff_mi"], 0)
        self.assertGreater(evals[2]["duration_diff_s"], 0)

    def test_influential_checkpoints_extraction(self):
        """Verify extraction of top hazard checkpoints with weather triggers."""
        from .recommend import extract_influential_checkpoints

        checkpoints = [
            {
                "lat": 40.0,
                "lon": -85.0,
                "eta": "2026-10-24T12:00:00Z",
                "distance_from_origin_mi": 50.0,
                "segment_miles": 25.0,
                "wind": 48.0,
                "rain": 0.2,
                "snow": 0.0,
                "temp": 55.0,
                "level": "High",
                "risk_reason": "High wind warning for heavy load"
            },
            {
                "lat": 40.5,
                "lon": -86.0,
                "eta": "2026-10-24T12:30:00Z",
                "distance_from_origin_mi": 75.0,
                "segment_miles": 25.0,
                "wind": 10.0,
                "rain": 0.0,
                "snow": 0.0,
                "temp": 55.0,
                "level": "Low",
                "risk_reason": "Favorable"
            }
        ]
        hazards = extract_influential_checkpoints(checkpoints)
        self.assertEqual(len(hazards), 1)
        self.assertEqual(hazards[0]["level_name"], "High")
        self.assertEqual(hazards[0]["level"], 2)
        self.assertEqual(hazards[0]["wind_mph"], 48.0)

    def test_pdf_report_generation(self):
        """Verify that a valid, multi-page PDF is generated from analysis snapshot."""
        from .report_pdf import (
            build_document_title,
            build_report_filename,
            generate_trip_safety_pdf,
        )

        # 1. Test filename generator
        self.assertEqual(
            build_report_filename("Lahore, Punjab, Pakistan", "Islamabad, ICT, Pakistan"),
            "Lahore_to_Islamabad_Route_Report.pdf",
        )
        self.assertEqual(
            build_report_filename("Lahore", "Islamabad"),
            "Lahore_to_Islamabad_Route_Report.pdf",
        )
        self.assertEqual(
            build_report_filename(None, None),
            "SafeHaul_Route_Report.pdf",
        )
        self.assertEqual(
            build_report_filename("", "Islamabad"),
            "SafeHaul_Route_Report.pdf",
        )

        # 2. Test document title generator
        self.assertEqual(
            build_document_title("Lahore, Punjab, Pakistan", "Islamabad, ICT, Pakistan"),
            "Lahore to Islamabad Route Report",
        )
        self.assertEqual(
            build_document_title(None, None),
            "SafeHaul Route Report",
        )

        trip_info = {
            "origin": {"label": "Chicago, IL", "lat": 41.8781, "lon": -87.6298},
            "destination": {"label": "Denver, CO", "lat": 39.7392, "lon": -104.9903},
            "departure": "2026-10-24T08:00:00Z",
            "weight_lb": 45000,
        }
        analysis_data = {
            "recommended_id": 1,
            "all_prohibited": False,
            "rationale": "Recommended optimal safety route.",
            "data_provenance": {
                "provider": "Open-Meteo Global NWP",
                "model_base_time": "2026-10-24T00:00:00Z",
                "cache_status": "live_fetch",
                "forecast_valid_start": "2026-10-24T08:00:00Z",
                "forecast_valid_end": "2026-10-25T08:00:00Z",
            },
            "routes": [
                {
                    "id": 1,
                    "name": "Route 1 (I-80)",
                    "distance_mi": 1005.0,
                    "duration_s": 73712,
                    "stats": {
                        "no_travel_miles": 0.0,
                        "severe_miles": 0.0,
                        "high_miles": 0.0,
                        "moderate_miles": 10.0,
                        "low_miles": 995.0,
                        "unknown_miles": 0.0,
                        "avg_risk": 0.01,
                        "audited_miles_sum": 1005.0,
                    },
                    "checkpoints": [
                        {
                            "mile": 0.0,
                            "eta": "2026-10-24T08:00:00Z",
                            "wind_mph": 12.0,
                            "rain_in_hr": 0.0,
                            "snow_in_hr": 0.0,
                            "temp_f": 65.0,
                            "level": 0,
                            "level_name": "Low",
                            "reasons": ["Favorable conditions"],
                        }
                    ],
                },
                {
                    "id": 2,
                    "name": "Route 2 (I-70 Scenic)",
                    "distance_mi": 1050.0,
                    "duration_s": 76000,
                    "stats": {
                        "no_travel_miles": 0.0,
                        "severe_miles": 5.0,
                        "high_miles": 0.0,
                        "moderate_miles": 20.0,
                        "low_miles": 1025.0,
                        "unknown_miles": 0.0,
                        "avg_risk": 0.05,
                        "audited_miles_sum": 1050.0,
                    },
                    "checkpoints": [
                        {
                            "mile": 0.0,
                            "eta": "2026-10-24T08:00:00Z",
                            "wind_mph": 15.0,
                            "rain_in_hr": 0.0,
                            "snow_in_hr": 0.0,
                            "temp_f": 60.0,
                            "level": 0,
                            "level_name": "Low",
                            "reasons": ["Favorable conditions"],
                        }
                    ],
                },
            ],
        }

        # 3. Test PDF generation with recommended route
        pdf_bytes = generate_trip_safety_pdf(trip_info, analysis_data)
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))
        self.assertGreater(len(pdf_bytes), 1000)
        self.assertIn(b"/Title (Chicago to Denver Route Report)", pdf_bytes)
        self.assertIn(b"/Author (SafeHaul RouteIQ)", pdf_bytes)
        self.assertNotIn(b"/Title (\\(anonymous\\))", pdf_bytes)

        # 4. Test PDF generation with user-selected route 2 (when route 1 is recommended)
        analysis_with_selected = dict(analysis_data, selected_id=2)
        pdf_bytes_selected = generate_trip_safety_pdf(trip_info, analysis_with_selected)
        self.assertIsInstance(pdf_bytes_selected, bytes)
        self.assertTrue(pdf_bytes_selected.startswith(b"%PDF"))
        self.assertIn(b"/Title (Chicago to Denver Route Report)", pdf_bytes_selected)



from django.test import TestCase


class SavedTripsAndReportTests(TestCase):
    def test_saved_trips_crud_and_endpoints(self):
        """Verify saved trip persistence, duplication, and PDF endpoints."""
        import json
        from django.test import Client
        from .models import Trip, TripAnalysis

        client = Client()

        # 1. Save Trip via POST /api/trips
        create_payload = {
            "name": "Midwest Express Run",
            "origin": {"label": "Chicago, IL", "lat": 41.8781, "lon": -87.6298},
            "destination": {"label": "Denver, CO", "lat": 39.7392, "lon": -104.9903},
            "departure": "2026-10-24T08:00:00Z",
            "weight_lb": 45000,
            "interval_miles": "25",
            "analysis_data": {
                "recommended_id": 1,
                "all_prohibited": False,
                "rationale": "Clear corridor",
                "routes": [{"id": 1, "name": "Route 1", "distance_mi": 1000, "duration_s": 70000, "stats": {}}],
            }
        }
        res = client.post("/api/trips", data=json.dumps(create_payload), content_type="application/json")
        self.assertEqual(res.status_code, 201)
        trip_data = res.json()
        trip_id = trip_data["id"]

        # 2. List Trips via GET /api/trips
        list_res = client.get("/api/trips")
        self.assertEqual(list_res.status_code, 200)
        self.assertTrue(any(t["id"] == trip_id for t in list_res.json()["trips"]))

        # 3. Retrieve Trip Detail via GET /api/trips/<id>
        detail_res = client.get(f"/api/trips/{trip_id}")
        self.assertEqual(detail_res.status_code, 200)
        self.assertEqual(len(detail_res.json()["analyses"]), 1)

        # 4. Duplicate Trip via POST /api/trips/<id>/duplicate
        dup_res = client.post(f"/api/trips/{trip_id}/duplicate", data=json.dumps({"name": "Duplicate Run"}), content_type="application/json")
        self.assertEqual(dup_res.status_code, 201)
        dup_id = dup_res.json()["id"]
        self.assertNotEqual(trip_id, dup_id)

        # 5. Download PDF Report via GET /api/trips/<id>/report.pdf
        pdf_res = client.get(f"/api/trips/{trip_id}/report.pdf")
        self.assertEqual(pdf_res.status_code, 200)
        self.assertEqual(pdf_res["Content-Type"], "application/pdf")
        self.assertEqual(pdf_res["Content-Disposition"], 'attachment; filename="Chicago_to_Denver_Route_Report.pdf"')
        self.assertTrue(pdf_res.content.startswith(b"%PDF"))

        # 5b. Download On-Demand PDF Report via POST /api/report/pdf
        od_payload = {
            "trip": {"origin": {"label": "Lahore, Punjab, Pakistan"}, "destination": {"label": "Islamabad, ICT, Pakistan"}},
            "analysis_data": create_payload["analysis_data"],
        }
        od_res = client.post("/api/report/pdf", data=json.dumps(od_payload), content_type="application/json")
        self.assertEqual(od_res.status_code, 200)
        self.assertEqual(od_res["Content-Disposition"], 'attachment; filename="Lahore_to_Islamabad_Route_Report.pdf"')
        self.assertTrue(od_res.content.startswith(b"%PDF"))

        # 6. Delete Duplicate via DELETE /api/trips/<id>
        del_res = client.delete(f"/api/trips/{dup_id}")
        self.assertEqual(del_res.status_code, 200)
        self.assertFalse(Trip.objects.filter(pk=dup_id).exists())



