import React, { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import HeatCorridor from "./HeatCorridor.jsx";
import { LEVEL_COLORS, ROUTE_COLORS, fmtTime } from "../risk.js";
import { Icon } from "./Icons.jsx";

// Tile layer provider options
const BASE_LAYERS = {
  light: {
    name: "Light Carto",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    name: "Dark Carto",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  osm: {
    name: "Standard OSM",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

function FitRoutesHandler({ routes, activeCheckpoint }) {
  const map = useMap();

  useEffect(() => {
    if (!routes || routes.length === 0) return;
    const allCoords = routes.flatMap((r) => r.geometry || []);
    if (allCoords.length === 0) return;
    const bounds = L.latLngBounds(allCoords);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [routes, map]);

  useEffect(() => {
    if (!activeCheckpoint || !map) return;
    map.panTo([activeCheckpoint.lat, activeCheckpoint.lon], { animate: true, duration: 0.6 });
  }, [activeCheckpoint, map]);

  return null;
}

function MapControls({ onFitBounds, activeLayer, onChangeLayer, showLegend, onToggleLegend }) {
  return (
    <div className="custom-map-controls" role="toolbar" aria-label="Map display controls">
      <div className="control-btn-group">
        <button
          type="button"
          className="map-ctrl-btn"
          onClick={onFitBounds}
          title="Zoom to fit all routes"
          aria-label="Fit all routes in view"
        >
          <Icon name="maximize" size={16} />
          <span className="ctrl-tooltip">Fit Corridor</span>
        </button>

        <button
          type="button"
          className={`map-ctrl-btn ${showLegend ? "active" : ""}`}
          onClick={onToggleLegend}
          title="Toggle route legend"
          aria-label="Toggle route and risk legend"
        >
          <Icon name="compass" size={16} />
          <span className="ctrl-tooltip">Legend</span>
        </button>
      </div>

      <div className="layer-picker-group">
        {Object.entries(BASE_LAYERS).map(([key, val]) => (
          <button
            key={key}
            type="button"
            className={`layer-chip ${activeLayer === key ? "active" : ""}`}
            onClick={() => onChangeLayer(key)}
            title={`Switch to ${val.name} basemap`}
          >
            {key.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function createEndpointIcon(letter, type = "origin") {
  const isOrigin = type === "origin";
  return L.divIcon({
    className: `custom-endpoint-marker ${isOrigin ? "origin-marker" : "dest-marker"}`,
    html: `
      <div class="marker-pin-wrap">
        <div class="marker-badge">${letter}</div>
        <div class="marker-arrow"></div>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 38],
    popupAnchor: [0, -38],
  });
}

export default function MapView({
  result,
  selectedId,
  onSelect,
  hour,
  showHeat,
  theme,
  activeCheckpoint,
  onSelectCheckpoint,
}) {
  const [baseLayer, setBaseLayer] = useState(theme === "dark" ? "dark" : "light");
  const [showLegend, setShowLegend] = useState(true);
  const mapInstanceRef = useRef(null);

  // Sync default layer with theme change
  useEffect(() => {
    setBaseLayer(theme === "dark" ? "dark" : "light");
  }, [theme]);

  const routes = result?.routes || [];

  // Sort so the selected route is drawn on top
  const orderedRoutes = useMemo(() => {
    return [...routes].sort((a, b) => (a.id === selectedId) - (b.id === selectedId));
  }, [routes, selectedId]);

  const selectedRoute = useMemo(() => {
    return routes.find((r) => r.id === selectedId) || routes[0];
  }, [routes, selectedId]);

  function handleFitAll() {
    if (!mapInstanceRef.current || routes.length === 0) return;
    const allCoords = routes.flatMap((r) => r.geometry || []);
    if (allCoords.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
    }
  }

  const originCoords = routes[0]?.geometry?.[0];
  const destCoords = routes[0]?.geometry?.[routes[0]?.geometry?.length - 1];

  return (
    <div className="map-wrapper" role="region" aria-label="Interactive Freight Map">
      <MapContainer
        ref={mapInstanceRef}
        center={[39.5, -98.35]}
        zoom={4}
        className="leaflet-root-map"
        preferCanvas
        zoomControl={false}
      >
        <TileLayer
          key={baseLayer}
          attribution={BASE_LAYERS[baseLayer].attribution}
          url={BASE_LAYERS[baseLayer].url}
          maxZoom={19}
        />

        <FitRoutesHandler routes={routes} activeCheckpoint={activeCheckpoint} />

        {/* Weather corridor heatmap layer */}
        {routes.length > 0 && <HeatCorridor routes={routes} hour={hour} visible={showHeat} />}

        {/* Route Polylines */}
        {orderedRoutes.map((r) => {
          const isSel = r.id === selectedId;
          const color = ROUTE_COLORS[(r.id - 1) % 3];
          return (
            <React.Fragment key={`route-poly-${r.id}`}>
              {/* Outer casing for selected route */}
              {isSel && (
                <Polyline
                  positions={r.geometry}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 9,
                    opacity: 0.9,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                  interactive={false}
                />
              )}
              <Polyline
                positions={r.geometry}
                pathOptions={{
                  color,
                  weight: isSel ? 6 : 3.5,
                  opacity: isSel ? 1 : 0.6,
                  dashArray: isSel ? null : "6 7",
                  lineCap: "round",
                  lineJoin: "round",
                }}
                eventHandlers={{
                  click: () => onSelect(r.id),
                }}
              >
                <Tooltip sticky direction="top" offset={[0, -10]}>
                  <strong>{r.name}</strong> · {Math.round(r.distance_mi)} mi
                </Tooltip>
              </Polyline>
            </React.Fragment>
          );
        })}

        {/* Checkpoint Markers (show for all routes, emphasized on selected) */}
        {orderedRoutes.map((r) => {
          const isRouteSel = r.id === selectedId;
          return r.checkpoints.map((c, idx) => {
            const isDanger = c.level >= 3;
            const isHigh = c.level === 2;
            const isCpActive = activeCheckpoint && activeCheckpoint.lat === c.lat && activeCheckpoint.lon === c.lon;

            return (
              <CircleMarker
                key={`${r.id}-${c.mile}-${idx}`}
                center={[c.lat, c.lon]}
                radius={isCpActive ? 9 : isRouteSel ? (isDanger ? 8 : 6) : 3.5}
                pathOptions={{
                  color: isCpActive ? "#000" : "#ffffff",
                  weight: isCpActive ? 3 : isRouteSel ? 2 : 1,
                  fillColor: LEVEL_COLORS[c.level],
                  fillOpacity: isRouteSel ? 1 : 0.65,
                }}
                eventHandlers={{
                  click: () => {
                    onSelect(r.id);
                    onSelectCheckpoint?.(c);
                  },
                }}
              >
                <Popup className="custom-checkpoint-popup">
                  <div className="popup-card">
                    <div className="popup-top">
                      <span className="popup-route-tag" style={{ background: ROUTE_COLORS[(r.id - 1) % 3] }}>
                        {r.name}
                      </span>
                      <span className="popup-mile-tag">Mile {Math.round(c.mile)}</span>
                    </div>

                    <div className="popup-eta">
                      <Icon name="clock" size={13} />
                      <span>Truck ETA: <strong>{fmtTime(c.eta)}</strong></span>
                    </div>

                    <div className="popup-weather-grid">
                      <div className="popup-metric">
                        <span className="p-label"><Icon name="wind" size={12} /> Wind</span>
                        <span className="p-val">{c.wind_mph} mph</span>
                      </div>
                      <div className="popup-metric">
                        <span className="p-label"><Icon name="rain" size={12} /> Precip</span>
                        <span className="p-val">
                          {c.snow_in_hr > 0
                            ? `${c.snow_in_hr} in/hr snow`
                            : c.rain_in_hr > 0
                            ? `${c.rain_in_hr} in/hr rain`
                            : "None"}
                        </span>
                      </div>
                      <div className="popup-metric">
                        <span className="p-label"><Icon name="thermometer" size={12} /> Temp</span>
                        <span className="p-val">{c.temp_f}°F</span>
                      </div>
                      <div className="popup-metric">
                        <span className="p-label">Risk</span>
                        <span className="p-badge" style={{ background: LEVEL_COLORS[c.level], color: "#fff" }}>
                          {c.level_name}
                        </span>
                      </div>
                    </div>

                    {c.reasons && c.reasons.length > 0 && (
                      <div className="popup-reasons">
                        <div className="reasons-heading">Risk Classification Triggers:</div>
                        {c.reasons.map((reason, ri) => (
                          <div key={ri} className="popup-reason-line">
                            <Icon name="alert-triangle" size={12} />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          });
        })}

        {/* Origin & Destination Markers */}
        {originCoords && (
          <Marker position={originCoords} icon={createEndpointIcon("A", "origin")}>
            <Popup>
              <div className="endpoint-popup">
                <strong>Origin (A)</strong>
                <p>{result.routes[0]?.origin_label || "Trip Start"}</p>
              </div>
            </Popup>
          </Marker>
        )}
        {destCoords && (
          <Marker position={destCoords} icon={createEndpointIcon("B", "destination")}>
            <Popup>
              <div className="endpoint-popup">
                <strong>Destination (B)</strong>
                <p>{result.routes[0]?.dest_label || "Trip Finish"}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Floating Map Controls */}
      <MapControls
        onFitBounds={handleFitAll}
        activeLayer={baseLayer}
        onChangeLayer={setBaseLayer}
        showLegend={showLegend}
        onToggleLegend={() => setShowLegend((v) => !v)}
      />

      {/* Floating Route Legend */}
      {showLegend && routes.length > 0 && (
        <div className="floating-legend-card" role="complementary" aria-label="Map route legend">
          <div className="legend-title-row">
            <span className="legend-title">Route Alternatives</span>
            <button
              type="button"
              className="legend-close-btn"
              onClick={() => setShowLegend(false)}
              aria-label="Close legend"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
          <div className="legend-routes-list">
            {routes.map((r) => {
              const isSel = r.id === selectedId;
              const color = ROUTE_COLORS[(r.id - 1) % 3];
              return (
                <div
                  key={r.id}
                  className={`legend-route-item ${isSel ? "active" : ""}`}
                  onClick={() => onSelect(r.id)}
                >
                  <span className="legend-route-line" style={{ background: color }} />
                  <span className="legend-route-name">{r.name}</span>
                  <span className="legend-route-dist">{Math.round(r.distance_mi)} mi</span>
                  {r.id === result?.recommended_id && <span className="rec-dot" title="Recommended" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
