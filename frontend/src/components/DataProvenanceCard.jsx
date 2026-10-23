import React, { useState } from "react";
import { fmtTime } from "../risk.js";
import { Icon } from "./Icons.jsx";

export default function DataProvenanceCard({ provenance, onRefresh, loading }) {
  const [expanded, setExpanded] = useState(false);

  if (!provenance) return null;

  const isLive = provenance.cache_status === "live_fetch";
  const hasWarnings = provenance.warnings && provenance.warnings.length > 0;
  const hasUnknown = provenance.has_unknown_data;

  return (
    <div className={`provenance-card ${hasWarnings || hasUnknown ? "has-advisory" : ""}`}>
      <div className="provenance-header">
        <div className="provenance-title-area">
          <div className={`provenance-status-dot ${isLive ? "is-live" : "is-cached"}`} />
          <div className="provenance-title-text">
            <span className="provenance-label">Weather Data Provenance & Freshness</span>
            <span className="provenance-sub">
              {provenance.provider || "Open-Meteo NWP"} ·{" "}
              {isLive ? (
                <strong className="text-success">Live Forecast Data</strong>
              ) : (
                <strong className="text-accent">Cached Model Data</strong>
              )}
            </span>
          </div>
        </div>

        <div className="provenance-actions">
          <button
            type="button"
            className="provenance-refresh-btn"
            onClick={onRefresh}
            disabled={loading}
            title="Bypass server cache and fetch fresh numerical weather prediction data"
          >
            <Icon name="refresh-cw" size={13} className={loading ? "spin-icon" : ""} />
            <span>{loading ? "Refreshing..." : "Force Refresh"}</span>
          </button>

          <button
            type="button"
            className="provenance-toggle-btn"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            title={expanded ? "Hide metadata details" : "Show detailed provenance metadata"}
          >
            <Icon name={expanded ? "chevron-up" : "chevron-down"} size={14} />
          </button>
        </div>
      </div>

      {/* Provenance Quick Badges */}
      <div className="provenance-badges-row">
        <span className="prov-chip">
          <Icon name="clock" size={12} />
          <span>Retrieved: <strong>{fmtTime(provenance.retrieved_at)}</strong></span>
        </span>

        {provenance.model_base_time && (
          <span className="prov-chip">
            <Icon name="compass" size={12} />
            <span>NWP Model Base: <strong>{fmtTime(provenance.model_base_time)}</strong></span>
          </span>
        )}

        <span className="prov-chip">
          <Icon name="shield-check" size={12} />
          <span>Confidence: <strong>{provenance.confidence || "High NWP"}</strong></span>
        </span>

        <span className="prov-chip">
          <Icon name="calendar" size={12} />
          <span>Horizon: <strong>{provenance.horizon_days || 15} Days</strong></span>
        </span>
      </div>

      {/* Warnings & Advisories */}
      {(hasWarnings || hasUnknown) && (
        <div className="provenance-advisory-banner" role="alert">
          <Icon name="alert-triangle" size={14} />
          <div className="advisory-content">
            <strong>Forecast Advisories:</strong>
            <ul>
              {hasUnknown && (
                <li>
                  Route traverses segments with missing/partial weather observations. These are flagged as <strong>Unknown Risk</strong> and never treated as Low risk.
                </li>
              )}
              {provenance.warnings?.map((w, wi) => (
                <li key={wi}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Expandable Technical Metadata */}
      {expanded && (
        <div className="provenance-details-drawer">
          <div className="drawer-grid">
            <div className="drawer-item">
              <span className="drawer-label">Valid Forecast Start:</span>
              <span className="drawer-val">{fmtTime(provenance.forecast_valid_start)}</span>
            </div>
            <div className="drawer-item">
              <span className="drawer-label">Valid Forecast End:</span>
              <span className="drawer-val">{fmtTime(provenance.forecast_valid_end)}</span>
            </div>
            <div className="drawer-item">
              <span className="drawer-label">Cache State:</span>
              <span className="drawer-val">{provenance.cache_status}</span>
            </div>
            <div className="drawer-item">
              <span className="drawer-label">Hourly NWP Interpolation:</span>
              <span className="drawer-val">Coordinate-Specific Nearest-Neighbor Spatial Resolution</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
