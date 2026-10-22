import { useState } from "react";
import { analyze } from "./api.js";
import HeatSlider from "./components/HeatSlider.jsx";
import MapView from "./components/MapView.jsx";
import RouteList from "./components/RouteList.jsx";
import TripForm from "./components/TripForm.jsx";

export default function App() {
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hour, setHour] = useState(0);
  const [showHeat, setShowHeat] = useState(true);

  async function run(payload) {
    setLoading(true);
    setError("");
    try {
      const data = await analyze(payload);
      setResult(data);
      setSelectedId(data.recommended_id);
      setHour(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>Weather-aware truck routing</h1>
          <p>Compare three routes by the weather your truck will actually meet, hour by hour.</p>
        </header>
        <TripForm onSubmit={run} loading={loading} />
        {error && <p className="error" role="alert">{error}</p>}
        {result && <RouteList result={result} selectedId={selectedId} onSelect={setSelectedId} />}
        {!result && !loading && <p className="empty">Enter a trip to see routes, checkpoint risk and the forecast corridor.</p>}
      </aside>
      <main className="map-pane">
        <MapView result={result} selectedId={selectedId} onSelect={setSelectedId} hour={hour} showHeat={showHeat} />
        {loading && <div className="loading">Fetching routes and forecasts…</div>}
        {result && <HeatSlider start={result.forecast_start} hour={hour} onHour={setHour} showHeat={showHeat} onToggle={setShowHeat} />}
      </main>
    </div>
  );
}
