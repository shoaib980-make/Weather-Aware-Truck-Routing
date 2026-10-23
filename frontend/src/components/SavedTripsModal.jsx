import React, { useEffect, useState } from "react";
import {
  deleteTrip,
  downloadSavedTripPdf,
  duplicateTrip,
  getTrip,
  getTripAnalysis,
  listTrips,
  reanalyzeTrip,
} from "../api.js";
import { fmtDuration, fmtTime } from "../risk.js";
import { Icon } from "./Icons.jsx";

export default function SavedTripsModal({
  isOpen,
  onClose,
  onLoadTripAnalysis,
  currentTripId,
}) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Duplicate modal state
  const [dupTrip, setDupTrip] = useState(null);
  const [dupDepart, setDupDepart] = useState("");

  // Compare versions modal state
  const [compareTrip, setCompareTrip] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSavedTrips();
    }
  }, [isOpen]);

  async function loadSavedTrips() {
    setLoading(true);
    setError("");
    try {
      const data = await listTrips();
      setTrips(data.trips || []);
    } catch (err) {
      setError(err.message || "Failed to load saved trips.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(tripId) {
    if (!window.confirm("Are you sure you want to delete this saved trip and its historical analyses?")) {
      return;
    }
    setActionLoadingId(tripId);
    try {
      await deleteTrip(tripId);
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
    } catch (err) {
      alert(err.message || "Failed to delete trip.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDuplicateConfirm() {
    if (!dupTrip) return;
    setActionLoadingId(dupTrip.id);
    try {
      const payload = {
        name: `Copy of ${dupTrip.name}`,
        departure: dupDepart || dupTrip.departure,
      };
      const newTrip = await duplicateTrip(dupTrip.id, payload);
      setDupTrip(null);
      await loadSavedTrips();
    } catch (err) {
      alert(err.message || "Failed to duplicate trip.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReanalyze(tripId) {
    setActionLoadingId(tripId);
    try {
      const res = await reanalyzeTrip(tripId);
      await loadSavedTrips();
      if (res.analysis?.result_data) {
        const fullTrip = await getTrip(tripId);
        onLoadTripAnalysis?.(fullTrip, res.analysis.result_data);
        onClose();
      }
    } catch (err) {
      alert(err.message || "Failed to reanalyze trip.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleOpenTrip(trip) {
    setActionLoadingId(trip.id);
    try {
      const fullTrip = await getTrip(trip.id);
      const latestAnalysis = fullTrip.analyses?.[0];
      if (latestAnalysis?.id) {
        const analysisDetail = await getTripAnalysis(trip.id, latestAnalysis.id);
        if (analysisDetail?.result_data) {
          onLoadTripAnalysis?.(fullTrip, analysisDetail.result_data);
          onClose();
          return;
        }
      }
      alert("No stored analysis data available for this trip.");
    } catch (err) {
      alert(err.message || "Failed to open trip analysis.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDownloadPdf(tripId, analysisId) {
    setActionLoadingId(tripId);
    try {
      const filename = `SafeHaul_Trip_${tripId}_Report.pdf`;
      await downloadSavedTripPdf(tripId, analysisId, filename);
    } catch (err) {
      alert(err.message || "Failed to download PDF report.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleOpenCompare(trip) {
    setCompareLoading(true);
    try {
      const fullTrip = await getTrip(trip.id);
      setCompareTrip(fullTrip);
    } catch (err) {
      alert(err.message || "Failed to load trip versions.");
    } finally {
      setCompareLoading(false);
    }
  }

  if (!isOpen) return null;

  const filteredTrips = trips.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.name?.toLowerCase().includes(q) ||
      t.origin?.label?.toLowerCase().includes(q) ||
      t.destination?.label?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card saved-trips-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Icon name="bookmark" size={18} className="text-accent" />
            <div>
              <h3>Saved Commercial Trips & Route Analyses</h3>
              <span className="modal-subtitle">
                Access preserved corridor runs, duplicate trips, and reanalyze with live weather
              </span>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Filter bar */}
        <div className="saved-trips-filter-bar">
          <div className="search-input-wrap">
            <Icon name="compass" size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Filter by city, state, or trip name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="saved-trips-search"
            />
          </div>
          <span className="saved-trips-count">
            {filteredTrips.length} {filteredTrips.length === 1 ? "Trip" : "Trips"} Saved
          </span>
        </div>

        {/* Content Body */}
        <div className="modal-body saved-trips-scroll">
          {loading ? (
            <div className="saved-loading-state">
              <Icon name="refresh-cw" size={24} className="spin-icon" />
              <p>Loading saved trips...</p>
            </div>
          ) : error ? (
            <div className="app-error-banner">
              <Icon name="alert-triangle" size={16} />
              <span>{error}</span>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="empty-saved-state">
              <Icon name="navigation" size={36} className="text-muted" />
              <h4>No Saved Trips Found</h4>
              <p>
                {searchQuery
                  ? "No saved trips matched your filter criteria."
                  : "After analyzing any highway corridor, click 'Save Trip' in the results panel to revisit, duplicate, and reanalyze with fresh weather."}
              </p>
            </div>
          ) : (
            <div className="saved-trips-grid">
              {filteredTrips.map((t) => {
                const isActionBusy = actionLoadingId === t.id;
                const la = t.latest_analysis || {};
                const hasMultipleVersions = t.analysis_count > 1;

                return (
                  <article key={t.id} className="saved-trip-item">
                    <div className="saved-trip-header">
                      <div className="saved-trip-title-group">
                        <span className="saved-trip-id">#{t.id}</span>
                        <h4 className="saved-trip-name">{t.name}</h4>
                      </div>
                      <div className="saved-trip-badges">
                        <span className="saved-version-badge">
                          v{la.version || 1} ({t.analysis_count} {t.analysis_count === 1 ? "analysis" : "versions"})
                        </span>
                        {la.all_prohibited ? (
                          <span className="badge no-travel-badge">Prohibited</span>
                        ) : la.recommended_route_name ? (
                          <span className="badge recommended-badge">{la.recommended_route_name}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="saved-trip-endpoints">
                      <div className="endpoint-row">
                        <span className="endpoint-pin pin-a">A</span>
                        <span className="endpoint-text">{t.origin?.label}</span>
                      </div>
                      <div className="endpoint-row">
                        <span className="endpoint-pin pin-b">B</span>
                        <span className="endpoint-text">{t.destination?.label}</span>
                      </div>
                    </div>

                    <div className="saved-trip-metrics">
                      <div className="stm-item">
                        <span className="stm-label">Departure</span>
                        <span className="stm-val">{fmtTime(t.departure)}</span>
                      </div>
                      <div className="stm-item">
                        <span className="stm-label">Weight</span>
                        <span className="stm-val">{t.weight_lb?.toLocaleString()} lb</span>
                      </div>
                      <div className="stm-item">
                        <span className="stm-label">Last Analyzed</span>
                        <span className="stm-val">{fmtTime(t.updated_at)}</span>
                      </div>
                    </div>

                    {/* Actions toolbar */}
                    <div className="saved-trip-actions">
                      <button
                        type="button"
                        className="btn-action-primary"
                        onClick={() => handleOpenTrip(t)}
                        disabled={isActionBusy}
                        title="Load trip into map and active workspace"
                      >
                        <Icon name="navigation" size={13} />
                        <span>Load Analysis</span>
                      </button>

                      <button
                        type="button"
                        className="btn-action-secondary"
                        onClick={() => handleReanalyze(t.id)}
                        disabled={isActionBusy}
                        title="Fetch latest weather and save as a new analysis version"
                      >
                        <Icon name="refresh-cw" size={13} className={isActionBusy ? "spin-icon" : ""} />
                        <span>Reanalyze</span>
                      </button>

                      {hasMultipleVersions && (
                        <button
                          type="button"
                          className="btn-action-secondary"
                          onClick={() => handleOpenCompare(t)}
                          disabled={isActionBusy}
                          title="Compare historical analysis versions"
                        >
                          <Icon name="layers" size={13} />
                          <span>Compare Versions</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-action-secondary"
                        onClick={() => {
                          setDupTrip(t);
                          setDupDepart(t.departure ? t.departure.slice(0, 16) : "");
                        }}
                        disabled={isActionBusy}
                        title="Duplicate trip parameters with new departure time"
                      >
                        <Icon name="copy" size={13} />
                        <span>Duplicate</span>
                      </button>

                      <button
                        type="button"
                        className="btn-action-secondary"
                        onClick={() => handleDownloadPdf(t.id, la.id)}
                        disabled={isActionBusy}
                        title="Download official PDF trip safety report"
                      >
                        <Icon name="file-text" size={13} />
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        className="btn-action-danger"
                        onClick={() => handleDelete(t.id)}
                        disabled={isActionBusy}
                        title="Delete saved trip and history"
                      >
                        <Icon name="trash-2" size={13} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Duplicate Trip Dialog */}
      {dupTrip && (
        <div className="modal-backdrop sub-modal" onClick={() => setDupTrip(null)}>
          <div className="modal-card duplicate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Duplicate Trip: {dupTrip.name}</h4>
              <button type="button" className="close-btn" onClick={() => setDupTrip(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-info-text">
                Creates a new trip record preserving origin, destination, and gross weight.
                You can adjust the departure date and time for the duplicated run.
              </p>
              <div className="form-group">
                <label className="form-label">New Departure Date & Time (UTC):</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={dupDepart}
                  onChange={(e) => setDupDepart(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setDupTrip(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleDuplicateConfirm}>
                Confirm Duplication
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Historical Versions Dialog */}
      {compareTrip && (
        <CompareVersionsDialog
          trip={compareTrip}
          onClose={() => setCompareTrip(null)}
          onDownloadPdf={(analysisId) => handleDownloadPdf(compareTrip.id, analysisId)}
        />
      )}
    </div>
  );
}

function CompareVersionsDialog({ trip, onClose, onDownloadPdf }) {
  const analyses = trip.analyses || [];
  const [verAIndex, setVerAIndex] = useState(analyses.length - 1); // oldest
  const [verBIndex, setVerBIndex] = useState(0);                   // latest

  const verA = analyses[verAIndex] || {};
  const verB = analyses[verBIndex] || {};

  const routeNameA = verA.recommended_route_name || (verA.recommended_id ? `Route ${verA.recommended_id}` : "Route 1");
  const routeNameB = verB.recommended_route_name || (verB.recommended_id ? `Route ${verB.recommended_id}` : "Route 1");

  const riskA = verA.recommended_risk_miles || 0;
  const riskB = verB.recommended_risk_miles || 0;
  const riskDelta = Math.round((riskB - riskA) * 10) / 10;

  return (
    <div className="modal-backdrop sub-modal" onClick={onClose}>
      <div className="modal-card compare-versions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h4>Historical Analysis Comparison: {trip.name}</h4>
            <span className="modal-subtitle">
              Comparing past forecast run vs. latest weather updates
            </span>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="compare-selectors-bar">
            <div className="version-selector-group">
              <label>Baseline Version:</label>
              <select
                value={verAIndex}
                onChange={(e) => setVerAIndex(Number(e.target.value))}
                className="version-select"
              >
                {analyses.map((a, idx) => (
                  <option key={`opt-a-${a.id}`} value={idx}>
                    v{a.version} ({fmtTime(a.created_at)})
                  </option>
                ))}
              </select>
            </div>

            <div className="compare-vs-badge">VS</div>

            <div className="version-selector-group">
              <label>Comparison Version:</label>
              <select
                value={verBIndex}
                onChange={(e) => setVerBIndex(Number(e.target.value))}
                className="version-select"
              >
                {analyses.map((a, idx) => (
                  <option key={`opt-b-${a.id}`} value={idx}>
                    v{a.version} ({fmtTime(a.created_at)}) {idx === 0 ? "— Latest" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delta Highlights Banner */}
          <div className="compare-delta-banner">
            <div className="cdb-item">
              <span className="cdb-label">Elevated Risk Miles Shift</span>
              <span className={`cdb-val ${riskDelta > 0 ? "text-danger" : riskDelta < 0 ? "text-success" : ""}`}>
                {riskDelta > 0 ? `+${riskDelta} mi increase` : riskDelta < 0 ? `${riskDelta} mi decrease` : "0.0 mi (no change)"}
              </span>
            </div>

            <div className="cdb-item">
              <span className="cdb-label">Recommendation Shift</span>
              <span className="cdb-val">
                {routeNameA === routeNameB ? (
                  `Consistent: ${routeNameB}`
                ) : (
                  <span className="text-warning">
                    {routeNameA} → {routeNameB}
                  </span>
                )}
              </span>
            </div>

            <div className="cdb-item">
              <span className="cdb-label">Forecast Reference Time</span>
              <span className="cdb-val text-small">
                {fmtTime(verB.forecast_reference_time || verB.created_at)}
              </span>
            </div>
          </div>

          {/* Side-by-Side Comparison Table */}
          <table className="comparison-table version-table">
            <thead>
              <tr>
                <th>Comparison Metric</th>
                <th>Baseline (v{verA.version})</th>
                <th>Comparison (v{verB.version})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="row-label">Analysis Timestamp</td>
                <td>{fmtTime(verA.created_at)}</td>
                <td>{fmtTime(verB.created_at)}</td>
              </tr>
              <tr>
                <td className="row-label">Recommended Corridor</td>
                <td>{routeNameA}</td>
                <td>{routeNameB}</td>
              </tr>
              <tr>
                <td className="row-label">Elevated Risk Miles</td>
                <td>{riskA.toFixed(1)} mi</td>
                <td>{riskB.toFixed(1)} mi</td>
              </tr>
              <tr>
                <td className="row-label">Dispatch Rationale</td>
                <td className="text-small">{verA.rationale}</td>
                <td className="text-small">{verB.rationale}</td>
              </tr>
              <tr>
                <td className="row-label">PDF Safety Report</td>
                <td>
                  <button
                    type="button"
                    className="table-action-btn"
                    onClick={() => onDownloadPdf(verA.id)}
                  >
                    Download v{verA.version} PDF
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="table-action-btn"
                    onClick={() => onDownloadPdf(verB.id)}
                  >
                    Download v{verB.version} PDF
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
