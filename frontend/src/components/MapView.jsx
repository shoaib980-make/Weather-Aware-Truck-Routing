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

function FitRoutesHandler({ routes, origin, destination, activeCheckpoint, isVisible, isSliderCollapsed }) {
  const map = useMap();

  const fitCorridor = React.useCallback(() => {
    if (!map) return false;
    map.invalidateSize({ pan: false });
    const size = map.getSize();
    if (!size || size.x <= 20 || size.y <= 20) {
      // Container not yet measured or still hidden in layout
      return false;
    }

    const isMobile = typeof window !== "undefined" && window.innerWidth <= 900;
    // Smart asymmetrical padding:
    // On mobile, clear top corridor switcher bar (100px) and bottom HeatSlider (collapsed: 75px, open: 195px)
    const padTop = isMobile ? 105 : 55;
    const padBottom = isMobile ? (isSliderCollapsed ? 75 : 195) : 125;
    const padSide = isMobile ? 24 : 50;

    const fitOpts = {
      paddingTopLeft: [padSide, padTop],
      paddingBottomRight: [padSide, padBottom],
      maxZoom: 13,
      animate: isVisible,
    };

    if (routes && routes.length > 0) {
      const allCoords = routes.flatMap((r) => r.geometry || []);
      if (origin?.lat && origin?.lon) allCoords.push([origin.lat, origin.lon]);
      if (destination?.lat && destination?.lon) allCoords.push([destination.lat, destination.lon]);

      if (allCoords.length > 0) {
        map.fitBounds(L.latLngBounds(allCoords), fitOpts);
        return true;
      }
    } else if (origin?.lat && origin?.lon && destination?.lat && destination?.lon) {
      const bounds = L.latLngBounds([
        [origin.lat, origin.lon],
        [destination.lat, destination.lon],
      ]);
      map.fitBounds(bounds, { ...fitOpts, maxZoom: 11 });
      return true;
    } else if (origin?.lat && origin?.lon) {
      map.setView([origin.lat, origin.lon], 9, { animate: true });
      return true;
    } else if (destination?.lat && destination?.lon) {
      map.setView([destination.lat, destination.lon], 9, { animate: true });
      return true;
    }
    return false;
  }, [map, routes, origin, destination, isVisible, isSliderCollapsed]);

  // Robust multi-stage trigger: fits immediately and retries as DOM reflow completes
  useEffect(() => {
    if (!map) return;
    if (isVisible) {
      if (!fitCorridor()) {
        const t1 = setTimeout(fitCorridor, 60);
        const t2 = setTimeout(fitCorridor, 200);
        const t3 = setTimeout(fitCorridor, 500);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
        };
      } else {
        // Also schedule a micro backup in case of mobile browser dynamic URL bar shift
        const tBackup = setTimeout(fitCorridor, 250);
        return () => clearTimeout(tBackup);
      }
    }
  }, [isVisible, routes, origin, destination, isSliderCollapsed, fitCorridor]);

  // Window resize and device orientation change listener
  useEffect(() => {
    if (!map) return;
    const handleResize = () => {
      fitCorridor();
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [map, fitCorridor]);

  useEffect(() => {
    if (!activeCheckpoint || !map) return;
    map.panTo([activeCheckpoint.lat, activeCheckpoint.lon], { animate: true, duration: 0.6 });
  }, [activeCheckpoint, map]);

  return null;
}

function MapControls({ onFitBounds, activeLayer, onChangeLayer, showLegend, onToggleLegend, hasRoutes }) {
  return (
    <div className="custom-map-controls" role="toolbar" aria-label="Map display controls">
      <div className="control-btn-group">
        <button
          type="button"
          className="map-ctrl-btn"
          onClick={onFitBounds}
          title="Zoom to fit all routes / corridor"
          aria-label="Fit corridor in view"
        >
          <Icon name="maximize" size={16} />
          <span className="ctrl-tooltip">Fit View</span>
        </button>

        {hasRoutes && (
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
        )}
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
  const badgeClass = isOrigin ? "origin-pin" : "dest-pin";
  const subText = isOrigin ? "START" : "END";
  return L.divIcon({
    className: `custom-endpoint-marker ${badgeClass}`,
    html: `
      <div class="endpoint-marker-pin ${badgeClass}">
        <div class="pin-head">
          <span class="pin-letter">${letter}</span>
          <span class="pin-subtext">${subText}</span>
        </div>
        <div class="pin-arrow"></div>
      </div>
    `,
    iconSize: [38, 48],
    iconAnchor: [19, 46],
    popupAnchor: [0, -44],
  });
}

function PaneSetup() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (!map.getPane("route-alternatives")) {
      const altPane = map.createPane("route-alternatives");
      altPane.style.zIndex = "420";
    }
    if (!map.getPane("route-selected-casing")) {
      const casingPane = map.createPane("route-selected-casing");
      casingPane.style.zIndex = "470";
    }
    if (!map.getPane("route-selected")) {
      const selPane = map.createPane("route-selected");
      selPane.style.zIndex = "480";
    }
    if (!map.getPane("checkpoints-pane")) {
      const cpPane = map.createPane("checkpoints-pane");
      cpPane.style.zIndex = "550";
    }
  }, [map]);
  return null;
}

function MapBridge({ onMapReady }) {
  const map = useMap();
  useEffect(() => {
    if (map && onMapReady) onMapReady(map);
  }, [map, onMapReady]);
  return null;
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
  origin,
  destination,
  lastPayload,
  isVisible,
  isSliderCollapsed,
}) {
  const [baseLayer, setBaseLayer] = useState(theme === "dark" ? "dark" : "light");
  const [showLegend, setShowLegend] = useState(true);
  const [mapInstance, setMapInstance] = useState(null);
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

  // Resolve origin and destination coordinates
  const effectiveOrigin = origin || lastPayload?.origin;
  const effectiveDest = destination || lastPayload?.destination;

  const originLat = effectiveOrigin?.lat ?? routes[0]?.geometry?.[0]?.[0];
  const originLon = effectiveOrigin?.lon ?? routes[0]?.geometry?.[0]?.[1];
  const originCoords = (originLat != null && originLon != null) ? [originLat, originLon] : null;
  const originLabel = effectiveOrigin?.label || "Trip Start / Origin";

  const lastGeomIdx = routes[0]?.geometry ? routes[0].geometry.length - 1 : 0;
  const destLat = effectiveDest?.lat ?? routes[0]?.geometry?.[lastGeomIdx]?.[0];
  const destLon = effectiveDest?.lon ?? routes[0]?.geometry?.[lastGeomIdx]?.[1];
  const destCoords = (destLat != null && destLon != null) ? [destLat, destLon] : null;
  const destLabel = effectiveDest?.label || "Trip Finish / Destination";

  function handleFitAll() {
    const map = mapInstance || mapInstanceRef.current;
    if (!map) return;
    map.invalidateSize({ pan: false });
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 900;
    const padTop = isMobile ? 105 : 55;
    const padBottom = isMobile ? (isSliderCollapsed ? 75 : 195) : 125;
    const padSide = isMobile ? 24 : 50;

    const fitOpts = {
      paddingTopLeft: [padSide, padTop],
      paddingBottomRight: [padSide, padBottom],
      maxZoom: 13,
      animate: true,
    };

    if (routes.length > 0) {
      const allCoords = routes.flatMap((r) => r.geometry || []);
      if (originCoords) allCoords.push(originCoords);
      if (destCoords) allCoords.push(destCoords);
      if (allCoords.length > 0) {
        map.fitBounds(L.latLngBounds(allCoords), fitOpts);
      }
    } else if (originCoords && destCoords) {
      map.fitBounds(L.latLngBounds([originCoords, destCoords]), fitOpts);
    }
  }

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
        <MapBridge onMapReady={setMapInstance} />
        <PaneSetup />

        <TileLayer
          key={baseLayer}
          attribution={BASE_LAYERS[baseLayer].attribution}
          url={BASE_LAYERS[baseLayer].url}
          maxZoom={19}
        />

        <FitRoutesHandler
          routes={routes}
          origin={effectiveOrigin}
          destination={effectiveDest}
          activeCheckpoint={activeCheckpoint}
          isVisible={isVisible}
          isSliderCollapsed={isSliderCollapsed}
        />

        {/* Weather corridor heatmap layer (rendered strictly in heat pane, zIndex 350) */}
        {routes.length > 0 && <HeatCorridor routes={routes} hour={hour} visible={showHeat} />}

        {/* Route Polylines: Selected Route rendered in zIndex 470/480; Alternatives in zIndex 420 */}
        {routes.map((r) => {
          const isSel = r.id === selectedId;
          const color = ROUTE_COLORS[(r.id - 1) % 3];
          const isDarkMap = baseLayer === "dark" || theme === "dark";

          if (isSel) {
            return (
              <React.Fragment key={`selected-route-grp-${r.id}`}>
                {/* High-contrast outer casing strictly in casing pane (zIndex 470) */}
                <Polyline
                  pane="route-selected-casing"
                  key={`casing-${r.id}`}
                  positions={r.geometry}
                  pathOptions={{
                    color: isDarkMap ? "#ffffff" : "#0f172a",
                    weight: 9.5,
                    opacity: isDarkMap ? 0.95 : 0.85,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                  interactive={false}
                />
                {/* Selected route core colored line strictly in selected pane (zIndex 480) */}
                <Polyline
                  pane="route-selected"
                  key={`selected-route-${r.id}`}
                  positions={r.geometry}
                  pathOptions={{
                    color,
                    weight: 6,
                    opacity: 1,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                  eventHandlers={{
                    click: () => onSelect(r.id),
                  }}
                >
                  <Tooltip sticky direction="top" offset={[0, -10]}>
                    <strong>{r.name} (Selected)</strong> · {Math.round(r.distance_mi)} mi
                  </Tooltip>
                </Polyline>
              </React.Fragment>
            );
          }

          // Unselected alternative route strictly in alternatives pane (zIndex 420)
          return (
            <Polyline
              pane="route-alternatives"
              key={`alt-route-${r.id}`}
              positions={r.geometry}
              pathOptions={{
                color,
                weight: 4.5,
                opacity: 0.65,
                dashArray: "6 6",
                lineCap: "round",
                lineJoin: "round",
              }}
              eventHandlers={{
                click: () => onSelect(r.id),
              }}
            >
              <Tooltip sticky direction="top" offset={[0, -10]}>
                <strong>{r.name}</strong> · Tap to select · {Math.round(r.distance_mi)} mi
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Checkpoint Markers (pane: "checkpoints-pane", zIndex: 550) */}
        {routes.map((r) => {
          const isRouteSel = r.id === selectedId;
          return r.checkpoints.map((c, idx) => {
            const isDanger = c.level >= 3;
            const isHigh = c.level === 2;
            const isCpActive = activeCheckpoint && activeCheckpoint.lat === c.lat && activeCheckpoint.lon === c.lon;

            return (
              <CircleMarker
                pane="checkpoints-pane"
                key={`cp-${r.id}-${c.mile}-${idx}-${isRouteSel ? "sel" : "alt"}`}
                center={[c.lat, c.lon]}
                radius={isCpActive ? 9.5 : isRouteSel ? (isDanger ? 7.5 : 5.5) : 3.5}
                pathOptions={{
                  color: isCpActive ? "#000000" : isRouteSel ? "#ffffff" : "rgba(255,255,255,0.7)",
                  weight: isCpActive ? 3.5 : isRouteSel ? 2 : 1,
                  fillColor: LEVEL_COLORS[c.level],
                  fillOpacity: isRouteSel ? 1 : 0.6,
                }}
                eventHandlers={{
                  click: () => {
                    onSelect(r.id);
                    onSelectCheckpoint?.(c);
                  },
                }}
              >
                <Popup className="custom-checkpoint-popup" autoPanPadding={[20, 20]} maxWidth={320}>
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

        {/* Origin (A) Marker with Authentic Place Name */}
        {originCoords && (
          <Marker position={originCoords} icon={createEndpointIcon("A", "origin")}>
            <Tooltip permanent={false} direction="top" offset={[0, -44]}>
              <strong>Origin (A):</strong> {originLabel.split(",")[0]}
            </Tooltip>
            <Popup className="custom-endpoint-popup-wrap" autoPanPadding={[20, 20]} maxWidth={320}>
              <div className="endpoint-popup origin-popup">
                <div className="endpoint-badge origin-badge">
                  <Icon name="truck" size={13} />
                  <span>ORIGIN (START)</span>
                </div>
                <strong className="endpoint-title">{originLabel}</strong>
                <span className="endpoint-coords">
                  Coordinates: {originCoords[0].toFixed(4)}°, {originCoords[1].toFixed(4)}°
                </span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination (B) Marker with Authentic Place Name */}
        {destCoords && (
          <Marker position={destCoords} icon={createEndpointIcon("B", "destination")}>
            <Tooltip permanent={false} direction="top" offset={[0, -44]}>
              <strong>Destination (B):</strong> {destLabel.split(",")[0]}
            </Tooltip>
            <Popup className="custom-endpoint-popup-wrap" autoPanPadding={[20, 20]} maxWidth={320}>
              <div className="endpoint-popup dest-popup">
                <div className="endpoint-badge dest-badge">
                  <Icon name="map-pin" size={13} />
                  <span>DESTINATION (FINISH)</span>
                </div>
                <strong className="endpoint-title">{destLabel}</strong>
                <span className="endpoint-coords">
                  Coordinates: {destCoords[0].toFixed(4)}°, {destCoords[1].toFixed(4)}°
                </span>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Floating Map Controls & Route Alternatives Dock */}
      <div className="map-controls-dock" role="region" aria-label="Map controls and route selection">
        <MapControls
          onFitBounds={handleFitAll}
          activeLayer={baseLayer}
          onChangeLayer={setBaseLayer}
          showLegend={showLegend}
          onToggleLegend={() => setShowLegend((v) => !v)}
          hasRoutes={routes.length > 0}
        />

        {/* Floating Route Legend / Route Alternatives Selection */}
        {showLegend && routes.length > 0 && (
          <div className="floating-legend-card" role="complementary" aria-label="Route alternatives selection">
            <div className="legend-title-row">
              <span className="legend-title">Route Alternatives</span>
              <button
                type="button"
                className="legend-close-btn"
                onClick={() => setShowLegend(false)}
                aria-label="Close route alternatives"
                title="Hide route alternatives"
              >
                <Icon name="x" size={13} />
              </button>
            </div>
            <div className="legend-routes-list" role="radiogroup" aria-label="Route alternatives list">
              {routes.map((r) => {
                const isSel = r.id === selectedId;
                const isRec = r.id === result?.recommended_id;
                const color = ROUTE_COLORS[(r.id - 1) % 3];
                const sevMiles = r.stats?.severe_miles || 0;
                const noTravMiles = r.stats?.no_travel_miles || 0;

                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    className={`legend-route-item ${isSel ? "active" : ""}`}
                    onClick={() => onSelect(r.id)}
                  >
                    <div className="legend-route-main">
                      <span className="legend-route-line" style={{ background: color }} />
                      <span className="legend-route-name">{r.name}</span>
                      <span className="legend-route-dist">{Math.round(r.distance_mi)} mi</span>
                    </div>
                    <div className="legend-route-badges">
                      {isRec && <span className="rec-badge-pill" title="Recommended Safest Route">Safest</span>}
                      {noTravMiles > 0 ? (
                        <span className="route-badge-danger" title="No travel condition along route">No Travel</span>
                      ) : sevMiles > 0 ? (
                        <span className="route-badge-warn" title={`${sevMiles} miles severe weather`}>{sevMiles}m sev</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
