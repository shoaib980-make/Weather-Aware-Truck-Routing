"""Orchestrates: routes -> checkpoints -> weather -> risk -> recommendation."""
from datetime import timedelta

from .geometry import thin
from .recommend import recommend, route_stats
from .risk import LEVELS, classify
from .routes import build_checkpoints, fetch_routes, pick_interval
from .weather import load_weather

FORECAST_HOURS = 48
MAX_GEOMETRY_POINTS = 1500


def analyze_trip(origin, destination, depart, weight_lb, interval="auto"):
    routes = fetch_routes(origin, destination)
    for r in routes:
        r["interval_mi"] = pick_interval(r["distance_mi"], interval)
        r["checkpoints"] = build_checkpoints(r["coords"], r["duration_s"], depart, r["interval_mi"])

    longest_h = max(r["duration_s"] for r in routes) / 3600
    hours = max(FORECAST_HOURS, longest_h) + 2
    points = [(cp["lat"], cp["lon"]) for r in routes for cp in r["checkpoints"]]
    weather = load_weather(points, depart - timedelta(hours=1), depart + timedelta(hours=hours))

    depart_hour = depart.replace(minute=0, second=0, microsecond=0)
    for r in routes:
        for cp in r["checkpoints"]:
            w = weather.at(cp["lat"], cp["lon"], cp["eta"])  # weather when the truck arrives
            level, reasons = classify(w["wind"], w["rain"], w["snow"], weight_lb)
            cp.update(
                level=level,
                level_name=LEVELS[level],
                wind_mph=round(w["wind"], 1),
                rain_in_hr=round(w["rain"], 2),
                snow_in_hr=round(w["snow"], 2),
                temp_f=round(w["temp"]),
                reasons=reasons,
            )
            # Conditions at this spot for every forecast hour after departure (heatmap slider).
            forecast = []
            for h in range(FORECAST_HOURS + 1):
                f = weather.at(cp["lat"], cp["lon"], depart_hour + timedelta(hours=h))
                lvl, _ = classify(f["wind"], f["rain"], f["snow"], weight_lb)
                forecast.append([lvl, round(f["wind"]), round(f["rain"], 2), round(f["snow"], 2)])
            cp["forecast"] = forecast
        r["stats"] = route_stats(r["checkpoints"], r["duration_s"])

    best, rationale = recommend(routes)
    return {
        "forecast_start": depart_hour.isoformat(),
        "recommended_id": routes.index(best) + 1,
        "rationale": rationale,
        "routes": [_serialize(i + 1, r) for i, r in enumerate(routes)],
    }


def _serialize(rid, r):
    return {
        "id": rid,
        "name": f"Route {rid}",
        "distance_mi": round(r["distance_mi"], 1),
        "duration_s": round(r["duration_s"]),
        "interval_mi": r["interval_mi"],
        "stats": r["stats"],
        "geometry": [[round(a, 5), round(b, 5)] for a, b in thin(r["coords"], MAX_GEOMETRY_POINTS)],
        "checkpoints": [
            {**cp, "lat": round(cp["lat"], 5), "lon": round(cp["lon"], 5),
             "segment_miles": round(cp["segment_miles"], 1), "eta": cp["eta"].isoformat()}
            for cp in r["checkpoints"]
        ],
    }
