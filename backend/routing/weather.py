"""Hourly weather from Open-Meteo (free, no key), fetched in batches and cached."""
import hashlib
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests
from django.conf import settings
from django.core.cache import cache

CHUNK = 40
FORECAST_DAYS_MAX = 15
CACHE_SECONDS = 15 * 60


class WeatherError(Exception):
    pass


def grid_key(lat, lon):
    return (round(lat, 2), round(lon, 2))


class WeatherData:
    def __init__(self):
        self.series = {}

    def at(self, lat, lon, when):
        s = self.series[grid_key(lat, lon)]
        idx = round((when - s["base"]).total_seconds() / 3600)
        idx = max(0, min(len(s["wind"]) - 1, idx))
        return {k: s[k][idx] for k in ("wind", "rain", "snow", "temp")}


def _parse(item):
    h = item["hourly"]
    base = datetime.fromisoformat(h["time"][0]).replace(tzinfo=timezone.utc)
    z = lambda arr: [v or 0.0 for v in arr]  # noqa: E731 - null -> 0
    return {
        "base": base,
        "wind": z(h["wind_speed_10m"]),
        "rain": [r + s for r, s in zip(z(h["rain"]), z(h["showers"]))],  # in/hr
        "snow": z(h["snowfall"]),  # in/hr
        "temp": z(h["temperature_2m"]),
    }


def _fetch_chunk(keys, start, end):
    h = hashlib.sha256(";".join(f"{a},{b}" for a, b in keys).encode()).hexdigest()[:24]
    ck = f"wx:{start}:{end}:{h}"
    cached = cache.get(ck)
    if cached:
        return cached
    params = {
        "latitude": ",".join(str(k[0]) for k in keys),
        "longitude": ",".join(str(k[1]) for k in keys),
        "hourly": "wind_speed_10m,rain,showers,snowfall,temperature_2m",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "temperature_unit": "fahrenheit",
        "timezone": "UTC",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
    }
    try:
        resp = requests.get(settings.WEATHER_URL, params=params, timeout=30,
                            headers={"User-Agent": settings.HTTP_USER_AGENT})
        data = resp.json()
        if resp.status_code != 200:
            raise WeatherError(data.get("reason", f"Weather API error {resp.status_code}"))
    except (requests.RequestException, ValueError) as exc:
        raise WeatherError(f"Weather service unavailable: {exc}") from exc
    items = data if isinstance(data, list) else [data]
    result = {k: _parse(item) for k, item in zip(keys, items)}
    cache.set(ck, result, CACHE_SECONDS)
    return result


def load_weather(points, window_start, window_end):
    """Fetch weather for all (lat, lon) points covering [window_start, window_end]."""
    today = datetime.now(timezone.utc).date()
    last_day = today + timedelta(days=FORECAST_DAYS_MAX)
    start = window_start.astimezone(timezone.utc).date()
    end = min(window_end.astimezone(timezone.utc).date(), last_day)
    if start > last_day:
        raise WeatherError(f"Forecasts are only available up to {FORECAST_DAYS_MAX} days ahead.")
    if start < today - timedelta(days=2):
        raise WeatherError("Departure date cannot be more than 2 days in the past.")
    start = min(start, end)

    keys = sorted({grid_key(*p) for p in points})
    chunks = [keys[i:i + CHUNK] for i in range(0, len(keys), CHUNK)]
    data = WeatherData()
    with ThreadPoolExecutor(max_workers=4) as pool:
        for part in pool.map(lambda c: _fetch_chunk(c, start, end), chunks):
            data.series.update(part)
    return data
