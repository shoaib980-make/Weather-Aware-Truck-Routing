"""Orchestrates: routes -> checkpoints -> weather -> risk -> recommendation."""
from datetime import timedelta

from .geometry import thin
from .recommend import extract_influential_checkpoints, recommend, route_stats
from .risk import LEVELS, classify
from .routes import RoutingError, build_checkpoints, fetch_routes, pick_interval
from .weather import load_weather

FORECAST_HOURS = 48
MAX_GEOMETRY_POINTS = 1500


def analyze_trip(origin, destination, depart, weight_lb, interval="auto", force_refresh=False):
    routes = fetch_routes(origin, destination)
    if not routes:
        raise RoutingError("No driving routes could be found between the specified locations.")

    for r in routes:
        r["interval_mi"] = pick_interval(r["distance_mi"], interval)
        r["checkpoints"] = build_checkpoints(r["coords"], r["duration_s"], depart, r["interval_mi"])

    longest_h = max(r["duration_s"] for r in routes) / 3600
    hours = max(FORECAST_HOURS, longest_h) + 2
    points = [(cp["lat"], cp["lon"]) for r in routes for cp in r["checkpoints"]]
    weather = load_weather(points, depart - timedelta(hours=1), depart + timedelta(hours=hours), force_refresh=force_refresh)

    depart_hour = depart.replace(minute=0, second=0, microsecond=0)
    for r in routes:
        for cp in r["checkpoints"]:
            w = weather.at(cp["lat"], cp["lon"], cp["eta"])  # weather when the truck arrives
            level, reasons = classify(w["wind"], w["rain"], w["snow"], weight_lb)
            cp.update(
                level=level,
                level_name=LEVELS[level],
                wind_mph=round(w["wind"], 1) if w["wind"] is not None else None,
                rain_in_hr=round(w["rain"], 2) if w["rain"] is not None else None,
                snow_in_hr=round(w["snow"], 2) if w["snow"] is not None else None,
                temp_f=round(w["temp"]) if w["temp"] is not None else None,
                reasons=reasons,
            )
            # Conditions at this spot for every forecast hour after departure (heatmap slider).
            forecast = []
            for h in range(FORECAST_HOURS + 1):
                f = weather.at(cp["lat"], cp["lon"], depart_hour + timedelta(hours=h))
                lvl, _ = classify(f["wind"], f["rain"], f["snow"], weight_lb)
                forecast.append([
                    lvl,
                    round(f["wind"]) if f["wind"] is not None else None,
                    round(f["rain"], 2) if f["rain"] is not None else None,
                    round(f["snow"], 2) if f["snow"] is not None else None,
                ])
            cp["forecast"] = forecast
        r["stats"] = route_stats(r["checkpoints"], r["duration_s"])
        r["influential_checkpoints"] = extract_influential_checkpoints(r["checkpoints"])

    best, rationale, evaluations = recommend(routes, return_evaluations=True)
    all_prohibited = best is None
    recommended_id = routes.index(best) + 1 if best is not None else None

    route_notice = None
    if len(routes) < 3:
        route_notice = f"Only {len(routes)} distinct route option(s) could be identified by the road network for this corridor."

    has_unknown = any(r["stats"].get("has_unknown") for r in routes)

    provenance_warnings = list(weather.metadata.get("warnings", []))
    if has_unknown:
        provenance_warnings.append("Incomplete weather data detected along one or more segments; flagged as Unknown risk.")

    data_provenance = {
        **weather.metadata,
        "forecast_valid_start": depart_hour.isoformat(),
        "forecast_valid_end": (depart + timedelta(hours=longest_h)).isoformat(),
        "has_unknown_data": has_unknown,
        "warnings": provenance_warnings,
        "confidence": (
            "Caution (Missing Observations)" if has_unknown
            else "Moderate (Extended Outlook)" if longest_h > 168
            else "High (Direct Hourly NWP)"
        ),
    }

    from .tradeoff import analyze_route_trade_offs

    routes, trade_off_summary = analyze_route_trade_offs(routes, best, weight_lb=weight_lb)

    return {
        "forecast_start": depart_hour.isoformat(),
        "recommended_id": recommended_id,
        "all_prohibited": all_prohibited,
        "route_notice": route_notice,
        "rationale": rationale,
        "trade_off": trade_off_summary,
        "data_provenance": data_provenance,
        "routes": [_serialize(i + 1, r, evaluations.get(i + 1)) for i, r in enumerate(routes)],
    }


def _serialize(rid, r, evaluation=None):
    return {
        "id": rid,
        "name": f"Route {rid}",
        "distance_mi": round(r["distance_mi"], 1),
        "duration_s": round(r["duration_s"]),
        "interval_mi": r["interval_mi"],
        "stats": r["stats"],
        "evaluation": evaluation,
        "trade_off_metrics": r.get("trade_off_metrics", {}),
        "hazard_breakdown": r.get("trade_off_metrics", {}).get("hazard_breakdown", {}),
        "influential_checkpoints": r.get("influential_checkpoints", []),
        "geometry": [[round(a, 5), round(b, 5)] for a, b in thin(r["coords"], MAX_GEOMETRY_POINTS)],
        "checkpoints": [
            {**cp, "lat": round(cp["lat"], 5), "lon": round(cp["lon"], 5),
             "segment_miles": round(cp["segment_miles"], 1), "eta": cp["eta"].isoformat()}
            for cp in r["checkpoints"]
        ],
    }
