from datetime import datetime, timezone

from django.test import SimpleTestCase

from .geometry import cumulative_miles, point_at
from .recommend import recommend, route_stats
from .risk import HIGH, LOW, MODERATE, NO_TRAVEL, SEVERE, classify
from .routes import build_checkpoints, pick_interval


class RiskTests(SimpleTestCase):
    def test_wind_bands(self):
        for wind, level in [(10, LOW), (25, MODERATE), (34, MODERATE), (35, HIGH), (44, HIGH), (45, SEVERE), (54, SEVERE), (55, NO_TRAVEL)]:
            self.assertEqual(classify(wind, 0, 0, 10_000)[0], level, wind)

    def test_rain_and_snow_bands(self):
        self.assertEqual(classify(0, 0.09, 0, 1)[0], LOW)
        self.assertEqual(classify(0, 0.10, 0, 1)[0], MODERATE)
        self.assertEqual(classify(0, 0.30, 0, 1)[0], HIGH)
        self.assertEqual(classify(0, 1.00, 0, 1)[0], SEVERE)
        self.assertEqual(classify(0, 1.01, 0, 1)[0], NO_TRAVEL)
        self.assertEqual(classify(0, 0, 3.0, 1)[0], SEVERE)
        self.assertEqual(classify(0, 0, 3.1, 1)[0], NO_TRAVEL)

    def test_worst_condition_wins(self):
        self.assertEqual(classify(10, 0.6, 0.6, 1)[0], SEVERE)

    def test_load_rules(self):
        self.assertEqual(classify(55, 0, 0, 1_000)[0], NO_TRAVEL)           # any load
        self.assertEqual(classify(50, 0, 0, 30_001)[0], NO_TRAVEL)          # 45-54 + >30k
        self.assertEqual(classify(50, 0, 0, 30_000)[0], SEVERE)             # boundary: not >30k
        self.assertEqual(classify(40, 0, 0, 40_001)[0], SEVERE)             # 35-44 + >40k
        self.assertEqual(classify(40, 0, 0, 40_000)[0], HIGH)
        self.assertEqual(classify(40, 0.6, 0, 50_000)[0], SEVERE)           # already Severe stays


def _route(rid, severe, high, avg, dur):
    cps = [{"level": 3, "segment_miles": severe}, {"level": 2, "segment_miles": high}, {"level": 0, "segment_miles": 100}]
    r = {"id": rid, "checkpoints": cps, "duration_s": dur}
    r["stats"] = route_stats(cps, dur)
    r["stats"]["avg_risk"] = avg
    return r


class RecommendTests(SimpleTestCase):
    def test_no_travel_beats_severe(self):
        # Route 1 has 5 No Travel miles and 0 Severe miles; Route 2 has 0 No Travel and 20 Severe miles.
        # Route 2 must be preferred because No Travel conditions are prohibited for trucks.
        cps1 = [{"level": 4, "segment_miles": 5}, {"level": 0, "segment_miles": 95}]
        cps2 = [{"level": 3, "segment_miles": 20}, {"level": 0, "segment_miles": 80}]
        r1 = {"id": 1, "checkpoints": cps1, "duration_s": 3600, "stats": route_stats(cps1, 3600)}
        r2 = {"id": 2, "checkpoints": cps2, "duration_s": 3600, "stats": route_stats(cps2, 3600)}
        best, rationale = recommend([r1, r2])
        self.assertEqual(best["id"], 2)
        self.assertIn("No Travel", rationale)

    def test_severe_beats_everything(self):
        a, b = _route(1, 10, 0, 0.1, 100), _route(2, 0, 50, 2.0, 9999)
        self.assertEqual(recommend([a, b])[0]["id"], 2)

    def test_high_then_avg_then_time(self):
        a, b = _route(1, 0, 40, 1.0, 100), _route(2, 0, 20, 1.5, 200)
        self.assertEqual(recommend([a, b])[0]["id"], 2)
        a, b = _route(1, 0, 20, 1.5, 100), _route(2, 0, 20, 1.0, 200)
        self.assertEqual(recommend([a, b])[0]["id"], 2)
        a, b = _route(1, 0, 20, 1.0, 300), _route(2, 0, 20, 1.0, 200)
        self.assertEqual(recommend([a, b])[0]["id"], 2)


class ApiViewsTests(SimpleTestCase):
    def test_health(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"status": "ok"})

    def test_geocode_empty(self):
        resp = self.client.get("/api/geocode?q=")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"results": []})

    def test_analyze_invalid_payload(self):
        resp = self.client.post("/api/analyze", data="bad-json", content_type="application/json")
        self.assertEqual(resp.status_code, 400)
        resp = self.client.post("/api/analyze", data="{}", content_type="application/json")
        self.assertEqual(resp.status_code, 400)


class CheckpointTests(SimpleTestCase):
    def test_interval_choice(self):
        self.assertEqual(pick_interval(100), 10)
        self.assertEqual(pick_interval(300), 25)
        self.assertEqual(pick_interval(900), 50)
        self.assertEqual(pick_interval(900, "10"), 10)

    def test_checkpoints_cover_route(self):
        coords = [(40.0, -100.0), (40.0, -99.0), (40.0, -98.0)]  # ~106 miles
        depart = datetime(2026, 1, 1, tzinfo=timezone.utc)
        cps = build_checkpoints(coords, 7200, depart, 25)
        total = cumulative_miles(coords)[-1]
        self.assertEqual(cps[0]["mile"], 0)
        self.assertAlmostEqual(cps[-1]["mile"], total, delta=0.1)
        self.assertAlmostEqual(sum(c["segment_miles"] for c in cps), total, places=3)
        self.assertEqual((cps[-1]["eta"] - depart).total_seconds(), 7200)

    def test_point_at(self):
        coords = [(0.0, 0.0), (0.0, 1.0)]
        cum = cumulative_miles(coords)
        lat, lon = point_at(coords, cum, cum[-1] / 2)
        self.assertAlmostEqual(lon, 0.5, places=3)
