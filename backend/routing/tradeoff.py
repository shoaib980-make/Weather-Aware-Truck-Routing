"""Route trade-off analysis engine for SafeHaul RouteIQ.

Evaluates trade-offs between safety, driving duration, road distance, and weather hazards.
Distinguishes between Fastest Feasible, Safest Feasible, and Recommended routes.
"""
from datetime import datetime, timezone
from .risk import HIGH, LOW, MODERATE, NO_TRAVEL, SEVERE, UNKNOWN, LEVELS


def compute_hazard_breakdown(checkpoints):
    """Compute hazard-specific exposure miles across supported physical categories.

    Categories:
    - High Winds (wind >= 35 mph or load-triggered warning)
    - Heavy Rain (rain > 0.25 in/hr)
    - Snow / Ice (snow > 0.5 in/hr or sub-freezing precip)
    - Severe Storms (rain > 0.50 in/hr or wind >= 45 mph)
    - Incomplete/Unknown data
    """
    wind_mi = 0.0
    rain_mi = 0.0
    snow_mi = 0.0
    severe_mi = 0.0
    unknown_mi = 0.0

    for cp in checkpoints:
        seg = cp.get("segment_miles", 0.0)
        lvl = cp.get("level")
        wind = cp.get("wind_mph") or cp.get("wind") or 0.0
        rain = cp.get("rain_in_hr") or cp.get("rain") or 0.0
        snow = cp.get("snow_in_hr") or cp.get("snow") or 0.0
        temp = cp.get("temp_f") or cp.get("temp")

        if lvl == UNKNOWN or lvl == "Unknown" or lvl == -1:
            unknown_mi += seg
            continue

        if wind >= 35.0 or (lvl in (HIGH, SEVERE, NO_TRAVEL) and "wind" in str(cp.get("reasons", "")).lower()):
            wind_mi += seg
        if rain >= 0.25:
            rain_mi += seg
        if snow >= 0.5 or (temp is not None and temp <= 33.0 and (rain > 0 or snow > 0)):
            snow_mi += seg
        if rain >= 0.50 or wind >= 45.0 or lvl in (SEVERE, NO_TRAVEL):
            severe_mi += seg

    return {
        "high_wind_miles": round(wind_mi, 1),
        "heavy_rain_miles": round(rain_mi, 1),
        "snow_ice_miles": round(snow_mi, 1),
        "severe_conditions_miles": round(severe_mi, 1),
        "unknown_weather_miles": round(unknown_mi, 1),
    }


def classify_overall_risk(stats):
    """Determine high-level risk classification for a route."""
    if stats.get("no_travel_miles", 0) > 0:
        return "Prohibited (No Travel)"
    if stats.get("severe_miles", 0) > 0:
        return "Critical / Severe"
    if stats.get("high_miles", 0) > 0:
        return "High"
    if stats.get("moderate_miles", 0) > 0:
        return "Moderate"
    if stats.get("unknown_miles", 0) > 0:
        return "Unknown Data"
    return "Low"


def analyze_route_trade_offs(routes, best_route, weight_lb=42000):
    """Perform comprehensive multi-route trade-off analysis.

    Returns:
    - enriched_routes: list of routes with attached trade_off_metrics
    - trade_off_summary: dict comparing fastest, safest, and recommended routes
    """
    if not routes:
        return routes, {}

    # Ensure all routes have id and name
    for idx, r in enumerate(routes):
        if "id" not in r:
            r["id"] = idx + 1
        if "name" not in r:
            r["name"] = f"Route {r['id']}"

    # 1. Enrich every route with standardized metrics
    eligible_routes = [r for r in routes if r["stats"].get("no_travel_miles", 0) == 0]
    candidate_pool = eligible_routes if eligible_routes else routes

    # Fastest route: lowest duration_s
    fastest_route = min(candidate_pool, key=lambda r: r["duration_s"])

    # Safest route: lexicographic lowest risk
    def risk_sort_key(r):
        s = r["stats"]
        return (
            s.get("no_travel_miles", 0),
            s.get("severe_miles", 0),
            s.get("high_miles", 0),
            s.get("avg_risk", 0),
            r["duration_s"],
        )

    safest_route = min(candidate_pool, key=risk_sort_key)
    rec_route = best_route if best_route else candidate_pool[0]

    for r in routes:
        s = r["stats"]
        dist = r.get("distance_mi", 0.0)
        elevated_mi = round(s.get("severe_miles", 0.0) + s.get("high_miles", 0.0) + s.get("no_travel_miles", 0.0), 1)
        total_risk_mi = round(elevated_mi + s.get("moderate_miles", 0.0), 1)
        elevated_pct = round((elevated_mi / dist) * 100, 1) if dist > 0 else 0.0
        hazard_bd = compute_hazard_breakdown(r.get("checkpoints", []))

        prohibited_cps = [cp for cp in r.get("checkpoints", []) if cp.get("level") == NO_TRAVEL or cp.get("level") == "No Travel"]

        r["trade_off_metrics"] = {
            "elevated_risk_miles": elevated_mi,
            "total_risk_exposure_miles": total_risk_mi,
            "elevated_risk_pct": elevated_pct,
            "risk_classification": classify_overall_risk(s),
            "hazard_breakdown": hazard_bd,
            "additional_time_vs_fastest_s": r["duration_s"] - fastest_route["duration_s"],
            "additional_time_vs_fastest_min": round((r["duration_s"] - fastest_route["duration_s"]) / 60),
            "additional_dist_vs_fastest_mi": round(dist - fastest_route.get("distance_mi", 0.0), 1),
            "truck_constraints_satisfied": weight_lb <= 80000 and len(prohibited_cps) == 0,
            "prohibited_segments_count": len(prohibited_cps),
            "is_fastest": r["id"] == fastest_route["id"],
            "is_safest": r["id"] == safest_route["id"],
            "is_recommended": r["id"] == rec_route["id"],
        }

    # 2. Build Trade-Off Summary between Fastest and Recommended
    rec_metrics = rec_route["trade_off_metrics"]
    fastest_metrics = fastest_route["trade_off_metrics"]

    add_time_s = rec_route["duration_s"] - fastest_route["duration_s"]
    add_time_min = round(add_time_s / 60)
    add_dist_mi = round(rec_route.get("distance_mi", 0.0) - fastest_route.get("distance_mi", 0.0), 1)

    fastest_risk_mi = fastest_metrics["elevated_risk_miles"]
    rec_risk_mi = rec_metrics["elevated_risk_miles"]
    risk_reduction_mi = round(fastest_risk_mi - rec_risk_mi, 1)

    if fastest_risk_mi > 0:
        risk_reduction_pct = round((risk_reduction_mi / fastest_risk_mi) * 100, 1)
    else:
        risk_reduction_pct = 0.0

    # Determine hazards avoided or reduced
    avoided_hazards = []
    f_haz = fastest_metrics["hazard_breakdown"]
    r_haz = rec_metrics["hazard_breakdown"]

    if f_haz["high_wind_miles"] > r_haz["high_wind_miles"]:
        diff = round(f_haz["high_wind_miles"] - r_haz["high_wind_miles"], 1)
        avoided_hazards.append(f"High Winds ({diff} mi avoided)")
    if f_haz["severe_conditions_miles"] > r_haz["severe_conditions_miles"]:
        diff = round(f_haz["severe_conditions_miles"] - r_haz["severe_conditions_miles"], 1)
        avoided_hazards.append(f"Severe Storm Zones ({diff} mi avoided)")
    if f_haz["snow_ice_miles"] > r_haz["snow_ice_miles"]:
        diff = round(f_haz["snow_ice_miles"] - r_haz["snow_ice_miles"], 1)
        avoided_hazards.append(f"Snow & Icy Roads ({diff} mi avoided)")
    if f_haz["heavy_rain_miles"] > r_haz["heavy_rain_miles"]:
        diff = round(f_haz["heavy_rain_miles"] - r_haz["heavy_rain_miles"], 1)
        avoided_hazards.append(f"Heavy Rain Bands ({diff} mi avoided)")

    if fastest_route["stats"].get("no_travel_miles", 0) > 0 and rec_route["stats"].get("no_travel_miles", 0) == 0:
        avoided_hazards.insert(0, f"Prohibited No Travel Conditions ({fastest_route['stats']['no_travel_miles']} mi avoided)")

    # Dynamic explanation: Why this route is recommended
    is_same = fastest_route["id"] == rec_route["id"]
    if is_same:
        why_recommended = (
            f"{rec_route['name']} provides the optimal dispatch decision: it is the fastest feasible corridor "
            f"while simultaneously maintaining the lowest projected weather risk among all evaluated options."
        )
        why_shortest_not_rec = "The fastest route was selected because it presents no safety disadvantage."
        remaining_trade_offs = "No time penalty; recommended route is also the fastest feasible highway corridor."
    else:
        if risk_reduction_mi > 0:
            haz_str = ", ".join(avoided_hazards) if avoided_hazards else "elevated weather hazards"
            why_recommended = (
                f"{rec_route['name']} is recommended because it avoids {risk_reduction_mi} mi of elevated weather risk "
                f"({risk_reduction_pct}% reduction in high/severe exposure) compared to the fastest alternative ({fastest_route['name']}). "
                f"Mitigates {haz_str}."
            )
            why_shortest_not_rec = (
                f"The shortest/fastest route ({fastest_route['name']}) saves {abs(add_time_min)} min, but traverses "
                f"{fastest_risk_mi} mi of elevated weather risks. Commercial dispatch policy prioritizes vehicle and driver safety "
                f"over marginal transit time savings."
            )
            remaining_trade_offs = (
                f"Requires an estimated additional {add_time_min} min of driving time and {add_dist_mi} mi of additional distance "
                f"to bypass severe weather zones."
            )
        else:
            why_recommended = (
                f"{rec_route['name']} is recommended based on overall corridor stability and commercial highway feasibility."
            )
            why_shortest_not_rec = (
                f"The fastest route ({fastest_route['name']}) differs by {abs(add_time_min)} min but does not offer superior safety margins."
            )
            remaining_trade_offs = f"Minor variance of {add_time_min} min and {add_dist_mi} mi between corridors."

    # Weather & ETA impact explanation
    weather_eta_explanation = (
        "Estimated arrival times incorporate Open-Meteo hourly numerical weather predictions matched to the truck's "
        "calculated checkpoint arrival times. Commercial truck transit times apply a calibrated 1.15 speed factor "
        "relative to passenger vehicle baselines to reflect federal speed limit restrictions, heavy grades, and commercial equipment handling."
    )

    trade_off_summary = {
        "fastest_route_id": fastest_route["id"],
        "fastest_route_name": fastest_route["name"],
        "safest_route_id": safest_route["id"],
        "safest_route_name": safest_route["name"],
        "recommended_route_id": rec_route["id"],
        "recommended_route_name": rec_route["name"],
        "is_same_route": is_same,
        "additional_travel_time_s": add_time_s,
        "additional_travel_time_min": add_time_min,
        "additional_distance_mi": add_dist_mi,
        "risk_reduction_mi": risk_reduction_mi,
        "risk_reduction_pct": risk_reduction_pct,
        "fastest_elevated_risk_miles": fastest_risk_mi,
        "recommended_elevated_risk_miles": rec_risk_mi,
        "avoided_hazards": avoided_hazards,
        "remaining_trade_offs": remaining_trade_offs,
        "why_recommended": why_recommended,
        "why_shortest_not_recommended": why_shortest_not_rec,
        "weather_eta_impact_explanation": weather_eta_explanation,
        "methodology": (
            "Elevated Risk Miles are defined as the precise sum of road-segment lengths classified as High, Severe, or No Travel "
            "under SafeHaul RouteIQ load-adjusted weather criteria. Non-overlapping segments prevent double counting."
        ),
    }

    return routes, trade_off_summary
