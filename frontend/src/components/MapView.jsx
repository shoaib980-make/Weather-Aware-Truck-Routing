import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import HeatCorridor from "./HeatCorridor.jsx";
import { LEVEL_COLORS, ROUTE_COLORS, fmtTime } from "../risk.js";

function FitRoutes({ routes }) {
  const map = useMap();
  useEffect(() => {
    if (!routes.length) return;
    const bounds = L.latLngBounds(routes.flatMap((r) => r.geometry));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [routes, map]);
  return null;
}

function endpointIcon(text) {
  return L.divIcon({ className: "endpoint", html: `<span>${text}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}

export default function MapView({ result, selectedId, onSelect, hour, showHeat }) {
  const routes = result?.routes || [];
  const ordered = [...routes].sort((a, b) => (a.id === selectedId) - (b.id === selectedId)); // selected drawn last

  return (
    <MapContainer center={[39.5, -98.35]} zoom={4} className="map" preferCanvas>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <FitRoutes routes={routes} />
      {routes.length > 0 && <HeatCorridor routes={routes} hour={hour} visible={showHeat} />}

      {ordered.map((r) => {
        const sel = r.id === selectedId;
        const color = ROUTE_COLORS[(r.id - 1) % 3];
        return (
          <Polyline
            key={r.id}
            positions={r.geometry}
            pathOptions={{ color, weight: sel ? 6 : 4, opacity: sel ? 0.95 : 0.55, dashArray: sel ? null : "8 8" }}
            eventHandlers={{ click: () => onSelect(r.id) }}
          />
        );
      })}

      {ordered.map((r) =>
        r.checkpoints.map((c) => {
          const sel = r.id === selectedId;
          return (
            <CircleMarker
              key={`${r.id}-${c.mile}`}
              center={[c.lat, c.lon]}
              radius={sel ? 7 : 4}
              pathOptions={{ color: "#fff", weight: sel ? 2 : 1, fillColor: LEVEL_COLORS[c.level], fillOpacity: sel ? 1 : 0.8 }}
              eventHandlers={{ click: () => onSelect(r.id) }}
            >
              <Popup>
                <div className="popup">
                  <strong>{r.name}: mile {Math.round(c.mile)}</strong>
                  <div>ETA {fmtTime(c.eta)}</div>
                  <div>Wind {c.wind_mph} mph · Rain {c.rain_in_hr} in/hr · Snow {c.snow_in_hr} in/hr · {c.temp_f}°F</div>
                  <div className="pill" style={{ background: LEVEL_COLORS[c.level] }}>{c.level_name}</div>
                  {c.reasons.map((x) => <div key={x} className="reason">{x}</div>)}
                </div>
              </Popup>
            </CircleMarker>
          );
        })
      )}

      {routes[0] && (
        <>
          <Marker position={routes[0].geometry[0]} icon={endpointIcon("A")} />
          <Marker position={routes[0].geometry[routes[0].geometry.length - 1]} icon={endpointIcon("B")} />
        </>
      )}
    </MapContainer>
  );
}
