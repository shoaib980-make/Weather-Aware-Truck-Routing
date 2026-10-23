import React, { useEffect, useState } from "react";
import { analyze, saveTrip, downloadOnDemandPdf } from "./api.js";
import Header, { PRESETS } from "./components/Header.jsx";
import HeatSlider from "./components/HeatSlider.jsx";
import MapView from "./components/MapView.jsx";
import RouteList from "./components/RouteList.jsx";
import SafetyModal from "./components/SafetyModal.jsx";
import SavedTripsModal from "./components/SavedTripsModal.jsx";
import TripForm from "./components/TripForm.jsx";
import { Icon } from "./components/Icons.jsx";

export default function App() {
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hour, setHour] = useState(0);
  const [showHeat, setShowHeat] = useState(true);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [savedTripsOpen, setSavedTripsOpen] = useState(false);
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [toast, setToast] = useState(null);
  const [departureTime, setDepartureTime] = useState("");
  const [activeCheckpoint, setActiveCheckpoint] = useState(null);
  const [formInitialValues, setFormInitialValues] = useState(null);
  const [mobileTab, setMobileTab] = useState("setup"); // 'setup' | 'routes' | 'map'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("safehaul-theme") || "light";
  });

  const [lastPayload, setLastPayload] = useState(null);
  const [refreshLoading, setRefreshLoading] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("safehaul-theme", theme);
  }, [theme]);

  function handleToggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function handleSelectPreset(preset) {
    setFormInitialValues({
      origin: preset.origin,
      destination: preset.destination,
      weight: preset.weight,
    });
    setError("");
  }

  async function handleAnalyze(payload) {
    setLoading(true);
    setError("");
    setDepartureTime(payload.departure);
    setActiveCheckpoint(null);
    setLastPayload(payload);

    try {
      const data = await analyze(payload);
      setResult(data);
      setSelectedId(data.recommended_id);
      setHour(0);
      setMobileTab("routes"); // On mobile, automatically show routes
    } catch (e) {
      setError(e.message || "An unexpected error occurred during corridor analysis.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshForecast() {
    if (!lastPayload) return;
    setRefreshLoading(true);
    setError("");
    try {
      const data = await analyze({ ...lastPayload, force_refresh: true });
      setResult(data);
      // Keep currently selected route if still valid
      if (data.routes && !data.routes.some((r) => r.id === selectedId)) {
        setSelectedId(data.recommended_id);
      }
    } catch (e) {
      setError(e.message || "Failed to refresh weather forecast data.");
    } finally {
      setRefreshLoading(false);
    }
  }

  async function handleSaveTrip() {
    if (!result || !lastPayload) return;
    setIsSavingTrip(true);
    try {
      const originCity = lastPayload.origin?.label?.split(",")[0]?.trim() || "Origin";
      const destCity = lastPayload.destination?.label?.split(",")[0]?.trim() || "Destination";
      const tripName = `${originCity} → ${destCity}`;
      
      const payloadToSave = {
        name: tripName,
        origin_label: lastPayload.origin?.label || "Origin",
        origin_lat: lastPayload.origin?.lat,
        origin_lon: lastPayload.origin?.lon,
        destination_label: lastPayload.destination?.label || "Destination",
        destination_lat: lastPayload.destination?.lat,
        destination_lon: lastPayload.destination?.lon,
        departure: lastPayload.departure,
        weight_lb: lastPayload.weight_lb || 40000,
        interval_miles: lastPayload.interval_miles || 25,
        analysis_data: result,
      };

      const saved = await saveTrip(payloadToSave);
      setToast({ type: "success", text: `Trip "${saved.name}" (#${saved.id}) preserved to database!` });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setToast({ type: "error", text: err.message || "Failed to save trip." });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsSavingTrip(false);
    }
  }

  async function handleDownloadPdf() {
    if (!result || !lastPayload) return;
    setIsDownloadingPdf(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const filename = `SafeHaul_RouteIQ_Trip_Report_${today}.pdf`;
      await downloadOnDemandPdf(lastPayload, result, filename);
      setToast({ type: "success", text: "Trip Safety Report PDF generated and downloaded!" });
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setToast({ type: "error", text: err.message || "Failed to generate Trip Safety Report PDF." });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  function handleLoadSavedTrip(trip, analysisData) {
    setResult(analysisData);
    setSelectedId(analysisData.recommended_id);
    setDepartureTime(trip.departure);
    setLastPayload({
      origin: { label: trip.origin_label, lat: trip.origin_lat, lon: trip.origin_lon },
      destination: { label: trip.destination_label, lat: trip.destination_lat, lon: trip.destination_lon },
      departure: trip.departure,
      weight_lb: trip.weight_lb,
      interval_miles: trip.interval_miles,
    });
    setFormInitialValues({
      origin: { label: trip.origin_label, lat: trip.origin_lat, lon: trip.origin_lon },
      destination: { label: trip.destination_label, lat: trip.destination_lat, lon: trip.destination_lon },
      weight: trip.weight_lb,
    });
    setMobileTab("routes");
    setToast({ type: "success", text: `Loaded saved trip "${trip.name}" into workspace.` });
    setTimeout(() => setToast(null), 3500);
  }

  function handleSelectCheckpoint(cp) {
    setActiveCheckpoint(cp);
    if (cp && cp.eta && result?.forecast_start) {
      const baseDate = new Date(result.forecast_start);
      const etaDate = new Date(cp.eta);
      if (!isNaN(baseDate.getTime()) && !isNaN(etaDate.getTime())) {
        const diffMs = etaDate.getTime() - baseDate.getTime();
        const hourOffset = Math.min(48, Math.max(0, Math.round(diffMs / (3600 * 1000))));
        setHour(hourOffset);
      }
    }
  }

  const selectedRoute = result?.routes?.find((r) => r.id === selectedId) || result?.routes?.[0];

  return (
    <div className="app-root">
      <Header
        onSelectPreset={handleSelectPreset}
        onOpenSafety={() => setSafetyOpen(true)}
        onOpenSavedTrips={() => setSavedTripsOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`app-toast toast-${toast.type}`} role="status">
          <Icon name={toast.type === "success" ? "shield-check" : "alert-triangle"} size={16} />
          <span>{toast.text}</span>
          <button type="button" className="toast-close" onClick={() => setToast(null)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      <div className="app-workspace">
        {/* Left Sidebar: Trip Setup & Route Analysis */}
        <aside className={`app-sidebar ${mobileTab === "map" ? "mobile-hidden" : ""}`}>
          <div className="sidebar-scroll-content">
            {/* Trip Form Accordion / Section */}
            <section className={`trip-config-section ${mobileTab === "routes" ? "mobile-tab-hidden" : ""}`}>
              <div className="section-header">
                <h2 className="section-title">
                  <Icon name="truck" size={16} />
                  <span>Trip Parameters & Weight</span>
                </h2>
                {result && (
                  <span className="corridor-summary-pill">
                    {result.routes.length} Corridors Analyzed
                  </span>
                )}
              </div>
              <TripForm
                initialValues={formInitialValues}
                onSubmit={handleAnalyze}
                loading={loading}
              />
            </section>

            {/* Error banner */}
            {error && (
              <div className="app-error-banner" role="alert">
                <div className="error-icon-box">
                  <Icon name="alert-triangle" size={18} />
                </div>
                <div className="error-content">
                  <strong>Analysis Error</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Route Comparison or Empty State */}
            {result ? (
              <div className={`routes-view-wrapper ${mobileTab === "setup" ? "mobile-tab-hidden" : ""}`}>
                <RouteList
                  result={result}
                  departureTime={departureTime}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setActiveCheckpoint(null);
                  }}
                  onSelectCheckpoint={handleSelectCheckpoint}
                  activeCheckpoint={activeCheckpoint}
                  onRefreshForecast={handleRefreshForecast}
                  refreshLoading={refreshLoading}
                  forecastHour={hour}
                  onSyncForecastHour={setHour}
                  onSaveTrip={handleSaveTrip}
                  isSavingTrip={isSavingTrip}
                  onDownloadPdf={handleDownloadPdf}
                  isDownloadingPdf={isDownloadingPdf}
                />
              </div>
            ) : (
              !loading && (
                <div className="empty-state-card">
                  <div className="empty-illustration">
                    <Icon name="navigation" size={36} />
                  </div>
                  <h3>Ready for Trip Dispatch</h3>
                  <p>
                    Configure an origin, destination, and gross load weight above — or load an example corridor from the header — to calculate weather risk hour-by-hour.
                  </p>
                  <div className="corridor-quick-pills">
                    <button
                      type="button"
                      className="quick-pill-btn"
                      onClick={() => handleSelectPreset(PRESETS[0])}
                    >
                      Chicago → Denver
                    </button>
                    <button
                      type="button"
                      className="quick-pill-btn"
                      onClick={() => handleSelectPreset(PRESETS[1])}
                    >
                      Dallas → Atlanta
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </aside>

        {/* Right Pane: Interactive Leaflet Map & HeatSlider */}
        <main className={`app-map-pane ${mobileTab !== "map" ? "mobile-pane-hidden" : ""}`}>
          <MapView
            result={result}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hour={hour}
            showHeat={showHeat}
            theme={theme}
            activeCheckpoint={activeCheckpoint}
            onSelectCheckpoint={handleSelectCheckpoint}
          />

          {/* Timeline HeatSlider Overlay */}
          {result && (
            <HeatSlider
              start={result.forecast_start}
              hour={hour}
              onHour={setHour}
              showHeat={showHeat}
              onToggle={setShowHeat}
              selectedRoute={selectedRoute}
            />
          )}
        </main>
      </div>

      {/* Mobile Tab Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`mobile-nav-item ${mobileTab === "setup" ? "active" : ""}`}
          onClick={() => setMobileTab("setup")}
        >
          <Icon name="calendar" size={18} />
          <span>Trip Setup</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${mobileTab === "routes" ? "active" : ""}`}
          onClick={() => setMobileTab("routes")}
          disabled={!result}
        >
          <Icon name="layers" size={18} />
          <span>Routes {result ? `(${result.routes.length})` : ""}</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${mobileTab === "map" ? "active" : ""}`}
          onClick={() => setMobileTab("map")}
        >
          <Icon name="map-pin" size={18} />
          <span>Map & Heatmap</span>
        </button>
      </nav>

      {/* Safety Guidelines Dialog */}
      <SafetyModal isOpen={safetyOpen} onClose={() => setSafetyOpen(false)} />

      {/* Saved Trips & Reanalysis Dialog */}
      <SavedTripsModal
        isOpen={savedTripsOpen}
        onClose={() => setSavedTripsOpen(false)}
        onLoadTripAnalysis={handleLoadSavedTrip}
      />
    </div>
  );
}
