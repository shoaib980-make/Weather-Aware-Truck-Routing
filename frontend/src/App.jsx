import React, { useEffect, useState } from "react";
import { analyze } from "./api.js";
import Header, { PRESETS } from "./components/Header.jsx";
import HeatSlider from "./components/HeatSlider.jsx";
import MapView from "./components/MapView.jsx";
import RouteList from "./components/RouteList.jsx";
import SafetyModal from "./components/SafetyModal.jsx";
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
  const [departureTime, setDepartureTime] = useState("");
  const [activeCheckpoint, setActiveCheckpoint] = useState(null);
  const [formInitialValues, setFormInitialValues] = useState(null);
  const [mobileTab, setMobileTab] = useState("setup"); // 'setup' | 'routes' | 'map'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("safehaul-theme") || "light";
  });

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

  const selectedRoute = result?.routes?.find((r) => r.id === selectedId) || result?.routes?.[0];

  return (
    <div className="app-root">
      <Header
        onSelectPreset={handleSelectPreset}
        onOpenSafety={() => setSafetyOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <div className="app-workspace">
        {/* Left Sidebar: Trip Setup & Route Analysis */}
        <aside className={`app-sidebar ${mobileTab === "map" ? "mobile-hidden" : ""}`}>
          <div className="sidebar-scroll-content">
            {/* Trip Form Accordion / Section */}
            <section className="trip-config-section">
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
              <RouteList
                result={result}
                departureTime={departureTime}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setActiveCheckpoint(null);
                }}
                onSelectCheckpoint={(cp) => {
                  setActiveCheckpoint(cp);
                }}
                activeCheckpoint={activeCheckpoint}
              />
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
            onSelectCheckpoint={setActiveCheckpoint}
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
    </div>
  );
}
