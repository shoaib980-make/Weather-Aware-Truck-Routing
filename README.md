# SafeHaul RouteIQ — Weather-Aware Truck Routing

Production-grade logistics and transportation safety web application built with **React** on the frontend and **Django** on the backend. It evaluates three alternative driving routes against dynamic weather forecasts sampled at the exact projected time a truck will reach each checkpoint, ranking and recommending the safest corridor.

No API keys needed: routing = **OSRM**, weather = **Open-Meteo**, geocoding = **Nominatim** (with automatic fallback to Open-Meteo Geocoding).

---

## Deliverables & Live Links

- **Hosted Web Application:** [https://safehaul-routeiq-frontend.vercel.app](https://safehaul-routeiq-frontend.vercel.app)
- **GitHub Repository:** [https://github.com/shoaib980-make/Weather-Aware-Truck-Routing](https://github.com/shoaib980-make/Weather-Aware-Truck-Routing)
- **5–10 Min Loom Walkthrough:** [https://www.loom.com/share/your-walkthrough-id-here](https://www.loom.com/share/your-walkthrough-id-here) *(Please replace with your recording URL)*

---

## Weather Risk Thresholds & Load Physics

The application classifies weather hazards using half-open intervals $[lower, upper)$, with rain and snow upper boundaries of Severe being inclusive:

| Hazard Condition | Low (0) | Moderate (1) | High (2) | Severe (3) | No Travel (4) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Sustained Wind** | < 25 mph | 25–34 mph | 35–44 mph | 45–54 mph | $\ge$ 55 mph |
| **Hourly Rain** | < 0.10 in/hr | 0.10–0.25 in/hr | 0.25–0.50 in/hr | 0.50–1.00 in/hr | > 1.00 in/hr |
| **Hourly Snow** | < 0.5 in/hr | 0.5–1.0 in/hr | 1.0–2.0 in/hr | 2.0–3.0 in/hr | > 3.0 in/hr |

### Load-Dependent Aerodynamic Rollover Rules
- **Wind $\ge$ 55 mph:** Universal **No Travel** regardless of truck weight.
- **Wind 45–54 mph with Gross Weight > 30,000 lb:** Upgrades to **No Travel** (rollover hazard).
- **Wind 35–44 mph with Gross Weight > 40,000 lb:** Upgrades to **Severe Risk**.
- **Missing / Incomplete Forecasts:** Classified as **Unknown Risk** (tinted slate gray, never assumed safe).

### Lexicographic Recommendation Priority
Candidate routes are evaluated strictly in the following priority:
1. **No Travel Miles (Zero-Tolerance Hard Constraint):** Routes with active No Travel conditions are disqualified. If all routes are prohibited, the application halts travel.
2. **Fewest Severe Risk Miles**
3. **Fewest High Risk Miles**
4. **Lowest Corridor Average Risk**
5. **Shortest Commercial Travel Time** (final tie-breaker)

---

## Key Capabilities

- **Corridor Analysis & Alternatives:** Queries OSRM for alternative routes; detours via waypoints if fewer than 3 alternatives exist. Near-duplicates (>90% overlap) are discarded.
- **Dynamic Checkpoint Weather Sampling:** Checkpoints sampled every 10, 25, or 50 miles (or Automatic based on total trip distance). Each checkpoint receives an ETA calculated from truck duration factors (`TRUCK_TIME_FACTOR` default 1.15).
- **Auditable Risk Mileage without Double-Counting:** Route distance is allocated across non-overlapping segment-midpoint Voronoi polygons, ensuring $\sum \text{Miles}_{\text{Level}} \equiv \text{Total Route Miles}$.
- **48-Hour Forecast Heatmap Corridor:** Pre-computed 49-hour risk matrix (0–48 h) enables zero-latency scrubbing, animated playback (1x, 2x, 4x), step controls, and instant jumps to departure or arrival.
- **Interactive Map Experience:** Vector pins for origin/destination, distinct alternative route styling with high-contrast active route casing, color-coded checkpoint markers, multi-basemap switching (Carto Light, Carto Dark, OpenStreetMap), and rich inspection popovers with Prev/Next navigation.
- **Side-by-Side Comparison Matrix:** Tabular comparison of Route 1 vs Route 2 vs Route 3 across distances, travel times, ETAs, risk mileage breakdowns, and checkpoint counts.
- **Professional PDF Route Reports:** Downloadable dispatch report (`Origin_to_Destination_Route_Report.pdf`) featuring authentic route-based names, official PDF metadata, custom vector header emblems, safety matrices, and checkpoint logs.
- **Trip History & Re-analysis:** Save, review, and re-run past commercial trips against fresh live weather forecasts via `/api/trips/`.
- **Mobile-First Responsive Interface:** Dedicated `.map-controls-dock` preventing UI overlap, smart asymmetrical map bounds padding, collapsible 48-hour timeline slider, and full touch-target compliance.
- **Full WCAG 2.2 AA Accessibility:** Keyboard accessible combobox geocoding with arrow key navigation, dark/light theme toggle, screen-reader live regions, visible focus rings, and high-contrast color tokens.

---

## Quickstart (Local Development)

### 1. Backend (Django)

```bash
cd backend
pip install -r requirements.txt
python manage.py test routing   # Run unit test suite (27 tests passing)
python test_integration.py     # Live end-to-end corridor integration & API test
python verify_branding.py      # Title and favicon endpoint verification
python manage.py runserver     # Starts API on http://127.0.0.1:8000
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm test                       # Run frontend unit tests (20 tests passing via node:test)
npm run dev                    # Starts Vite on http://localhost:5173 (proxies /api to Django)
```

To build for production:

```bash
cd frontend
npm run build                  # Builds optimized bundle to frontend/dist (398 kB JS, 80 kB CSS)
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
├── .env.example                # Configuration template with placeholders
├── README.md                   # System documentation & evaluation deliverables
├── backend/
│   ├── config/                 # Django settings, WSGI, URLs
│   ├── routing/
│   │   ├── analysis.py         # Pipeline orchestrator: routes -> checkpoints -> weather -> risk -> recommendation
│   │   ├── geometry.py         # Route geometry thinning (Douglas-Peucker) & polyline math
│   │   ├── recommend.py        # Lexicographic ranking criteria, influential hazards & rationale generator
│   │   ├── report_pdf.py       # Professional dispatch PDF generator with dynamic route filename & vector emblem
│   │   ├── risk.py             # Weather risk classification table & load weight physics
│   │   ├── routes.py           # OSRM integration, waypoint offset detours, checkpoint builder
│   │   ├── tests.py            # Unit test suite for risk, recommendation, and checkpoint spacing (27 tests)
│   │   ├── trip_views.py       # Trip history CRUD and re-analysis endpoints (/api/trips)
│   │   ├── views.py            # Core API endpoints: /api/analyze, /api/geocode, /api/health
│   │   └── weather.py          # Parallel batched Open-Meteo hourly weather loader with cache bypass
│   ├── test_integration.py     # Live API integration & server-side validation smoke test
│   ├── verify_branding.py      # Tab title, favicon endpoints, and WhiteNoise verification
│   └── frontend_dist/          # Production assets served by Django WhiteNoise
└── frontend/
    ├── package.json
    ├── vite.config.js          # Vite config with /api proxy to Django
    ├── public/
    │   ├── favicon.svg         # High-resolution vector truck + safety shield favicon
    │   └── favicon.ico         # Multi-resolution binary ICO icon fallback
    ├── src/
    │   ├── App.jsx             # Top-level workspace shell, state, responsive layout
    │   ├── api.js              # Robust API layer with health check, timeout & abort signals
    │   ├── risk.js             # Semantic color scales, formatting, and ETA calculation
    │   ├── risk.test.js        # Frontend unit tests for risk math and formatters
    │   ├── features.test.js    # Unit tests for timeline, auditable miles, and layer hierarchy (20 tests)
    │   ├── styles.css          # Design system: tokens, light/dark themes, responsive layouts
    │   └── components/
    │       ├── Header.jsx       # Branding, corridor presets, theme switch, service health
    │       ├── Icons.jsx        # Lightweight SVG icon system for logistics & weather
    │       ├── MapView.jsx      # Leaflet map, vector markers, layer picker, route legend, Leaflet panes
    │       ├── HeatCorridor.jsx # Canvas-based dynamic weather heatmap overlay
    │       ├── HeatSlider.jsx   # 0–48h scrubbing timeline, playback, risk ribbon preview, collapsible mobile mode
    │       ├── PlaceInput.jsx   # Accessible combobox geocoder with keyboard navigation
    │       ├── RouteList.jsx    # Recommendation banner, route cards, matrix, checkpoint log
    │       ├── RouteRiskTimeline.jsx # Distance-proportional horizontal risk timeline with ticks
    │       ├── DataProvenanceCard.jsx # Forecast freshness, NWP model provenance, cache bypass
    │       ├── SafetyModal.jsx  # Federal safety rules and truck rollover matrix dialog
    │       ├── SavedTripsModal.jsx # Saved trip history and re-analysis dialog
    │       └── TripForm.jsx     # Trip configuration form with swap button & weight physics
```

---

## Three-Feature Architecture & Specification

### 1. Explainable Route Recommendation & Auditable Risk Mileage
- **Auditable Risk Mileage without Double-Counting**: Every route computes non-overlapping miles across all 6 risk levels (`Severe`, `High`, `Moderate`, `Low`, `No Travel`, `Unknown`). Verified mathematically with `audited_miles_sum` and `is_audited_consistent` (abs difference $< 0.2$ mi).
- **Unknown Weather is Never Treated as Low Risk**: Missing, partial, or out-of-bounds weather observations are explicitly classified as `Unknown` risk (tinted slate gray), with warnings surfaced in dispatch rationales.
- **Transparent Multi-Route Evaluation & Rejection Rationale**: Non-recommended routes explicitly state *why* they were disqualified or deprioritized (e.g. `Disqualified: Contains 14.2 mi of prohibited No Travel conditions` or `+45 min travel time vs recommended route with equivalent weather risk`).
- **Influential Hazard Checkpoints**: Checkpoints triggering high wind, excessive precipitation, or load-adjusted rollover thresholds are surfaced as interactive hazard chips.

### 2. Weather Forecast Confidence & Data Freshness
- **Provenance Tracking**: Captures Open-Meteo NWP provider metadata, live retrieval timestamp (`retrieved_at`), numerical model run base time (`model_base_time`), forecast valid range (`forecast_valid_start` to `forecast_valid_end`), and forecast horizon limits (15-day ceiling, warning on $> 7$ days).
- **Cache-Bypass Real Refresh**: Users can trigger an on-demand forecast recalculation via **Force Refresh** (`force_refresh: true`), clearing upstream cache layers and updating all map markers, heat corridors, and timelines.

### 3. Clickable Distance-Proportional Route Risk Timeline
- **Proportional Segment Widths**: Each route segment is positioned strictly according to its true mileage (`segment_miles / total_distance_mi * 100%`), with mile and arrival time ticks (0 mi, 25%, 50%, 75%, 100%).
- **Bidirectional System Synchronization**: Selecting a timeline segment immediately centers and zooms the Leaflet map to that checkpoint, opens its weather and hazard popup, synchronizes the 0–48h forecast slider, and updates the heat corridor layer.
- **Accessibility**: Full keyboard navigation, ARIA option/listbox roles, screen reader announcements, and high-contrast colorways.

---

## API Contracts

### `POST /api/analyze`
**Request Payload:**
```json
{
  "origin": { "label": "Chicago, Illinois", "lat": 41.8781, "lon": -87.6298 },
  "destination": { "label": "Denver, Colorado", "lat": 39.7392, "lon": -104.9903 },
  "departure": "2026-10-24T08:00:00Z",
  "weight_lb": 42000,
  "interval_miles": "auto",
  "force_refresh": false
}
```

**Response Payload:**
- `forecast_start`: UTC ISO timestamp of departure rounded to hour.
- `recommended_id`: Integer ID of the safest route (or `null` if all routes are prohibited).
- `all_prohibited`: Boolean flag (`true` when all candidate routes contain No Travel miles).
- `route_notice`: String notice if fewer than 3 distinct route options exist for the corridor.
- `rationale`: Explanation of recommendation (e.g., "Lowest average risk: 0 vs 0.04 on the next best route.").
- `routes`: Array of route alternatives with `id`, `name`, `distance_mi`, `duration_s`, `interval_mi`, `stats`, `geometry`, and `checkpoints`.

### `GET /api/geocode?q={query}`
Returns array of candidate locations matching query with `label`, `lat`, and `lon` (Nominatim with Open-Meteo fallback).

### `GET /api/health`
Returns `{"status": "ok"}` for container health probes and uptime monitoring.

### `GET /api/trips/` & `POST /api/trips/`
Retrieve saved commercial trip history or save a new trip configuration with route analysis results.

### `GET /api/trips/{id}/pdf/`
Generate and download an official route dispatch report in PDF format.

---

## Assumptions & Boundaries

- Risk bands follow $[lower, upper)$; rain $> 1.00$ in/hr and snow $> 3.0$ in/hr are classified as No Travel (so exactly $1.00$ / $3.0$ is Severe).
- Routes with any **No Travel** miles are ranked strictly below routes without No Travel miles.
- **Hard Safety Constraint**: If all candidate routes traverse active No Travel conditions, travel is prohibited on all routes and no route is labeled safe.
- **Incomplete / Missing Forecasts**: Missing weather observations are classified as `UNKNOWN` rather than assumed safe; any route containing unknown segments reports `unknown_miles` in its summary and rationale.
- Open-Meteo forecasts provide hourly sustained 10 m wind speeds and precipitation rates (nearest hour match without interpolation).
- Distance-based ETAs assume steady travel based on `TRUCK_TIME_FACTOR` without traffic congestion or mandated Hours of Service (HOS) driver rest breaks.
