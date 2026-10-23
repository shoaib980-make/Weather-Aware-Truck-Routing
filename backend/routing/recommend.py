"""Per-route statistics and the explainable recommendation ranking."""
from .risk import HIGH, LEVELS, LOW, MODERATE, NO_TRAVEL, SEVERE, UNKNOWN

# (stats key, label) in priority order; duration is the final tie-breaker.
CRITERIA = [
    ("no_travel_miles", "No Travel miles"),
    ("severe_miles", "Severe miles"),
    ("high_miles", "High miles"),
    ("avg_risk", "average risk"),
    ("duration_s", "travel time"),
]


def _normalize_level(lvl):
    if isinstance(lvl, int):
        if 0 <= lvl < len(LEVELS):
            return lvl, LEVELS[lvl]
        return UNKNOWN, "Unknown"
    if isinstance(lvl, str):
        if lvl in LEVELS:
            return LEVELS.index(lvl), lvl
        lvl_title = lvl.title()
        if lvl_title in LEVELS:
            return LEVELS.index(lvl_title), lvl_title
    return UNKNOWN, "Unknown"


def route_stats(checkpoints, duration_s):
    miles = {name: 0.0 for name in LEVELS}
    weighted, total_evaluated = 0.0, 0.0
    for cp in checkpoints:
        lvl_int, lvl_name = _normalize_level(cp.get("level"))
        seg = cp.get("segment_miles", 0.0)
        miles[lvl_name] += seg
        if lvl_int != UNKNOWN:
            weighted += lvl_int * seg
            total_evaluated += seg

    unknown_miles = round(miles.get("Unknown", 0.0), 1)
    total_route_miles = round(sum(cp.get("segment_miles", 0.0) for cp in checkpoints), 1)
    audited_miles_sum = round(sum(miles.values()), 1)

    return {
        "miles_by_level": {k: round(v, 1) for k, v in miles.items()},
        "no_travel_miles": round(miles["No Travel"], 1),
        "severe_miles": round(miles["Severe"], 1),
        "high_miles": round(miles["High"], 1),
        "moderate_miles": round(miles["Moderate"], 1),
        "low_miles": round(miles["Low"], 1),
        "unknown_miles": unknown_miles,
        "has_unknown": unknown_miles > 0,
        "total_route_miles": total_route_miles,
        "audited_miles_sum": audited_miles_sum,
        "is_audited_consistent": abs(total_route_miles - audited_miles_sum) < 0.2,
        "avg_risk": round(weighted / total_evaluated, 2) if total_evaluated else 0.0,  # 0 (Low) .. 4 (No Travel)
        "max_level": max((_normalize_level(cp.get("level"))[0] for cp in checkpoints), default=0),
        "duration_s": round(duration_s),
    }


def extract_influential_checkpoints(checkpoints, max_count=4):
    """Identify checkpoints with severe, high, no travel, unknown or load-triggered risks."""
    hazards = []
    for cp in checkpoints:
        lvl_int, lvl_name = _normalize_level(cp.get("level"))
        has_custom_reasons = bool(cp.get("reasons")) or (bool(cp.get("risk_reason")) and cp.get("risk_reason") not in ("Favorable", "Safe", "Safe conditions"))
        if lvl_int >= HIGH or lvl_int == UNKNOWN or (lvl_int >= MODERATE and has_custom_reasons):
            wind = cp.get("wind_mph") if cp.get("wind_mph") is not None else cp.get("wind")
            rain = cp.get("rain_in_hr") if cp.get("rain_in_hr") is not None else cp.get("rain")
            snow = cp.get("snow_in_hr") if cp.get("snow_in_hr") is not None else cp.get("snow")
            temp = cp.get("temp_f") if cp.get("temp_f") is not None else cp.get("temp")
            reasons = cp.get("reasons") or ([cp["risk_reason"]] if cp.get("risk_reason") else [])
            hazards.append({
                "mile": cp.get("mile", cp.get("distance_from_origin_mi", 0.0)),
                "eta": cp["eta"].isoformat() if hasattr(cp.get("eta"), "isoformat") else str(cp.get("eta", "")),
                "level": lvl_int,
                "level_name": lvl_name,
                "wind_mph": wind,
                "rain_in_hr": rain,
                "snow_in_hr": snow,
                "temp_f": temp,
                "reasons": reasons,
                "summary": "; ".join(reasons) or f"{lvl_name} weather conditions",
            })
    # Sort hazards by severity descending, then by mile ascending
    hazards.sort(key=lambda h: (-h["level"] if h["level"] != UNKNOWN else -99, h["mile"]))
    return hazards[:max_count]


def _key(route):
    s = route["stats"]
    return tuple(s[k] for k, _ in CRITERIA)


def recommend(routes, return_evaluations=False):
    """Return (best_route, rationale) or (best_route, rationale, evaluations).

    Lexicographic order:
    1. Fewest Severe miles (with No Travel miles strictly prioritized as zero-tolerance hard constraint)
    2. Fewest High miles
    3. Lowest average risk
    4. Shortest travel time

    Produces transparent rejection reasons and delta comparisons for all route alternatives.
    """
    if not routes:
        if return_evaluations:
            return None, "No routes available.", {}
        return None, "No routes available."

    ranked = sorted(routes, key=_key)
    best = ranked[0]
    all_prohibited = best["stats"]["no_travel_miles"] > 0

    evaluations = {}

    if all_prohibited:
        rationale = (
            "All available route options traverse severe weather zones with active "
            "No Travel conditions (winds ≥55 mph, winds 45–54 mph with heavy load, "
            "rain >1.00 in/hr, or snow >3.0 in/hr). Travel is prohibited on all routes."
        )
        if return_evaluations:
            for idx, r in enumerate(routes):
                rid = r.get("id", idx + 1)
                evaluations[rid] = {
                    "rank": ranked.index(r) + 1,
                    "is_recommended": False,
                    "status": "prohibited",
                    "verdict": "Prohibited — Violates No Travel safety threshold.",
                    "rejection_reason": f"Disqualified: Contains {r['stats']['no_travel_miles']} mi of prohibited No Travel conditions.",
                    "duration_diff_s": r["duration_s"] - best["duration_s"],
                    "severe_diff_mi": round(r["stats"]["severe_miles"] - best["stats"]["severe_miles"], 1),
                    "high_diff_mi": round(r["stats"]["high_miles"] - best["stats"]["high_miles"], 1),
                    "avg_risk_diff": round(r["stats"]["avg_risk"] - best["stats"]["avg_risk"], 2),
                }
            return None, rationale, evaluations
        return None, rationale

    # Compute overall rationale
    if len(ranked) == 1:
        rationale = "Only one route option was available."
        if best["stats"].get("has_unknown"):
            rationale += f" Note: Route contains {best['stats']['unknown_miles']} miles with incomplete forecast coverage."
    else:
        runner_up = ranked[1]
        for k, label in CRITERIA:
            b, r = best["stats"][k], runner_up["stats"][k]
            if b != r:
                if k == "duration_s":
                    diff = (r - b) / 60
                    rationale = f"Equal weather risk to the alternatives; this route is {diff:.0f} min faster."
                else:
                    rationale = f"Lowest {label}: {b:g} vs {r:g} on the next best route."
                break
        else:
            rationale = "Routes are equivalent on all criteria."

        if best["stats"].get("has_unknown"):
            rationale += f" Note: Route contains {best['stats']['unknown_miles']} miles with incomplete forecast coverage."

    if not return_evaluations:
        return best, rationale

    # Generate transparent explanations for each alternative
    best_name = best.get("name", f"Route {routes.index(best) + 1}")
    for idx, r in enumerate(routes):
        rid = r.get("id", idx + 1)
        r_name = r.get("name", f"Route {rid}")
        is_best = (r is best)
        rank = ranked.index(r) + 1

        if is_best:
            rejection_reason = None
            verdict = "Recommended — Optimal balance of weather safety and commercial travel time."
        else:
            if r["stats"]["no_travel_miles"] > 0:
                rejection_reason = f"Disqualified: Contains {r['stats']['no_travel_miles']} mi of prohibited No Travel conditions."
                verdict = "Rejected — Prohibited No Travel segments."
            elif r["stats"]["severe_miles"] > best["stats"]["severe_miles"]:
                diff = round(r["stats"]["severe_miles"] - best["stats"]["severe_miles"], 1)
                rejection_reason = f"Ranked lower due to {r['stats']['severe_miles']} mi of Severe risk conditions (+{diff} mi more Severe exposure than {best_name})."
                verdict = f"Rejected — Excess Severe weather exposure (+{diff} mi)."
            elif r["stats"]["high_miles"] > best["stats"]["high_miles"]:
                diff = round(r["stats"]["high_miles"] - best["stats"]["high_miles"], 1)
                rejection_reason = f"Equal Severe risk, but contains {r['stats']['high_miles']} mi of High risk conditions (+{diff} mi more High risk exposure than {best_name})."
                verdict = f"Rejected — Excess High weather risk (+{diff} mi)."
            elif r["stats"]["avg_risk"] > best["stats"]["avg_risk"]:
                diff = round(r["stats"]["avg_risk"] - best["stats"]["avg_risk"], 2)
                rejection_reason = f"Higher integrated corridor average risk ({r['stats']['avg_risk']:.2f} vs {best['stats']['avg_risk']:.2f})."
                verdict = f"Rejected — Higher corridor risk average (+{diff:.2f})."
            elif r["duration_s"] > best["duration_s"]:
                diff_min = round((r["duration_s"] - best["duration_s"]) / 60)
                rejection_reason = f"Equal safety metrics to {best_name}, but adds {diff_min} min of driving time."
                verdict = f"Alternative — Slower driving time (+{diff_min} min)."
            else:
                rejection_reason = "Equivalent on all safety and duration metrics."
                verdict = "Alternative — Equivalent safety score."

        evaluations[rid] = {
            "rank": rank,
            "is_recommended": is_best,
            "status": "recommended" if is_best else ("prohibited" if r["stats"]["no_travel_miles"] > 0 else "alternative"),
            "verdict": verdict,
            "rejection_reason": rejection_reason,
            "duration_diff_s": r["duration_s"] - best["duration_s"],
            "severe_diff_mi": round(r["stats"]["severe_miles"] - best["stats"]["severe_miles"], 1),
            "high_diff_mi": round(r["stats"]["high_miles"] - best["stats"]["high_miles"], 1),
            "avg_risk_diff": round(r["stats"]["avg_risk"] - best["stats"]["avg_risk"], 2),
        }

    return best, rationale, evaluations
