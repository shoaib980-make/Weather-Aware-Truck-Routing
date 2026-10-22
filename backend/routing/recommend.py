"""Per-route statistics and the recommendation ranking."""
from .risk import LEVELS

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
    weighted, total = 0.0, 0.0
    for cp in checkpoints:
        miles[LEVELS[cp["level"]]] += cp["segment_miles"]
        weighted += cp["level"] * cp["segment_miles"]
        total += cp["segment_miles"]
    return {
        "miles_by_level": {k: round(v, 1) for k, v in miles.items()},
        "no_travel_miles": round(miles["No Travel"]),
        "severe_miles": round(miles["Severe"]),
        "high_miles": round(miles["High"]),
        "avg_risk": round(weighted / total, 2) if total else 0.0,  # 0 (Low) .. 4 (No Travel)
        "max_level": max((cp["level"] for cp in checkpoints), default=0),
        "duration_s": round(duration_s),
    }


def _key(route):
    s = route["stats"]
    return tuple(s[k] for k, _ in CRITERIA)


def recommend(routes):
    """Return (best_route, rationale). Lexicographic: fewest No Travel, Severe, High miles,
    then lowest average risk, then shortest time. Miles are compared rounded to whole miles."""
    ranked = sorted(routes, key=_key)
    best = ranked[0]
    if len(ranked) == 1:
        return best, "Only one route was available."
    runner_up = ranked[1]
    for k, label in CRITERIA:
        b, r = best["stats"][k], runner_up["stats"][k]
        if b != r:
            if k == "duration_s":
                diff = (r - b) / 60
                return best, f"Equal weather risk to the alternatives; this route is {diff:.0f} min faster."
            return best, f"Lowest {label}: {b:g} vs {r:g} on the next best route."
    return best, "Routes are equivalent on all criteria."
