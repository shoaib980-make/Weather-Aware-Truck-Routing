"""API views for Saved Trips, Versioned Reanalysis, and PDF Report Downloads."""
import json
from datetime import datetime, timezone

from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .analysis import analyze_trip
from .models import Trip, TripAnalysis
from .report_pdf import generate_trip_safety_pdf
from .routes import RoutingError
from .weather import WeatherError


def _json_error(msg, status=400):
    return JsonResponse({"error": msg}, status=status)


def _parse_place(raw, name, fallback_prefix=None, body=None):
    data = None
    if raw and isinstance(raw, dict) and "lat" in raw and "lon" in raw:
        data = raw
    elif body and fallback_prefix:
        lat = body.get(f"{fallback_prefix}_lat") or (body.get("destination_lat") if fallback_prefix == "dest" else None)
        lon = body.get(f"{fallback_prefix}_lon") or (body.get("destination_lon") if fallback_prefix == "dest" else None)
        label = body.get(f"{fallback_prefix}_label") or (body.get("destination_label") if fallback_prefix == "dest" else "") or ""
        if lat is not None and lon is not None:
            data = {"lat": lat, "lon": lon, "label": label}

    if not data:
        raise ValueError(f"{name} must include numeric lat and lon.")

    try:
        lat, lon = float(data["lat"]), float(data["lon"])
    except (KeyError, TypeError, ValueError):
        raise ValueError(f"{name} must include numeric lat and lon.")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError(f"{name} coordinates are out of range.")
    return {"lat": lat, "lon": lon, "label": data.get("label", "")}


@csrf_exempt
@require_http_methods(["GET", "POST"])
def trips_collection_view(request):
    """GET /api/trips/ - List all saved trips with latest analysis summaries.
    POST /api/trips/ - Save a trip and its analysis snapshot.
    """
    if request.method == "GET":
        trips = Trip.objects.all()
        return JsonResponse({"trips": [t.to_dict() for t in trips]})

    # POST: Save a new trip
    try:
        body = json.loads(request.body or b"{}")
        origin = _parse_place(body.get("origin"), "Origin", fallback_prefix="origin", body=body)
        dest = _parse_place(body.get("destination"), "Destination", fallback_prefix="dest", body=body)
        weight = float(body.get("weight_lb", 42000))
        depart_val = body.get("departure") or body.get("depart")
        if not depart_val:
            raise ValueError("Departure timestamp is required.")
        depart = datetime.fromisoformat(str(depart_val).replace("Z", "+00:00"))
        if depart.tzinfo is None:
            depart = depart.replace(tzinfo=timezone.utc)
        name = str(body.get("name", "")).strip() or f"{origin['label']} → {dest['label']}"
        interval = str(body.get("interval_miles", "auto"))
        analysis_payload = body.get("analysis_data")
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        return _json_error(str(exc) if isinstance(exc, ValueError) else "Invalid trip data.")

    trip = Trip.objects.create(
        name=name,
        origin_label=origin["label"],
        origin_lat=origin["lat"],
        origin_lon=origin["lon"],
        dest_label=dest["label"],
        dest_lat=dest["lat"],
        dest_lon=dest["lon"],
        departure=depart,
        weight_lb=weight,
        interval_miles=interval,
    )

    if analysis_payload and isinstance(analysis_payload, dict):
        TripAnalysis.objects.create(
            trip=trip,
            version=1,
            departure=depart,
            weight_lb=weight,
            forecast_reference_time=analysis_payload.get("data_provenance", {}).get("model_base_time", ""),
            provider_metadata=analysis_payload.get("data_provenance", {}),
            status="completed",
            recommended_id=analysis_payload.get("recommended_id"),
            all_prohibited=analysis_payload.get("all_prohibited", False),
            rationale=analysis_payload.get("rationale", ""),
            trade_off={},
            result_data=analysis_payload,
        )

    return JsonResponse(trip.to_dict(), status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def trip_detail_view(request, trip_id):
    """GET /api/trips/<id>/ - Trip detail with list of analysis versions.
    PATCH /api/trips/<id>/ - Update trip parameters.
    DELETE /api/trips/<id>/ - Delete trip and historical analyses.
    """
    trip = get_object_or_404(Trip, pk=trip_id)

    if request.method == "DELETE":
        trip.delete()
        return JsonResponse({"status": "deleted", "id": trip_id})

    if request.method == "PATCH":
        try:
            body = json.loads(request.body or b"{}")
            if "name" in body:
                trip.name = str(body["name"]).strip()
            if "weight_lb" in body:
                w = float(body["weight_lb"])
                if w <= 0 or w > 200_000:
                    raise ValueError("Weight must be between 1 and 200,000 lb.")
                trip.weight_lb = w
            if "departure" in body:
                d = datetime.fromisoformat(str(body["departure"]).replace("Z", "+00:00"))
                if d.tzinfo is None:
                    d = d.replace(tzinfo=timezone.utc)
                trip.departure = d
            if "origin" in body:
                o = _parse_place(body["origin"], "Origin")
                trip.origin_label, trip.origin_lat, trip.origin_lon = o["label"], o["lat"], o["lon"]
            if "destination" in body:
                dst = _parse_place(body["destination"], "Destination")
                trip.dest_label, trip.dest_lat, trip.dest_lon = dst["label"], dst["lat"], dst["lon"]
            if "interval_miles" in body:
                trip.interval_miles = str(body["interval_miles"])
            trip.save()
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            return _json_error(str(exc))

    # GET or PATCH response
    analyses = trip.analyses.all()
    d = trip.to_dict()
    d["analyses"] = [a.to_summary_dict() for a in analyses]
    return JsonResponse(d)


@csrf_exempt
@require_http_methods(["POST"])
def trip_duplicate_view(request, trip_id):
    """POST /api/trips/<id>/duplicate/ - Duplicate trip with new ID."""
    source_trip = get_object_or_404(Trip, pk=trip_id)
    try:
        body = json.loads(request.body or b"{}")
        new_name = str(body.get("name", "")).strip() or f"Copy of {source_trip.name}"
        if "departure" in body and body["departure"]:
            depart = datetime.fromisoformat(str(body["departure"]).replace("Z", "+00:00"))
            if depart.tzinfo is None:
                depart = depart.replace(tzinfo=timezone.utc)
        else:
            depart = source_trip.departure
        weight = float(body.get("weight_lb", source_trip.weight_lb))
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        return _json_error(str(exc))

    new_trip = Trip.objects.create(
        name=new_name,
        origin_label=source_trip.origin_label,
        origin_lat=source_trip.origin_lat,
        origin_lon=source_trip.origin_lon,
        dest_label=source_trip.dest_label,
        dest_lat=source_trip.dest_lat,
        dest_lon=source_trip.dest_lon,
        departure=depart,
        weight_lb=weight,
        interval_miles=source_trip.interval_miles,
    )

    return JsonResponse(new_trip.to_dict(), status=201)


@csrf_exempt
@require_http_methods(["POST"])
def trip_reanalyze_view(request, trip_id):
    """POST /api/trips/<id>/reanalyze/ - Re-run analysis with latest forecast, preserve history."""
    trip = get_object_or_404(Trip, pk=trip_id)

    # Optional body overrides (e.g. updated departure time before reanalysis)
    try:
        body = json.loads(request.body or b"{}")
        if "departure" in body and body["departure"]:
            depart = datetime.fromisoformat(str(body["departure"]).replace("Z", "+00:00"))
            if depart.tzinfo is None:
                depart = depart.replace(tzinfo=timezone.utc)
            trip.departure = depart
        if "weight_lb" in body and body["weight_lb"]:
            trip.weight_lb = float(body["weight_lb"])
        trip.save()
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        return _json_error(str(exc))

    origin = {"lat": trip.origin_lat, "lon": trip.origin_lon, "label": trip.origin_label}
    dest = {"lat": trip.dest_lat, "lon": trip.dest_lon, "label": trip.dest_label}

    try:
        # Pass force_refresh=True to bypass cache and pull latest available NWP model data
        result = analyze_trip(
            origin=origin,
            destination=dest,
            depart=trip.departure,
            weight_lb=trip.weight_lb,
            interval=trip.interval_miles,
            force_refresh=True,
        )
    except (RoutingError, WeatherError) as exc:
        return _json_error(f"Reanalysis failed: {exc}", status=502)

    # Increment version sequence
    last_analysis = trip.analyses.order_by("-version").first()
    new_version = (last_analysis.version + 1) if last_analysis else 1

    analysis_record = TripAnalysis.objects.create(
        trip=trip,
        version=new_version,
        departure=trip.departure,
        weight_lb=trip.weight_lb,
        forecast_reference_time=result.get("data_provenance", {}).get("model_base_time", ""),
        provider_metadata=result.get("data_provenance", {}),
        status="completed",
        recommended_id=result.get("recommended_id"),
        all_prohibited=result.get("all_prohibited", False),
        rationale=result.get("rationale", ""),
        trade_off={},
        result_data=result,
    )

    return JsonResponse({
        "status": "reanalyzed",
        "trip_id": trip.id,
        "version": new_version,
        "analysis": analysis_record.to_full_dict(),
    })


@require_http_methods(["GET"])
def trip_analyses_list_view(request, trip_id):
    """GET /api/trips/<id>/analyses/ - List all historical analysis versions for a trip."""
    trip = get_object_or_404(Trip, pk=trip_id)
    analyses = [a.to_summary_dict() for a in trip.analyses.order_by("-version")]
    return JsonResponse(analyses, safe=False)


@require_http_methods(["GET"])
def trip_analysis_detail_view(request, trip_id, analysis_id):
    """GET /api/trips/<id>/analyses/<analysis_id>/ - Retrieve specific analysis version snapshot."""
    trip = get_object_or_404(Trip, pk=trip_id)
    analysis = get_object_or_404(TripAnalysis, pk=analysis_id, trip=trip)
    return JsonResponse(analysis.to_full_dict())


@require_http_methods(["GET"])
def trip_analysis_pdf_view(request, trip_id, analysis_id=None):
    """GET /api/trips/<id>/analyses/<analysis_id>/report.pdf (or /api/trips/<id>/report.pdf)."""
    trip = get_object_or_404(Trip, pk=trip_id)
    if analysis_id:
        analysis = get_object_or_404(TripAnalysis, pk=analysis_id, trip=trip)
    else:
        analysis = trip.analyses.order_by("-version").first()
        if not analysis:
            return _json_error("No analysis records exist for this trip. Please run an analysis first.", status=404)

    pdf_bytes = generate_trip_safety_pdf(trip.to_dict(), analysis.result_data)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"SafeHaul_RouteIQ_Trip_{trip.id}_v{analysis.version}_{date_str}.pdf"

    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


@csrf_exempt
@require_http_methods(["POST"])
def on_demand_report_pdf_view(request):
    """POST /api/report/pdf - Generate PDF directly from an analysis snapshot (for unsaved trips)."""
    try:
        body = json.loads(request.body or b"{}")
        trip_info = body.get("trip", {})
        analysis_data = body.get("analysis_data") or body.get("analysis", {})
        if not analysis_data or "routes" not in analysis_data:
            raise ValueError("Analysis data must contain evaluated routes.")
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        return _json_error(str(exc))

    pdf_bytes = generate_trip_safety_pdf(trip_info, analysis_data)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"SafeHaul_RouteIQ_Trip_Report_{date_str}.pdf"

    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp
