from django.db import models


class Trip(models.Model):
    name = models.CharField(max_length=255, blank=True)
    origin_label = models.CharField(max_length=255)
    origin_lat = models.FloatField()
    origin_lon = models.FloatField()
    dest_label = models.CharField(max_length=255)
    dest_lat = models.FloatField()
    dest_lon = models.FloatField()
    departure = models.DateTimeField()
    weight_lb = models.FloatField()
    interval_miles = models.CharField(max_length=32, default="auto")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name or f"{self.origin_label} -> {self.dest_label}"

    def to_dict(self):
        latest = self.analyses.order_by("-version").first()
        return {
            "id": self.id,
            "name": self.name or f"{self.origin_label} -> {self.dest_label}",
            "origin": {"label": self.origin_label, "lat": self.origin_lat, "lon": self.origin_lon},
            "destination": {"label": self.dest_label, "lat": self.dest_lat, "lon": self.dest_lon},
            "departure": self.departure.isoformat(),
            "weight_lb": self.weight_lb,
            "interval_miles": self.interval_miles,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "analysis_count": self.analyses.count(),
            "latest_analysis": latest.to_summary_dict() if latest else None,
        }


class TripAnalysis(models.Model):
    trip = models.ForeignKey(Trip, related_name="analyses", on_delete=models.CASCADE)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    departure = models.DateTimeField()
    weight_lb = models.FloatField()
    forecast_reference_time = models.CharField(max_length=64, blank=True)
    provider_metadata = models.JSONField(default=dict)
    status = models.CharField(max_length=32, default="completed")
    recommended_id = models.IntegerField(null=True, blank=True)
    all_prohibited = models.BooleanField(default=False)
    rationale = models.TextField(blank=True)
    trade_off = models.JSONField(default=dict)
    result_data = models.JSONField(default=dict)

    class Meta:
        ordering = ["-version"]
        unique_together = [("trip", "version")]

    def to_summary_dict(self):
        # Extract quick metrics from result_data if available
        routes = self.result_data.get("routes", [])
        rec_route = next((r for r in routes if r.get("id") == self.recommended_id), None) if routes else None
        rec_stats = rec_route.get("stats", {}) if rec_route else {}
        elevated_mi = round(rec_stats.get("severe_miles", 0) + rec_stats.get("high_miles", 0) + rec_stats.get("no_travel_miles", 0), 1)

        return {
            "id": self.id,
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "departure": self.departure.isoformat(),
            "weight_lb": self.weight_lb,
            "recommended_id": self.recommended_id,
            "all_prohibited": self.all_prohibited,
            "rationale": self.rationale,
            "forecast_reference_time": self.forecast_reference_time,
            "provider_metadata": self.provider_metadata,
            "recommended_route_name": rec_route.get("name") if rec_route else None,
            "recommended_distance_mi": rec_route.get("distance_mi") if rec_route else None,
            "recommended_duration_s": rec_route.get("duration_s") if rec_route else None,
            "recommended_risk_level": rec_stats.get("max_level") if rec_route else None,
            "recommended_risk_miles": elevated_mi if rec_route else None,
        }

    def to_full_dict(self):
        d = self.to_summary_dict()
        d["result_data"] = self.result_data
        return d
