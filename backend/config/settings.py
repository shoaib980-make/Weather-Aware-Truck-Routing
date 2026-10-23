import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-key-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "corsheaders",
    "routing",
]
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
USE_TZ = True
TIME_ZONE = "UTC"
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# The built React app is copied here in production (see Dockerfile) and served at "/".
WHITENOISE_ROOT = BASE_DIR / "frontend_dist"
WHITENOISE_INDEX_FILE = True

CORS_ALLOW_ALL_ORIGINS = False

CORS_ALLOWED_ORIGINS = [
    "https://safehaul-routeiq-frontend.vercel.app",
]

CORS_URLS_REGEX = r"^/api/.*$"

# --- Third-party services (all free, no API keys) -------------------------------
OSRM_URL = os.environ.get("OSRM_URL", "https://router.project-osrm.org")
WEATHER_URL = os.environ.get("WEATHER_URL", "https://api.open-meteo.com/v1/forecast")
NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org/search")
HTTP_USER_AGENT = os.environ.get("HTTP_USER_AGENT", "WeatherAwareTruckRouting/1.0")
# OSRM's profile is for cars; trucks run slower. 1.15 => ~15% longer drive times.
TRUCK_TIME_FACTOR = float(os.environ.get("TRUCK_TIME_FACTOR", "1.15"))

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
