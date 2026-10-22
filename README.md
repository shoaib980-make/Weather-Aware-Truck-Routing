# Weather-Aware Truck Routing

React + Django app that compares three driving routes by the weather a truck will meet
at the time it actually reaches each point, and recommends the safest one.

No API keys needed: routing = **OSRM**, weather = **Open-Meteo**, geocoding = **Nominatim**.

## Run locally

```bash
# backend (http://127.0.0.1:8000)
cd backend
pip install -r requirements.txt
python manage.py test          # risk rules, recommendation, checkpoints
python manage.py runserver

# frontend (http://localhost:5173, proxies /api to Django)
cd frontend
npm install
npm run dev
```

## Deploy (one container)

`docker build -t truck-routing . && docker run -p 8000:8000 truck-routing`
works as-is on Render / Fly.io / Railway (point them at the Dockerfile). Set
`DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0` and `DJANGO_ALLOWED_HOSTS` in production.
Set `HTTP_USER_AGENT` to something with your contact email (Nominatim's usage policy).

## How it works

`POST /api/analyze` → `routing/analysis.py`:

1. **Routes** (`routes.py`): OSRM `alternatives=3`. If fewer than 3 distinct routes come back
   (common), detour routes are built via waypoints offset from the route midpoint; near-duplicates
   (>90% overlap) are discarded. Routes are numbered fastest first.
2. **Checkpoints**: every 10 / 25 / 50 miles. "Automatic" picks 10 mi for trips ≤150 mi, 25 mi
   ≤500 mi, otherwise 50 mi; the user can force any of the three. Each checkpoint gets an
   **ETA** = departure + route duration × (miles so far / total miles). OSRM durations are for cars,
   so they're multiplied by `TRUCK_TIME_FACTOR` (default 1.15).
3. **Weather** (`weather.py`): hourly wind (mph), rain and snow (in/hr) from Open-Meteo, batched,
   fetched in parallel and cached 15 min. Each checkpoint uses the hour nearest its ETA.
4. **Risk** (`risk.py`): worst of wind/rain/snow by the assignment table, then the load rules
   (≥55 mph → No Travel; 45–54 mph & >30,000 lb → No Travel; 35–44 mph & >40,000 lb → Severe).
5. **Recommendation** (`recommend.py`): lexicographic on fewest **Severe** miles → fewest **High**
   miles → lowest average risk → shortest time. Each checkpoint represents the road halfway to its
   neighbours, so level mileage sums to the route length.
6. **Heatmap**: each checkpoint also returns its risk for the 49 hours after departure
   (0–48 h), so the slider re-colours the corridor in the browser with no extra requests.

### Assumptions to know about
- Band edges are `[lower, upper)`; rain > 1.00 and snow > 3.0 are No Travel (so exactly 1.00 / 3.0 is Severe).
- Routes containing any **No Travel** miles are ranked below any route without, ahead of the Severe rule.
- Weather uses sustained 10 m wind speed (not gusts) and nearest-hour values (no interpolation).
- Forecast horizon is 15 days (Open-Meteo); the load rules apply in the heatmap as well.
- Distance-based ETAs ignore traffic, breaks and hours-of-service limits.
- Public OSRM/Nominatim servers are rate-limited demo services; self-host them (`OSRM_URL`,
  `NOMINATIM_URL`) for production traffic.

## Layout

```
backend/  config/ (Django settings)  routing/ (risk, routes, weather, recommend, views, tests)
frontend/ src/components/ (TripForm, RouteList, MapView, HeatCorridor, HeatSlider)
```
