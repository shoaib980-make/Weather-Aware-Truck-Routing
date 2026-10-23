import requests
import json
import sys

BASE = 'http://127.0.0.1:5173'

print('1. Verifying Frontend Root HTML...')
r = requests.get(f'{BASE}/')
assert r.status_code == 200, f'Frontend status: {r.status_code}'
assert 'Weather-Aware Truck Routing' in r.text or 'SafeHaul' in r.text, 'Title not in HTML'
print('   -> OK (Status 200)')

print('2. Verifying Proxy Health Endpoint...')
r = requests.get(f'{BASE}/api/health')
assert r.status_code == 200, f'Health status: {r.status_code}'
assert r.json().get('status') == 'ok', 'Status != ok'
print('   -> OK (Status 200, status=ok)')

print('3. Verifying Geocode Autocomplete Proxy...')
r = requests.get(f'{BASE}/api/geocode?q=Dallas')
assert r.status_code == 200, f'Geocode status: {r.status_code}'
results = r.json().get('results', [])
assert len(results) > 0, 'No geocode results'
print(f'   -> OK ({len(results)} locations returned, first: {results[0]["label"]})')

print('4. Verifying End-to-End Corridor Analysis (Chicago -> Denver, 45,000 lb, 25 mi spacing)...')
payload = {
    'origin': {'label': 'Chicago, Illinois', 'lat': 41.8781, 'lon': -87.6298},
    'destination': {'label': 'Denver, Colorado', 'lat': 39.7392, 'lon': -104.9903},
    'departure': '2026-10-24T08:00:00Z',
    'weight_lb': 45000,
    'interval_miles': '25'
}
r = requests.post(f'{BASE}/api/analyze', json=payload, timeout=45)
assert r.status_code == 200, f'Status {r.status_code}: {r.text}'
data = r.json()
routes = data.get('routes', [])
assert len(routes) >= 1, 'No routes returned'
print(f'   -> OK ({len(routes)} routes generated, recommended_id={data.get("recommended_id")})')
print(f'   -> Rationale: {data.get("rationale")}')
r1 = routes[0]
print(f'   -> Route 1: {round(r1["distance_mi"])} mi, {r1["duration_s"]}s drive, {len(r1["checkpoints"])} checkpoints')
cp0 = r1['checkpoints'][0]
print(f'   -> Checkpoint 0: ETA={cp0["eta"]}, Wind={cp0["wind_mph"]} mph, Rain={cp0["rain_in_hr"]} in/hr, Snow={cp0["snow_in_hr"]} in/hr, Risk={cp0["level_name"]}')
print(f'   -> Checkpoint 0 48h forecast array length: {len(cp0.get("forecast", []))}')

print('5. Verifying Server-Side Validations...')
# Identical points
r = requests.post(f'{BASE}/api/analyze', json={**payload, 'destination': payload['origin']})
assert r.status_code == 400, f'Identical points status: {r.status_code}'
print('   -> Identical endpoints correctly rejected (400)')

# Invalid weight
r = requests.post(f'{BASE}/api/analyze', json={**payload, 'weight_lb': -500})
assert r.status_code == 400, f'Negative weight status: {r.status_code}'
print('   -> Negative weight correctly rejected (400)')

# Invalid interval
r = requests.post(f'{BASE}/api/analyze', json={**payload, 'interval_miles': '999'})
assert r.status_code == 400, f'Invalid interval status: {r.status_code}'
print('   -> Invalid interval correctly rejected (400)')

print('\nALL INTEGRATION AND VALIDATION CHECKS PASSED!')
