import React, { useState } from "react";
import { Icon } from "./Icons.jsx";
import { fmtDuration } from "../risk.js";

export default function RouteTradeOffCard({ tradeOff, selectedRoute, departureTime }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!tradeOff) return null;

  const isSame = tradeOff.is_same_route;
  const timeMin = tradeOff.additional_travel_time_min || 0;
  const distMi = tradeOff.additional_distance_mi || 0;
  const riskRedMi = tradeOff.risk_reduction_mi || 0;
  const riskRedPct = tradeOff.risk_reduction_pct || 0;
  const avoided = tradeOff.avoided_hazards || [];

  return (
    <div className="trade-off-card" aria-label="Route Trade-Off and Feasibility Analysis">
      <div className="trade-off-header">
        <div className="trade-off-title-area">
          <div className="trade-off-icon-box">
            <Icon name="compass" size={16} />
          </div>
          <div>
            <h4 className="trade-off-title">Route Trade-Off & Safety Analysis</h4>
            <span className="trade-off-subtitle">
              Evaluating transit duration, road distance, and weather hazard mitigation
            </span>
          </div>
        </div>

        <button
          type="button"
          className="trade-off-toggle-btn"
          onClick={() => setShowDetails(!showDetails)}
          aria-expanded={showDetails}
          title={showDetails ? "Collapse trade-off details" : "Expand trade-off details"}
        >
          <span>{showDetails ? "Hide Explanations" : "View Explanations"}</span>
          <Icon name={showDetails ? "chevron-up" : "chevron-down"} size={14} />
        </button>
      </div>

      {/* Trade-Off Core Comparison Grid */}
      <div className="trade-off-metrics-grid">
        <div className="trade-metric-tile">
          <span className="tm-label">Fastest vs. Safer Choice</span>
          <div className="tm-val-row">
            <span className="tm-val font-semibold">
              {tradeOff.fastest_route_name}
            </span>
            <span className="tm-arrow">→</span>
            <span className="tm-val text-success font-semibold">
              {tradeOff.recommended_route_name}
            </span>
          </div>
          <span className="tm-sub">
            {isSame ? "Fastest is also the safest" : "Safer alternative prioritized"}
          </span>
        </div>

        <div className="trade-metric-tile">
          <span className="tm-label">Risk-Mile Reduction</span>
          <div className="tm-val-row">
            <span className={`tm-val ${riskRedMi > 0 ? "text-success" : ""}`}>
              {riskRedMi > 0 ? `-${riskRedMi} mi` : "0.0 mi"}
            </span>
            {riskRedPct > 0 && (
              <span className="tm-badge-pct">
                -{riskRedPct}%
              </span>
            )}
          </div>
          <span className="tm-sub">
            {riskRedMi > 0 ? "Elevated weather risk avoided" : "Minimal weather variance"}
          </span>
        </div>

        <div className="trade-metric-tile">
          <span className="tm-label">Transit Time Impact</span>
          <div className="tm-val-row">
            <span className="tm-val">
              {timeMin > 0 ? `+${timeMin} min` : timeMin < 0 ? `${timeMin} min (faster)` : "0 min"}
            </span>
          </div>
          <span className="tm-sub">
            {timeMin > 0 ? "Extra driving time vs fastest" : "No travel time penalty"}
          </span>
        </div>

        <div className="trade-metric-tile">
          <span className="tm-label">Distance Variance</span>
          <div className="tm-val-row">
            <span className="tm-val">
              {distMi > 0 ? `+${distMi} mi` : distMi < 0 ? `${distMi} mi` : "0.0 mi"}
            </span>
          </div>
          <span className="tm-sub">
            {distMi > 0 ? "Highway detour distance" : "Optimal highway path"}
          </span>
        </div>
      </div>

      {/* Avoided Major Hazards Chips */}
      {avoided.length > 0 && (
        <div className="avoided-hazards-bar">
          <span className="avoided-label">
            <Icon name="shield-check" size={13} className="text-success" />
            <span>Hazards Mitigated by Recommended Route:</span>
          </span>
          <div className="avoided-chips-list">
            {avoided.map((h, idx) => (
              <span key={`avoided-${idx}`} className="avoided-chip">
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Narrative Explanations (Expandable or Default View) */}
      <div className="trade-off-narrative-section">
        <div className="narrative-block">
          <strong className="narrative-heading">
            <Icon name="check" size={13} className="text-success" />
            <span>Why This Route Is Recommended:</span>
          </strong>
          <p className="narrative-text">{tradeOff.why_recommended}</p>
        </div>

        {!isSame && tradeOff.why_shortest_not_recommended && (
          <div className="narrative-block">
            <strong className="narrative-heading">
              <Icon name="info" size={13} className="text-accent" />
              <span>Why The Shortest / Fastest Route Was Not Selected:</span>
            </strong>
            <p className="narrative-text">{tradeOff.why_shortest_not_recommended}</p>
          </div>
        )}

        {showDetails && (
          <div className="trade-off-expanded-panel">
            <div className="narrative-block">
              <strong className="narrative-heading">
                <Icon name="clock" size={13} />
                <span>Weather & ETA Impact Methodology:</span>
              </strong>
              <p className="narrative-text">{tradeOff.weather_eta_impact_explanation}</p>
            </div>

            <div className="narrative-block">
              <strong className="narrative-heading">
                <Icon name="compass" size={13} />
                <span>Risk Mile Definition:</span>
              </strong>
              <p className="narrative-text">{tradeOff.methodology}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
