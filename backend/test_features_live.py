import urllib.request
import json
import io
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE_URL = "http://127.0.0.1:8000"

def post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def get_json(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def get_bytes(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        headers = dict(resp.getheaders())
        return resp.status, headers, resp.read()

def main():
    print("==================================================")
    print("LIVE INTEGRATION VERIFICATION: 3 CORE FEATURES")
    print("==================================================")

    # 1. Test Corridor Analysis & Route Trade-Off Engine
    print("\n1. Testing Live /api/analyze with Trade-Off Engine...")
    analyze_payload = {
        "origin": {"label": "Chicago, IL", "lat": 41.8781, "lon": -87.6298},
        "destination": {"label": "Denver, CO", "lat": 39.7392, "lon": -104.9903},
        "departure": "2026-10-24T08:00:00Z",
        "weight_lb": 42000,
        "interval_miles": 50
    }
    status, result = post_json(f"{BASE_URL}/api/analyze", analyze_payload)
    assert status == 200, f"Expected 200, got {status}"
    assert "trade_off" in result, "Trade-off summary missing from /api/analyze"
    trade_off = result["trade_off"]
    print(f"   -> Fastest Route ID: {trade_off.get('fastest_route_id')}")
    print(f"   -> Safest Route ID: {trade_off.get('safest_route_id')}")
    print(f"   -> Recommended Route ID: {trade_off.get('recommended_route_id')}")
    print(f"   -> Additional Travel Time: {trade_off.get('additional_travel_time_min')} min")
    print(f"   -> Additional Distance: {trade_off.get('additional_distance_mi')} mi")
    print(f"   -> Risk Mile Reduction: {trade_off.get('risk_reduction_mi')} mi ({trade_off.get('risk_reduction_pct')}%)")
    print(f"   -> Avoided Hazards: {trade_off.get('avoided_hazards')}")
    print(f"   -> Rationale: {trade_off.get('why_recommended')}")
    assert len(result["routes"]) >= 1, "No routes returned"
    r0 = result["routes"][0]
    assert "hazard_breakdown" in r0, "Hazard breakdown missing from route"
    print(f"   -> Route 1 Hazard Breakdown: {r0['hazard_breakdown']}")

    # 2. Test On-Demand PDF Generation
    print("\n2. Testing On-Demand PDF Report (POST /api/report/pdf)...")
    pdf_req_payload = {
        "trip": analyze_payload,
        "analysis": result
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/report/pdf",
        data=json.dumps(pdf_req_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        pdf_status = resp.status
        pdf_headers = dict(resp.getheaders())
        pdf_bytes = resp.read()
    assert pdf_status == 200
    assert "application/pdf" in pdf_headers.get("Content-Type", "") or "application/pdf" in pdf_headers.get("content-type", "")
    assert pdf_bytes.startswith(b"%PDF"), f"Invalid PDF header: {pdf_bytes[:10]}"
    print(f"   -> Generated valid PDF ({len(pdf_bytes):,} bytes, Content-Disposition: {pdf_headers.get('Content-Disposition')})")

    # 3. Test Saved Trips Persistence (POST /api/trips/)
    print("\n3. Testing Trip Persistence (POST /api/trips/)...")
    save_payload = {
        "name": "Chicago → Denver Freight Run",
        "origin_label": analyze_payload["origin"]["label"],
        "origin_lat": analyze_payload["origin"]["lat"],
        "origin_lon": analyze_payload["origin"]["lon"],
        "destination_label": analyze_payload["destination"]["label"],
        "destination_lat": analyze_payload["destination"]["lat"],
        "destination_lon": analyze_payload["destination"]["lon"],
        "departure": analyze_payload["departure"],
        "weight_lb": analyze_payload["weight_lb"],
        "interval_miles": analyze_payload["interval_miles"],
        "analysis_data": result
    }
    status, saved_trip = post_json(f"{BASE_URL}/api/trips/", save_payload)
    assert status == 201, f"Expected 201, got {status}"
    trip_id = saved_trip["id"]
    print(f"   -> Saved trip created with ID #{trip_id}, name: '{saved_trip['name']}'")
    assert saved_trip["analysis_count"] == 1
    latest_analysis = saved_trip["latest_analysis"]
    analysis_id = latest_analysis["id"]
    print(f"   -> Initial Analysis ID #{analysis_id}, Version #{latest_analysis['version']}")

    # 4. Test Saved Trip PDF Download (GET /api/trips/<id>/report.pdf)
    print(f"\n4. Testing Saved Trip PDF Download (GET /api/trips/{trip_id}/report.pdf)...")
    status, headers, trip_pdf_bytes = get_bytes(f"{BASE_URL}/api/trips/{trip_id}/report.pdf")
    assert status == 200
    assert trip_pdf_bytes.startswith(b"%PDF")
    print(f"   -> Retrieved saved trip PDF ({len(trip_pdf_bytes):,} bytes)")

    # 5. Test Trip Duplication (POST /api/trips/<id>/duplicate/)
    print(f"\n5. Testing Trip Duplication (POST /api/trips/{trip_id}/duplicate/)...")
    dup_payload = {"departure": "2026-10-25T10:00:00Z"}
    status, dup_trip = post_json(f"{BASE_URL}/api/trips/{trip_id}/duplicate/", dup_payload)
    assert status == 201
    dup_id = dup_trip["id"]
    assert dup_id != trip_id
    assert "2026-10-25T10:00:00" in dup_trip["departure"]
    print(f"   -> Duplicated Trip ID #{dup_id}, distinct departure: {dup_trip['departure']}")

    # 6. Test Trip Reanalysis (POST /api/trips/<id>/reanalyze/)
    print(f"\n6. Testing Trip Reanalysis (POST /api/trips/{trip_id}/reanalyze/)...")
    status, reanalysis_res = post_json(f"{BASE_URL}/api/trips/{trip_id}/reanalyze/", {})
    assert status == 200
    new_analysis = reanalysis_res["analysis"]
    print(f"   -> Reanalysis created Version #{new_analysis['version']}, ID #{new_analysis['id']}")
    assert new_analysis["version"] == 2

    # Verify historical analyses list
    status, analyses_list = get_json(f"{BASE_URL}/api/trips/{trip_id}/analyses/")
    assert status == 200
    assert len(analyses_list) == 2, f"Expected 2 analyses, got {len(analyses_list)}"
    print(f"   -> Preserved {len(analyses_list)} historical analysis versions in SQLite")

    # 7. Test Historical Version PDF Download
    v1_id = analyses_list[1]["id"] # older version
    print(f"\n7. Testing Historical Version PDF (GET /api/trips/{trip_id}/analyses/{v1_id}/report.pdf)...")
    status, headers, v1_pdf_bytes = get_bytes(f"{BASE_URL}/api/trips/{trip_id}/analyses/{v1_id}/report.pdf")
    assert status == 200
    assert v1_pdf_bytes.startswith(b"%PDF")
    print(f"   -> Retrieved version 1 historical PDF ({len(v1_pdf_bytes):,} bytes)")

    # 8. Clean up test trips
    print(f"\n8. Cleaning up test trips #{trip_id} and #{dup_id}...")
    for tid in [trip_id, dup_id]:
        del_req = urllib.request.Request(f"{BASE_URL}/api/trips/{tid}/", method="DELETE")
        with urllib.request.urlopen(del_req) as resp:
            assert resp.status in (200, 204)
    print("   -> Cleaned up test trips successfully.")

    print("\n==================================================")
    print("ALL 3 FEATURES VERIFIED END-TO-END WITH LIVE DATA!")
    print("==================================================")

if __name__ == "__main__":
    main()
