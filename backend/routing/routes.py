"""Route generation via OSRM, plus checkpoint placement along each route."""
import math
from datetime import timedelta

import requests
from django.conf import settings

from .geometry import cumulative_miles, overlap_fraction, point_at

M_PER_MI = 1609.344
SIMILAR_ROUTE_OVERLAP = 0.9


class RoutingError(Exception):
    pass


def _osrm(coord_str, alternatives):
    url = f"{settings.OSRM_URL}/route/v1/driving/{coord_str}"
    params = {
        "alternatives": "3" if alternatives else "false",
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
    }
    try:
        resp = requests.get(url, params=params, timeout=30, headers={"User-Agent": settings.HTTP_USER_AGENT})
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        raise RoutingError(f"Routing service unavailable: {exc}") from exc
    if data.get("code") != "Ok":
        raise RoutingError(data.get("message") or f"No route found ({data.get('code')})")
    return [
        {
            "coords": [(lat, lon) for lon, lat in r["geometry"]["coordinates"]],
            "distance_mi": r["distance"] / M_PER_MI,
            "duration_s": r["duration"] * settings.TRUCK_TIME_FACTOR,
        }
        for r in data["routes"]
    ]


def _is_new(candidate, existing):
    return all(overlap_fraction(candidate["coords"], e["coords"]) < SIMILAR_ROUTE_OVERLAP for e in existing)


def _via_points(base, offset_frac):
    """Two waypoints either side of the route midpoint, pushed perpendicular to its heading."""
    coords = base["coords"]
    cum = cumulative_miles(coords)
    total = cum[-1]
    mid = point_at(coords, cum, total / 2)
    a, b = point_at(coords, cum, total * 0.45), point_at(coords, cum, total * 0.55)
    cos_lat = math.cos(math.radians(mid[0]))
    dx, dy = (b[1] - a[1]) * cos_lat, b[0] - a[0]
    norm = math.hypot(dx, dy) or 1.0
    px, py = -dy / norm, dx / norm
    off_deg = max(5.0, total * offset_frac) / 69.17
    return [(mid[0] + sgn * py * off_deg, mid[1] + sgn * px * off_deg / cos_lat) for sgn in (1, -1)]


def fetch_routes(origin, dest, wanted=3):
    """Up to `wanted` distinct routes. OSRM alternatives first, then via-waypoint detours."""
    base_coords = f"{origin['lon']},{origin['lat']};{dest['lon']},{dest['lat']}"
    routes = []
    for r in _osrm(base_coords, alternatives=True):
        if _is_new(r, routes):
            routes.append(r)
    routes = routes[:wanted]

    for frac in (0.10, 0.20, 0.30):
        if len(routes) >= wanted:
            break
        for lat, lon in _via_points(routes[0], frac):
            if len(routes) >= wanted:
                break
            coord_str = f"{origin['lon']},{origin['lat']};{lon},{lat};{dest['lon']},{dest['lat']}"
            try:
                cand = _osrm(coord_str, alternatives=False)[0]
            except RoutingError:
                continue
            if cand["distance_mi"] <= routes[0]["distance_mi"] * 1.6 and _is_new(cand, routes):
                routes.append(cand)

    routes.sort(key=lambda r: r["duration_s"])  # route 1 is the fastest
    return routes


def pick_interval(distance_mi, requested="auto"):
    if requested in (10, 25, 50, "10", "25", "50"):
        return int(requested)
    if distance_mi <= 150:
        return 10
    if distance_mi <= 500:
        return 25
    return 50


def build_checkpoints(coords, duration_s, depart, interval):
    """Checkpoints every `interval` miles (plus the destination) with ETAs.

    `segment_miles` is the stretch of road each checkpoint represents (halfway to
    its neighbours), so per-level mileage sums to the route length.
    """
    if not coords:
        return []
    cum = cumulative_miles(coords)
    total = cum[-1]
    if total <= 0 or len(coords) < 2:
        return [
            {
                "mile": 0.0,
                "lat": coords[0][0],
                "lon": coords[0][1],
                "segment_miles": 0.0,
                "eta": depart,
            }
        ]
    marks, m = [], 0.0
    while m < total:
        marks.append(m)
        m += interval
    if len(marks) > 1 and total - marks[-1] < interval * 0.25:
        marks.pop()
    marks.append(total)

    out = []
    for i, mark in enumerate(marks):
        lo = 0.0 if i == 0 else (marks[i - 1] + mark) / 2
        hi = total if i == len(marks) - 1 else (mark + marks[i + 1]) / 2
        lat, lon = point_at(coords, cum, mark)
        out.append(
            {
                "mile": round(mark, 1),
                "lat": lat,
                "lon": lon,
                "segment_miles": hi - lo,
                "eta": depart + timedelta(seconds=duration_s * (mark / total if total else 0)),
            }
        )
    return out
