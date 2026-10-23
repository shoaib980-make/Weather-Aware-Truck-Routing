from django.urls import path

from . import trip_views, views

urlpatterns = [
    # Geocoding, Health, and Analysis
    path("geocode", views.geocode_view),
    path("analyze", views.analyze_view),
    path("health", views.health_view),

    # Saved Trips CRUD & Operations
    path("trips", trip_views.trips_collection_view),
    path("trips/", trip_views.trips_collection_view),
    path("trips/<int:trip_id>", trip_views.trip_detail_view),
    path("trips/<int:trip_id>/", trip_views.trip_detail_view),
    path("trips/<int:trip_id>/duplicate", trip_views.trip_duplicate_view),
    path("trips/<int:trip_id>/duplicate/", trip_views.trip_duplicate_view),
    path("trips/<int:trip_id>/reanalyze", trip_views.trip_reanalyze_view),
    path("trips/<int:trip_id>/reanalyze/", trip_views.trip_reanalyze_view),

    # Versioned Analyses & PDF Reports
    path("trips/<int:trip_id>/report.pdf", trip_views.trip_analysis_pdf_view),
    path("trips/<int:trip_id>/analyses", trip_views.trip_analyses_list_view),
    path("trips/<int:trip_id>/analyses/", trip_views.trip_analyses_list_view),
    path("trips/<int:trip_id>/analyses/<int:analysis_id>", trip_views.trip_analysis_detail_view),
    path("trips/<int:trip_id>/analyses/<int:analysis_id>/", trip_views.trip_analysis_detail_view),
    path("trips/<int:trip_id>/analyses/<int:analysis_id>/report.pdf", trip_views.trip_analysis_pdf_view),
    path("report/pdf", trip_views.on_demand_report_pdf_view),
]

