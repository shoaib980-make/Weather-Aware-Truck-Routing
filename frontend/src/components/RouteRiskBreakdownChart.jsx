import React from "react";
import { ROUTE_COLORS } from "../risk.js";
import { Icon } from "./Icons.jsx";

const HAZARD_CONFIG = [
  { key: "high_wind_miles", label: "High Winds", color: "#f97316", icon: "wind" },
  { key: "heavy_rain_miles", label: "Heavy Rain", color: "#2563eb", icon: "rain" },
  { key: "snow_ice_miles", label: "Snow & Ice", color: "#06b6d4", icon: "snow" },
  { key: "severe_conditions_miles", label: "Severe Storms", color: "#ef4444", icon: "alert-triangle" },
  { key: "unknown_weather_miles", label: "Incomplete/Unknown", color: "#64748b", icon: "info" },
];

export default function RouteRiskBreakdownChart({ routes, selectedId, onSelect }) {
  if (!routes || routes.length === 0) return null;

  // Find maximum route distance to standardize scales
  const maxDist = Math.max(...routes.map((r) => r.distance_mi || 1));

  return (
    <div className="risk-chart-card" role="region" aria-label="Route Weather Hazard Exposure Comparison">
      <div className="chart-header">
        <div>
          <h4 className="chart-title">Physical Hazard Exposure Breakdown</h4>
          <span className="chart-subtitle">
            Measured road miles subject to specific adverse atmospheric conditions
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="hazard-chart-legend" role="list">
        {HAZARD_CONFIG.map((hz) => (
          <div key={hz.key} className="hazard-legend-item" role="listitem">
            <span className="hazard-legend-swatch" style={{ background: hz.color }} />
            <span className="hazard-legend-text">{hz.label}</span>
          </div>
        ))}
      </div>

      {/* Route Hazard Bars */}
      <div className="chart-bars-list">
        {routes.map((r) => {
          const m = r.trade_off_metrics || {};
          const hb = m.hazard_breakdown || {};
          const isSel = r.id === selectedId;
          const routeColor = ROUTE_COLORS[(r.id - 1) % 3];

          // Compute total hazard miles
          const totalHazardMi = Object.values(hb).reduce((a, b) => a + b, 0);

          return (
            <div
              key={`chart-r-${r.id}`}
              className={`chart-route-row ${isSel ? "is-selected-row" : ""}`}
              onClick={() => onSelect?.(r.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(r.id);
                }
              }}
            >
              <div className="chart-route-label">
                <span className="chart-route-stripe" style={{ background: routeColor }} />
                <span className="chart-route-name">{r.name}</span>
                {m.is_recommended && <span className="mini-badge-rec">Rec</span>}
              </div>

              <div className="chart-bar-container">
                <div className="chart-stacked-bar">
                  {HAZARD_CONFIG.map((hz) => {
                    const val = hb[hz.key] || 0;
                    if (val <= 0) return null;
                    const pct = Math.max(1.5, (val / maxDist) * 100);

                    return (
                      <div
                        key={hz.key}
                        className="chart-hazard-segment"
                        style={{ width: `${pct}%`, background: hz.color }}
                        title={`${r.name} - ${hz.label}: ${val.toFixed(1)} mi (${pct.toFixed(1)}% of corridor)`}
                      />
                    );
                  })}
                </div>

                <div className="chart-bar-meta">
                  <span className="chart-meta-hazard">
                    {totalHazardMi > 0 ? (
                      <strong>{totalHazardMi.toFixed(1)} mi hazard exposure</strong>
                    ) : (
                      <span className="text-success font-semibold">0.0 mi hazard exposure</span>
                    )}
                  </span>
                  <span className="chart-meta-total">
                    ({Math.round(r.distance_mi)} mi total)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Screen reader textual alternative */}
      <div className="sr-only">
        <h5>Textual Hazard Summary:</h5>
        <ul>
          {routes.map((r) => {
            const hb = r.trade_off_metrics?.hazard_breakdown || {};
            return (
              <li key={`sr-${r.id}`}>
                {r.name}: High Winds {hb.high_wind_miles || 0} mi, Heavy Rain {hb.heavy_rain_miles || 0} mi,
                Snow/Ice {hb.snow_ice_miles || 0} mi, Severe Storms {hb.severe_conditions_miles || 0} mi.
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
