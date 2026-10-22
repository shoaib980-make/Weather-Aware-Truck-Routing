"""Weather risk classification.

Thresholds follow the assessment table. Boundaries are treated as [lower, upper)
except where the table says ">" for the No Travel column (rain > 1.00, snow > 3.0),
in which case the upper bound of Severe is inclusive. Wind >= 55 is No Travel.
"""

LEVELS = ["Low", "Moderate", "High", "Severe", "No Travel"]
LOW, MODERATE, HIGH, SEVERE, NO_TRAVEL = range(5)

# (upper bounds of Low/Moderate/High/Severe, is the Severe upper bound inclusive?)
WIND = ((25, 35, 45, 55), False)
RAIN = ((0.10, 0.25, 0.50, 1.00), True)
SNOW = ((0.5, 1.0, 2.0, 3.0), True)


def _bucket(value, spec):
    bounds, last_inclusive = spec
    for i, bound in enumerate(bounds):
        if value < bound or (i == 3 and last_inclusive and value == bound):
            return i
    return NO_TRAVEL


def classify(wind_mph, rain_in_hr, snow_in_hr, weight_lb):
    """Return (level, reasons) for one checkpoint, applying the load rules."""
    wind_level = _bucket(wind_mph, WIND)
    rain_level = _bucket(rain_in_hr, RAIN)
    snow_level = _bucket(snow_in_hr, SNOW)
    level = max(wind_level, rain_level, snow_level)
    reasons = []
    for name, lvl, val, unit in (
        ("Wind", wind_level, wind_mph, "mph"),
        ("Rain", rain_level, rain_in_hr, "in/hr"),
        ("Snow", snow_level, snow_in_hr, "in/hr"),
    ):
        if lvl >= MODERATE:
            reasons.append(f"{name} {val:g} {unit}: {LEVELS[lvl]}")

    # Load rules (heavier loads are more exposed to crosswind).
    if wind_mph >= 55:
        level = NO_TRAVEL
    elif wind_mph >= 45 and weight_lb > 30_000:
        level = NO_TRAVEL
        reasons.append(f"Wind {wind_mph:g} mph with load > 30,000 lb: No Travel")
    elif wind_mph >= 35 and weight_lb > 40_000 and level < SEVERE:
        level = SEVERE
        reasons.append(f"Wind {wind_mph:g} mph with load > 40,000 lb: Severe")
    return level, reasons
