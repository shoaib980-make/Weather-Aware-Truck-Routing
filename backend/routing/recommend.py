"""Per-route statistics and the recommendation ranking."""
from .risk import LEVELS, UNKNOWN

# (stats key, label) in priority order; duration is the final tie-breaker.
CRITERIA = [
    ("no_travel_miles", "No Travel miles"),
    ("severe_miles", "Severe miles"),
    ("high_miles", "High miles"),
    ("avg_risk", "average risk"),
    ("duration_s", "travel time"),
]


def route_stats(checkpoints, duration_s):
    miles = {name: 0.0 for name in LEVELS}
    weighted, total_evaluated = 0.0, 0.0
    for cp in checkpoints:
        lvl_name = LEVELS[cp["level"]]
        miles[lvl_name] += cp["segment_miles"]
        if cp["level"] != UNKNOWN:
            weighted += cp["level"] * cp["segment_miles"]
            total_evaluated += cp["segment_miles"]

    unknown_miles = round(miles.get("Unknown", 0.0), 1)

    return {
        "miles_by_level": {k: round(v, 1) for k, v in miles.items()},
        "no_travel_miles": round(miles["No Travel"], 1),
        "severe_miles": round(miles["Severe"], 1),
        "high_miles": round(miles["High"], 1),
        "unknown_miles": unknown_miles,
        "has_unknown": unknown_miles > 0,
        "avg_risk": round(weighted / total_evaluated, 2) if total_evaluated else 0.0,  # 0 (Low) .. 4 (No Travel)
        "max_level": max((cp["level"] for cp in checkpoints), default=0),
        "duration_s": round(duration_s),
    }


def _key(route):
    s = route["stats"]
    return tuple(s[k] for k, _ in CRITERIA)


def recommend(routes):
    """Return (best_route, rationale).

    Lexicographic order:
    1. Fewest Severe miles (with No Travel miles strictly prioritized as zero-tolerance hard constraint)
    2. Fewest High miles
    3. Lowest average risk
    4. Shortest travel time

    If every available route has active No Travel conditions, travel is prohibited and NO route
    is labeled as safe.
    """
    if not routes:
        return None, "No routes available."

    ranked = sorted(routes, key=_key)
    best = ranked[0]

    # Hard safety constraint: If the best route still has No Travel miles, then ALL routes have No Travel miles.
    if best["stats"]["no_travel_miles"] > 0:
        return None, (
            "All available route options traverse severe weather zones with active "
            "No Travel conditions (winds ≥55 mph, winds 45–54 mph with heavy load, "
            "rain >1.00 in/hr, or snow >3.0 in/hr). Travel is prohibited on all routes."
        )

    if len(ranked) == 1:
        rationale = "Only one route option was available."
        if best["stats"].get("has_unknown"):
            rationale += f" Note: Route contains {best['stats']['unknown_miles']} miles with incomplete forecast coverage."
        return best, rationale

    runner_up = ranked[1]
    for k, label in CRITERIA:
        b, r = best["stats"][k], runner_up["stats"][k]
        if b != r:
            if k == "duration_s":
                diff = (r - b) / 60
                rationale = f"Equal weather risk to the alternatives; this route is {diff:.0f} min faster."
            else:
                rationale = f"Lowest {label}: {b:g} vs {r:g} on the next best route."

            if best["stats"].get("has_unknown"):
                rationale += f" Note: Route contains {best['stats']['unknown_miles']} miles with incomplete forecast coverage."
            return best, rationale

    rationale = "Routes are equivalent on all criteria."
    if best["stats"].get("has_unknown"):
        rationale += f" Note: Route contains {best['stats']['unknown_miles']} miles with incomplete forecast coverage."
    return best, rationale
