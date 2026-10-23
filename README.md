# SafeHaul RouteIQ — Weather-Aware Truck Routing

Production-grade logistics and transportation safety web application built with **React** on the frontend and **Django** on the backend. It evaluates three alternative driving routes against dynamic weather forecasts sampled at the exact projected time a truck will reach each checkpoint, ranking and recommending the safest corridor.

No API keys needed: routing = **OSRM**, weather = **Open-Meteo**, geocoding = **Nominatim** (with automatic fallback to Open-Meteo Geocoding).

---

## Key Capabilities

- **Corridor Analysis & Alternatives:** Queries OSRM for alternative routes; detours via waypoints if fewer than 3 alternatives exist. Near-duplicates (>90% overlap) are discarded.
- **Dynamic Checkpoint Weather Sampling:** Checkpoints sampled every 10, 25, or 50 miles (or Automatic based on total trip distance). Each checkpoint receives an ETA calculated from truck duration factors (`TRUCK_TIME_FACTOR` default 1.15).
- **Aerodynamic Crosswind & Rollover Physics:** Evaluates sustained 10 m wind speed, hourly precipitation rate, and snowfall rate against strict load-weight thresholds:
  - Universal No Travel at sustained wind $\ge$ 55 mph.
  - Wind 45–54 mph with gross load weight > 30,000 lb triggers **No Travel**.
  - Wind 35–44 mph with gross load weight > 40,000 lb triggers **Severe Risk**.
- **Lexicographic Recommendation Engine:** Evaluates candidate routes strictly by: fewest No Travel miles $\to$ fewest Severe miles $\to$ fewest High-risk miles $\to$ lowest corridor average risk $\to$ shortest travel time.
- **48-Hour Forecast Heatmap Corridor:** Pre-computed 49-hour risk matrix (0–48 h) enables zero-latency scrubbing, animated playback (1x, 2x, 4x), step controls, and instant jumps to departure or arrival.
- **Interactive Map Experience:** Vector pins for origin/destination, distinct alternative route styling with high-contrast active route casing, color-coded checkpoint markers, multi-basemap switching (Carto Light, Carto Dark, OpenStreetMap), and rich inspection popovers with Prev/Next navigation.
- **Side-by-Side Comparison Matrix:** Tabular comparison of Route 1 vs Route 2 vs Route 3 across distances, travel times, ETAs, risk mileage breakdowns, and checkpoint counts.
- **Full WCAG 2.2 AA Accessibility & Polish:** Keyboard accessible combobox geocoding with arrow key navigation, dark/light theme toggle, screen-reader live regions, visible focus rings, and high-contrast color tokens.

---

## Quickstart (Local Development)

### 1. Backend (Django)

```bash
cd backend
pip install -r requirements.txt
python manage.py test          # Run unit test suite (21 tests)
python manage.py runserver     # Starts API on http://127.0.0.1:8000
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm test                       # Run frontend unit tests (6 tests via node:test)
npm run dev                    # Starts Vite on http://localhost:5173 (proxies /api to Django)
```

To build for production:

```bash
cd frontend
npm run build                  # Builds optimized bundle to frontend/dist
```

---

## Deployment (Single Container Docker)

The multi-stage `Dockerfile` compiles the React frontend via Vite in Alpine Node, transfers the static build to Django's WhiteNoise directory, and serves the full application through Gunicorn:

```bash
docker build -t truck-routing .
docker run -p 8000:8000 truck-routing
```

### Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DJANGO_SECRET_KEY` | Production secret key | `dev-insecure-key-change-me` |
| `DJANGO_DEBUG` | Enable debug mode (`1` for dev, `0` for prod) | `0` in container |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames | `*` |
| `HTTP_USER_AGENT` | User agent header for external API requests | `WeatherAwareTruckRouting/1.0` |
| `OSRM_URL` | OSRM routing backend service URL | `https://router.project-osrm.org` |
| `WEATHER_URL` | Open-Meteo forecast endpoint | `https://api.open-meteo.com/v1/forecast` |
| `NOMINATIM_URL` | Nominatim search service | `https://nominatim.openstreetmap.org/search` |
| `TRUCK_TIME_FACTOR` | Multiplier for car duration to reflect truck travel | `1.15` (~15% slower than passenger cars) |
| `VITE_API_URL` | Custom backend API URL for standalone frontend builds | `""` (proxies to current host) |

---

## Architecture & Layout

```
Weather-Aware-Truck-Routing/
├── Dockerfile                  # Multi-stage production container (Node + Python Gunicorn)
├── README.md                   # System documentation
├── backend/
│   ├── config/                 # Django settings, WSGI, URLs
│   ├── routing/
│   │   ├── analysis.py         # Pipeline orchestrator: routes -> checkpoints -> weather -> risk -> recommendation
│   │   ├── geometry.py         # Route geometry thinning & polyline algorithms
│   │   ├── recommend.py        # Lexicographic ranking criteria & rationale generator
│   │   ├── risk.py             # Weather risk classification table & load weight physics
│   │   ├── routes.py           # OSRM integration, waypoint offset detours, checkpoint builder
│   │   ├── tests.py            # Unit test suite for risk, recommendation, and checkpoint spacing
│   │   ├── views.py            # API endpoints: /api/analyze, /api/geocode, /api/health
│   │   └── weather.py          # Parallel batched Open-Meteo hourly weather loader
│   └── frontend_dist/          # Production assets served by Django WhiteNoise
└── frontend/
    ├── package.json
    ├── vite.config.js          # Vite config with /api proxy to Django
    ├── src/
    │   ├── App.jsx             # Top-level workspace shell, state, responsive layout
    │   ├── api.js              # Robust API layer with health check, timeout & abort signals
    │   ├── risk.js             # Semantic color scales, formatting, and ETA calculation
    │   ├── styles.css          # Design system: tokens, light/dark themes, responsive layouts
    │   └── components/
    │       ├── Header.jsx       # Branding, corridor presets, theme switch, service health
    │       ├── Icons.jsx        # Lightweight SVG icon system for logistics & weather
    │       ├── MapView.jsx      # Leaflet map, vector markers, layer picker, route legend
    │       ├── HeatCorridor.jsx # Canvas-based dynamic weather heatmap overlay
    │       ├── HeatSlider.jsx   # 0–48h scrubbing timeline, playback, risk ribbon preview
    │       ├── PlaceInput.jsx   # Accessible combobox geocoder with keyboard navigation
    │       ├── RouteList.jsx    # Recommendation banner, route cards, matrix, checkpoint log
    │       ├── SafetyModal.jsx  # Federal safety rules and truck rollover matrix dialog
    │       └── TripForm.jsx     # Trip configuration form with swap button & weight physics
```

---

## API Contracts

### `POST /api/analyze`
**Request Payload:**
```json
{
  "origin": { "label": "Chicago, Illinois", "lat": 41.8781, "lon": -87.6298 },
  "destination": { "label": "Denver, Colorado", "lat": 39.7392, "lon": -104.9903 },
  "departure": "2026-10-22T14:00:00Z",
  "weight_lb": 42000,
  "interval_miles": "auto"
}
```

**Response Payload:**
- `forecast_start`: UTC ISO timestamp of departure rounded to hour.
- `recommended_id`: Integer ID of the safest route.
- `rationale`: Explanation of recommendation (e.g., "Equal weather risk to the alternatives; this route is 146 min faster.").
- `routes`: Array of route alternatives with `id`, `name`, `distance_mi`, `duration_s`, `interval_mi`, `stats`, `geometry`, and `checkpoints`.

### `GET /api/geocode?q={query}`
Returns array of candidate locations matching query with `label`, `lat`, and `lon`.

### `GET /api/health`
Returns `{"status": "ok"}` for container health probes and uptime monitoring.

---

## Assumptions & Boundaries

- Risk bands follow $[lower, upper)$; rain $> 1.00$ in/hr and snow $> 3.0$ in/hr are classified as No Travel (so exactly $1.00$ / $3.0$ is Severe).
- Routes with any **No Travel** miles are ranked strictly below routes without No Travel miles.
- Open-Meteo forecasts provide hourly sustained 10 m wind speeds and precipitation rates (nearest hour match without interpolation).
- Distance-based ETAs assume steady travel based on `TRUCK_TIME_FACTOR` without traffic congestion or mandated Hours of Service (HOS) driver rest breaks.
