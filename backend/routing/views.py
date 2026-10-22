import json
from datetime import datetime, timezone
from functools import lru_cache

import requests
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .analysis import analyze_trip
from .routes import RoutingError
from .weather import WeatherError


def _error(msg, status=400):
    return JsonResponse({"error": msg}, status=status)


@require_GET
def health_view(request):
    return JsonResponse({"status": "ok"})


@lru_cache(maxsize=512)
def _geocode(q):
    # Try Nominatim first if configured
    try:
        resp = requests.get(
            settings.NOMINATIM_URL,
            params={"q": q, "format": "jsonv2", "limit": 5, "countrycodes": "us,ca,mx"},
            headers={"User-Agent": settings.HTTP_USER_AGENT},
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                return tuple(
                    {"label": r["display_name"], "lat": float(r["lat"]), "lon": float(r["lon"])} for r in data
                )
    except Exception:
        pass

    # Fallback to Open-Meteo Geocoding API (free, reliable, no key required)
    try:
        resp = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": q, "count": 5, "language": "en", "format": "json"},
            headers={"User-Agent": settings.HTTP_USER_AGENT},
            timeout=8,
        )
        if resp.status_code == 200:
            data = resp.json().get("results", [])
            out = []
            for r in data:
                parts = [r["name"]]
                if r.get("admin1"):
                    parts.append(r["admin1"])
                if r.get("country"):
                    parts.append(r["country"])
                out.append({"label": ", ".join(parts), "lat": float(r["latitude"]), "lon": float(r["longitude"])})
            return tuple(out)
    except Exception:
        pass

    return ()


@require_GET
def geocode_view(request):
    q = request.GET.get("q", "").strip()
    if len(q) < 2:
        return JsonResponse({"results": []})
    results = _geocode(q.lower())
    return JsonResponse({"results": list(results)})


def _place(raw, name):
    try:
        lat, lon = float(raw["lat"]), float(raw["lon"])
    except (KeyError, TypeError, ValueError):
        raise ValueError(f"{name} must include numeric lat and lon.")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError(f"{name} coordinates are out of range.")
    return {"lat": lat, "lon": lon, "label": raw.get("label", "")}


@csrf_exempt
@require_POST
def analyze_view(request):
    try:
        body = json.loads(request.body or b"{}")
        origin = _place(body.get("origin"), "Origin")
        destination = _place(body.get("destination"), "Destination")
        if abs(origin["lat"] - destination["lat"]) < 0.0001 and abs(origin["lon"] - destination["lon"]) < 0.0001:
            raise ValueError("Origin and Destination cannot be the same location.")
        weight = float(body["weight_lb"])
        if weight <= 0 or weight > 200_000:
            raise ValueError("Load weight must be between 1 and 200,000 lb.")
        depart = datetime.fromisoformat(str(body["departure"]).replace("Z", "+00:00"))
        if depart.tzinfo is None:
            depart = depart.replace(tzinfo=timezone.utc)
        depart = depart.astimezone(timezone.utc)
        interval = body.get("interval_miles", "auto")
        if interval not in ("auto", 10, 25, 50, "10", "25", "50"):
            raise ValueError("Checkpoint interval must be 'auto', 10, 25, or 50 miles.")
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        return _error(str(exc) if isinstance(exc, ValueError) else "Missing or invalid fields.")

    try:
        return JsonResponse(analyze_trip(origin, destination, depart, weight, interval))
    except (RoutingError, WeatherError) as exc:
        return _error(str(exc), 502)
