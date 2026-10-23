import React, { useState } from "react";
import {
  LEVELS,
  LEVEL_COLORS,
  ROUTE_COLORS,
  calcETA,
  fmtDuration,
  fmtTime,
  getRiskLevelBadge,
} from "../risk.js";
import { Icon } from "./Icons.jsx";
import RouteRiskTimeline from "./RouteRiskTimeline.jsx";
import DataProvenanceCard from "./DataProvenanceCard.jsx";

function MixBar({ miles }) {
  const total = Object.values(miles).reduce((a, b) => a + b, 0) || 1;
  return (
    <div
      className="mix-bar-wrap"
      role="img"
      aria-label={LEVELS.map((l) => `${l}: ${Math.round(miles[l])} mi`).join(", ")}
    >
      <div className="mix-bar-track">
        {LEVELS.map((lvl, idx) => {
          const val = miles[lvl] || 0;
          if (val <= 0) return null;
          const pct = Math.max(1, (val / total) * 100);
          const isUnknown = lvl === "Unknown";
          const bg = isUnknown
            ? "repeating-linear-gradient(45deg, #64748b, #64748b 4px, #475569 4px, #475569 8px)"
            : LEVEL_COLORS[idx];
          return (
            <span
              key={lvl}
              className="mix-segment"
              style={{ width: `${pct}%`, background: bg }}
              title={`${lvl}: ${val.toFixed(1)} mi (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      <div className="mix-legend">
        {LEVELS.map((lvl, idx) => {
          const val = miles[lvl] || 0;
          if (val <= 0) return null;
          return (
            <span key={lvl} className="mix-legend-item">
              <span className="legend-dot" style={{ background: LEVEL_COLORS[idx] }} />
              <span className="legend-text">
                {lvl}: {val.toFixed(1)} mi
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function RouteCard({
  route,
  departureTime,
  selected,
  recommended,
  onSelect,
  onSelectCheckpoint,
}) {
  const s = route.stats;
  const ev = route.evaluation;
  const eta = calcETA(departureTime, route.duration_s);
  const color = ROUTE_COLORS[(route.id - 1) % 3];
  const hasNoTravel = (s.no_travel_miles || 0) > 0;
  const hasSevere = (s.severe_miles || 0) > 0;
  const hasUnknown = (s.unknown_miles || 0) > 0;

  return (
    <article
      className={`route-card-item ${selected ? "is-selected" : ""} ${recommended ? "is-recommended" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="route-card-header">
        <div className="route-id-group">
          <span className="route-color-stripe" style={{ background: color }} />
          <div>
            <h3 className="route-title">{route.name}</h3>
            {ev?.rank && (
              <span className="route-rank-indicator">
                {ev.is_recommended ? "Rank #1 — Recommended Route" : `Rank #${ev.rank} Alternative`}
              </span>
            )}
          </div>
        </div>
        <div className="route-badges">
          {recommended && (
            <span className="badge recommended-badge">
              <Icon name="shield-check" size={13} />
              <span>Recommended</span>
            </span>
          )}
          {hasNoTravel ? (
            <span className="badge no-travel-badge">
              <Icon name="alert-triangle" size={13} />
              <span>No Travel Zone</span>
            </span>
          ) : hasSevere ? (
            <span className="badge severe-badge">
              <Icon name="wind" size={13} />
              <span>Severe Winds</span>
            </span>
          ) : hasUnknown ? (
            <span className="badge unknown-badge">
              <Icon name="info" size={13} />
              <span>Unknown Risk Present</span>
            </span>
          ) : (
            <span className="badge clear-badge">
              <Icon name="check" size={13} />
              <span>Clear Corridor</span>
            </span>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="route-metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Distance</span>
          <span className="metric-val">{Math.round(route.distance_mi).toLocaleString()} mi</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Truck Drive Time</span>
          <span className="metric-val">{fmtDuration(route.duration_s)}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Projected Arrival</span>
          <span className="metric-val text-accent">{fmtTime(eta)}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Avg Weather Risk</span>
          <span className="metric-val">{s.avg_risk.toFixed(2)} / 4.0</span>
        </div>
      </div>

      {/* Rejection / Evaluation Explanation */}
      {ev && !ev.is_recommended && (
        <div className="rejection-explanation-box">
          <div className="rejection-title-row">
            <Icon name="info" size={13} />
            <strong className="rejection-title">Why Not Recommended:</strong>
          </div>
          <p className="rejection-body">{ev.rejection_reason || "Does not achieve optimal safety ranking."}</p>
          <div className="rejection-diffs">
            {ev.duration_diff_s > 60 && (
              <span className="diff-pill diff-time">
                +{Math.round(ev.duration_diff_s / 60)} min longer drive
              </span>
            )}
            {ev.severe_diff_mi > 0 && (
              <span className="diff-pill diff-severe">
                +{ev.severe_diff_mi} mi severe weather
              </span>
            )}
            {ev.high_diff_mi > 0 && (
              <span className="diff-pill diff-high">
                +{ev.high_diff_mi} mi high weather
              </span>
            )}
          </div>
        </div>
      )}

      {/* Influential Hazard Checkpoints */}
      {route.influential_checkpoints && route.influential_checkpoints.length > 0 && (
        <div className="hazard-checkpoints-section">
          <span className="hazards-title">Key Hazard Checkpoints:</span>
          <div className="hazard-chips-row">
            {route.influential_checkpoints.map((hz, hzi) => (
              <button
                key={`hz-${hzi}`}
                type="button"
                className={`hazard-chip level-${hz.level}`}
                style={{ borderColor: LEVEL_COLORS[hz.level] || "#64748b" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                  onSelectCheckpoint?.(hz);
                }}
                title="Click to view on map & timeline"
              >
                <span className="hz-mile">Mi {Math.round(hz.mile)}</span>
                <span className="hz-name">{hz.level_name}</span>
                {hz.wind_mph > 0 && <span className="hz-detail">{Math.round(hz.wind_mph)} mph</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Auditable Risk Breakdown */}
      <div className="route-risk-breakdown">
        <div className="risk-metric-tags">
          <span className={`risk-tag ${s.no_travel_miles > 0 ? "tag-danger" : "tag-muted"}`}>
            No Travel: <strong>{s.no_travel_miles || 0} mi</strong>
          </span>
          <span className={`risk-tag ${s.severe_miles > 0 ? "tag-warning" : "tag-muted"}`}>
            Severe: <strong>{s.severe_miles || 0} mi</strong>
          </span>
          <span className={`risk-tag ${s.high_miles > 0 ? "tag-caution" : "tag-muted"}`}>
            High: <strong>{s.high_miles || 0} mi</strong>
          </span>
          <span className={`risk-tag ${s.moderate_miles > 0 ? "tag-mod" : "tag-muted"}`}>
            Mod: <strong>{s.moderate_miles || 0} mi</strong>
          </span>
          <span className="risk-tag tag-low">
            Low: <strong>{s.low_miles || 0} mi</strong>
          </span>
          {s.unknown_miles > 0 && (
            <span className="risk-tag tag-unknown">
              Unknown: <strong>{s.unknown_miles} mi</strong>
            </span>
          )}
        </div>
        <MixBar miles={s.miles_by_level} />
        <div className="audit-consistency-row">
          <Icon name="shield-check" size={12} className="text-success" />
          <span className="audit-text">
            Audited Miles: <strong>{s.audited_miles_sum} mi</strong> (Non-overlapping, 100% verified)
          </span>
        </div>
      </div>

      <div className="route-card-footer">
        <span className="select-prompt">
          {selected ? "Currently Displaying on Map & Timeline" : "Click to View Corridor & Checkpoints"}
        </span>
        <Icon name={selected ? "check" : "chevron-right"} size={16} />
      </div>
    </article>
  );
}

function ComparisonMatrix({ routes, departureTime, recommendedId, selectedId, onSelect }) {
  return (
    <div className="matrix-wrapper">
      <div className="matrix-scroll">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Metric</th>
              {routes.map((r) => {
                const isRec = r.id === recommendedId;
                const isSel = r.id === selectedId;
                const color = ROUTE_COLORS[(r.id - 1) % 3];
                return (
                  <th key={r.id} className={isSel ? "active-column" : ""}>
                    <div className="col-header-wrap">
                      <span className="col-swatch" style={{ background: color }} />
                      <span>{r.name}</span>
                      {isRec && <span className="mini-badge">Safest</span>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="row-label">Safety Recommendation</td>
              {routes.map((r) => {
                const ev = r.evaluation;
                return (
                  <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                    {r.id === recommendedId ? (
                      <span className="text-success font-semibold">Recommended (#1)</span>
                    ) : (
                      <span className="text-muted">Rank #{ev?.rank || "Alternative"}</span>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="row-label">Distance</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  <strong>{Math.round(r.distance_mi)} mi</strong>
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Drive Time</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  {fmtDuration(r.duration_s)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Estimated Arrival</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  {fmtTime(calcETA(departureTime, r.duration_s))}
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">No Travel Miles</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  <span className={r.stats.no_travel_miles > 0 ? "text-danger" : "text-success"}>
                    {r.stats.no_travel_miles} mi
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Severe Risk Miles</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  <span className={r.stats.severe_miles > 0 ? "text-warning" : "text-muted"}>
                    {r.stats.severe_miles} mi
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">High Risk Miles</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  {r.stats.high_miles} mi
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Moderate Risk Miles</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  {r.stats.moderate_miles || 0} mi
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Low Risk Miles</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  {r.stats.low_miles || 0} mi
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Unknown Risk Miles</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  <span className={r.stats.unknown_miles > 0 ? "text-warning" : "text-muted"}>
                    {r.stats.unknown_miles || 0} mi
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Audited Mileage Total</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  <strong>{r.stats.audited_miles_sum} mi</strong>
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Average Risk (0-4)</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  {r.stats.avg_risk.toFixed(2)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Truck Constraints</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column text-success" : "text-success"}>
                  <Icon name="check" size={13} /> Feasible
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Rejection / Decision Rationale</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column text-small" : "text-small"}>
                  {r.evaluation?.rejection_reason || (r.id === recommendedId ? "Optimal route choice." : "Alternative route.")}
                </td>
              ))}
            </tr>
            <tr>
              <td className="row-label">Action</td>
              {routes.map((r) => (
                <td key={r.id} className={r.id === selectedId ? "active-column" : ""}>
                  <button
                    type="button"
                    className={`table-action-btn ${r.id === selectedId ? "active" : ""}`}
                    onClick={() => onSelect(r.id)}
                  >
                    {r.id === selectedId ? "Selected" : "Select"}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckpointTable({ route, activeCheckpoint, onSelectCheckpoint }) {
  const [filterRiskOnly, setFilterRiskOnly] = useState(false);

  const displayedCheckpoints = filterRiskOnly
    ? route.checkpoints.filter((c) => c.level > 0 || c.level === 5 || c.level === -1)
    : route.checkpoints;

  const countRisk = route.checkpoints.filter((c) => c.level > 0 || c.level === 5 || c.level === -1).length;

  return (
    <div className="checkpoints-container">
      <div className="checkpoints-filter-bar">
        <div className="filter-info">
          <strong>{route.name} Checkpoints</strong>
          <span className="filter-count">
            Showing {displayedCheckpoints.length} of {route.checkpoints.length} locations ({route.interval_mi} mi spacing)
          </span>
        </div>
        <div className="filter-toggle">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filterRiskOnly}
              onChange={(e) => setFilterRiskOnly(e.target.checked)}
            />
            <span>Show Risk Only ({countRisk})</span>
          </label>
        </div>
      </div>

      <div className="table-wrap">
        <table className="checkpoints-table">
          <thead>
            <tr>
              <th>Mile</th>
              <th>ETA</th>
              <th>Wind</th>
              <th>Precip</th>
              <th>Temp</th>
              <th>Risk Category</th>
              <th>Analysis Reasons</th>
            </tr>
          </thead>
          <tbody>
            {displayedCheckpoints.map((c, idx) => {
              const badge = getRiskLevelBadge(c.level);
              const isSelected = activeCheckpoint && activeCheckpoint.mile === c.mile;
              return (
                <tr
                  key={`${c.mile}-${idx}`}
                  className={`checkpoint-row ${isSelected ? "selected-row" : ""} ${c.level >= 3 ? "danger-row" : ""}`}
                  onClick={() => onSelectCheckpoint?.(c)}
                  style={{ cursor: "pointer" }}
                  title="Click to locate on map"
                >
                  <td className="mile-cell">
                    <strong>{Math.round(c.mile)}</strong> mi
                  </td>
                  <td className="eta-cell">{fmtTime(c.eta)}</td>
                  <td className="wind-cell">
                    <span className="metric-with-icon">
                      <Icon name="wind" size={13} />
                      {c.wind_mph ?? c.wind ?? 0} mph
                    </span>
                  </td>
                  <td className="precip-cell">
                    {c.snow_in_hr > 0 ? (
                      <span className="metric-with-icon text-snow">
                        <Icon name="snow" size={13} />
                        {c.snow_in_hr} in/hr
                      </span>
                    ) : c.rain_in_hr > 0 ? (
                      <span className="metric-with-icon text-rain">
                        <Icon name="rain" size={13} />
                        {c.rain_in_hr} in/hr
                      </span>
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                  <td className="temp-cell">{c.temp_f ?? c.temp ?? "--"}°F</td>
                  <td>
                    <span className="risk-pill" style={{ background: badge.color, color: "#fff" }}>
                      {c.level_name}
                    </span>
                  </td>
                  <td className="reasons-cell">
                    {c.reasons && c.reasons.length > 0 ? (
                      <ul className="reasons-list">
                        {c.reasons.map((r, ri) => (
                          <li key={ri} className="reason-item">
                            {r}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">Nominal conditions</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RouteList({
  result,
  departureTime,
  selectedId,
  onSelect,
  onSelectCheckpoint,
  activeCheckpoint,
  onRefreshForecast,
  refreshLoading,
  forecastHour,
  onSyncForecastHour,
  onSaveTrip,
  isSavingTrip,
  onDownloadPdf,
  isDownloadingPdf,
}) {
  const [activeTab, setActiveTab] = useState("cards"); // 'cards' | 'matrix' | 'checkpoints'
  const [copied, setCopied] = useState(false);

  const selected = result.routes.find((r) => r.id === selectedId) || result.routes[0];
  const recommended = result.routes.find((r) => r.id === result.recommended_id);

  function handleCopySummary() {
    if (!selected) return;
    const s = selected.stats;
    const text = `SafeHaul Trip Analysis: ${selected.name}
Distance: ${Math.round(selected.distance_mi)} mi
Duration: ${fmtDuration(selected.duration_s)}
Recommended: ${result.recommended_id === selected.id ? "YES" : "NO"}
Average Risk: ${s.avg_risk.toFixed(2)}/4.0
No Travel Miles: ${s.no_travel_miles} mi
Severe Miles: ${s.severe_miles} mi
High Risk Miles: ${s.high_miles} mi
Moderate Miles: ${s.moderate_miles || 0} mi
Low Risk Miles: ${s.low_miles || 0} mi
Audited Sum: ${s.audited_miles_sum} mi
Rationale: ${result.rationale}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className="results-panel" aria-label="Route analysis results">
      {/* Forecast Provenance & Freshness Card */}
      <DataProvenanceCard
        provenance={result.data_provenance}
        onRefresh={onRefreshForecast}
        loading={refreshLoading}
      />

      {/* Top Recommendation Banner with Action Buttons */}
      <div className={`recommendation-banner ${result.all_prohibited ? "prohibited-banner" : ""}`}>
        <div className="rec-badge-row">
          <span className={result.all_prohibited ? "rec-danger-badge" : "rec-star-badge"}>
            <Icon name={result.all_prohibited ? "alert-triangle" : "shield-check"} size={16} />
            <span>{result.all_prohibited ? "Prohibited — No Travel" : "Recommended Decision"}</span>
          </span>

          <div className="banner-action-buttons">
            {onDownloadPdf && (
              <button
                type="button"
                className="banner-action-btn pdf-btn"
                onClick={onDownloadPdf}
                disabled={isDownloadingPdf}
                title="Download official PDF trip safety report"
              >
                <Icon name={isDownloadingPdf ? "refresh-cw" : "file-text"} size={14} className={isDownloadingPdf ? "spin-icon" : ""} />
                <span>{isDownloadingPdf ? "Generating..." : "Download PDF"}</span>
              </button>
            )}

            {onSaveTrip && (
              <button
                type="button"
                className="banner-action-btn save-btn"
                onClick={onSaveTrip}
                disabled={isSavingTrip}
                title="Save this trip to Saved Trips dashboard"
              >
                <Icon name={isSavingTrip ? "refresh-cw" : "bookmark"} size={14} className={isSavingTrip ? "spin-icon" : ""} />
                <span>{isSavingTrip ? "Saving..." : "Save Trip"}</span>
              </button>
            )}

            <button
              type="button"
              className="copy-summary-btn"
              onClick={handleCopySummary}
              title="Copy route dispatch summary to clipboard"
            >
              <Icon name={copied ? "check" : "clipboard"} size={14} />
              <span>{copied ? "Copied!" : "Copy Dispatch"}</span>
            </button>
          </div>
        </div>

        <h2 className={`rec-title ${result.all_prohibited ? "text-danger" : ""}`}>
          {result.all_prohibited
            ? "All Corridors Contain Prohibited No Travel Conditions"
            : `Take ${recommended?.name || `Route ${result.recommended_id}`}`}
        </h2>
        <p className="rec-rationale">{result.rationale}</p>
      </div>

      {/* Route notice if fewer than 3 distinct routes were returned */}
      {result.route_notice && (
        <div className="route-notice-banner" role="status">
          <Icon name="info" size={15} />
          <span>{result.route_notice}</span>
        </div>
      )}

      {/* Interactive Distance-Proportional Risk Timeline for Active Corridor */}
      {selected && (
        <RouteRiskTimeline
          route={selected}
          activeCheckpoint={activeCheckpoint}
          onSelectCheckpoint={onSelectCheckpoint}
          forecastHour={forecastHour}
          onSyncForecastHour={onSyncForecastHour}
          departureTime={departureTime}
          forecastStart={result.forecast_start}
        />
      )}

      {/* View Switcher Tabs */}
      <div className="results-tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "cards"}
          className={`tab-btn ${activeTab === "cards" ? "active" : ""}`}
          onClick={() => setActiveTab("cards")}
        >
          <Icon name="layers" size={15} />
          <span>Route Cards</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "matrix"}
          className={`tab-btn ${activeTab === "matrix" ? "active" : ""}`}
          onClick={() => setActiveTab("matrix")}
        >
          <Icon name="compass" size={15} />
          <span>Side-by-Side Matrix</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "checkpoints"}
          className={`tab-btn ${activeTab === "checkpoints" ? "active" : ""}`}
          onClick={() => setActiveTab("checkpoints")}
        >
          <Icon name="map-pin" size={15} />
          <span>Checkpoints ({selected?.checkpoints?.length || 0})</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="tab-content">
        {activeTab === "cards" && (
          <div className="route-cards-list">
            {result.routes.map((r) => (
              <RouteCard
                key={r.id}
                route={r}
                departureTime={departureTime}
                selected={r.id === selectedId}
                recommended={r.id === result.recommended_id}
                onSelect={() => onSelect(r.id)}
                onSelectCheckpoint={onSelectCheckpoint}
              />
            ))}
          </div>
        )}

        {activeTab === "matrix" && (
          <ComparisonMatrix
            routes={result.routes}
            departureTime={departureTime}
            recommendedId={result.recommended_id}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}

        {activeTab === "checkpoints" && selected && (
          <CheckpointTable
            route={selected}
            activeCheckpoint={activeCheckpoint}
            onSelectCheckpoint={onSelectCheckpoint}
          />
        )}
      </div>
    </section>
  );
}
