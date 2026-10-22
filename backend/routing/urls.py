from django.urls import path

from . import views

urlpatterns = [
    path("geocode", views.geocode_view),
    path("analyze", views.analyze_view),
    path("health", views.health_view),
]
