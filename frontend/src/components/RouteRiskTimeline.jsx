import React, { useState } from "react";
import { LEVEL_COLORS, fmtTime, getRiskLevelBadge } from "../risk.js";
import { Icon } from "./Icons.jsx";

export default function RouteRiskTimeline({
  route,
  activeCheckpoint,
  onSelectCheckpoint,
  forecastHour,
  onSyncForecastHour,
  departureTime,
  forecastStart,
}) {
  const [hoveredCp, setHoveredCp] = useState(null);

  if (!route || !route.checkpoints || route.checkpoints.length === 0) {
    return null;
  }

  const checkpoints = route.checkpoints;
  const totalMiles = route.distance_mi || checkpoints[checkpoints.length - 1].mile || 1;

  // Handle checkpoint click and synchronise with forecast slider
  function handleCheckpointClick(cp) {
    onSelectCheckpoint?.(cp);

    // Calculate arrival hour relative to forecast start
    const baseDate = forecastStart ? new Date(forecastStart) : departureTime ? new Date(departureTime) : null;
    if (baseDate && cp.eta) {
      const etaDate = new Date(cp.eta);
      if (!isNaN(etaDate.getTime()) && !isNaN(baseDate.getTime())) {
        const diffMs = etaDate.getTime() - baseDate.getTime();
        const hourOffset = Math.min(48, Math.max(0, Math.round(diffMs / (3600 * 1000))));
        onSyncForecastHour?.(hourOffset);
      }
    }
  }

  // Calculate ticks (0%, 25%, 50%, 75%, 100%)
  const tickPercents = [0, 0.25, 0.5, 0.75, 1];
  const ticks = tickPercents.map((p) => {
    const mi = Math.round(totalMiles * p);
    // Find closest checkpoint for ETA
    const closest = checkpoints.reduce((prev, curr) =>
      Math.abs(curr.mile - mi) < Math.abs(prev.mile - mi) ? curr : prev
    );
    return {
      percent: p * 100,
      mile: mi,
      eta: closest?.eta,
    };
  });

  const active = activeCheckpoint || hoveredCp;

  return (
    <div className="route-timeline-card" aria-label="Distance-Proportional Route Risk Timeline">
      <div className="timeline-header">
        <div className="timeline-title-group">
          <div className="timeline-icon">
            <Icon name="navigation" size={15} />
          </div>
          <div>
            <h4 className="timeline-title">Route Risk Distance Timeline</h4>
            <span className="timeline-subtitle">
              {Math.round(totalMiles)} mi corridor · {checkpoints.length} weather checkpoints · Distance-proportional
            </span>
          </div>
        </div>
        <div className="timeline-hint">
          <span>Click any segment to locate on map & sync ETA</span>
        </div>
      </div>

      {/* Timeline Bar */}
      <div className="timeline-bar-wrapper">
        <div
          className="timeline-bar-track"
          role="listbox"
          aria-label="Route risk segments along corridor"
        >
          {checkpoints.map((cp, idx) => {
            const segMiles = cp.segment_miles || (totalMiles / checkpoints.length);
            const widthPct = Math.max(0.5, (segMiles / totalMiles) * 100);
            const isUnknown = cp.level === 5 || cp.level === -1;
            const bg = isUnknown
              ? "repeating-linear-gradient(45deg, #64748b, #64748b 6px, #475569 6px, #475569 12px)"
              : LEVEL_COLORS[cp.level] || "#10b981";

            const isSelected =
              activeCheckpoint &&
              (activeCheckpoint.mile === cp.mile ||
                (activeCheckpoint.lat === cp.lat && activeCheckpoint.lon === cp.lon));

            return (
              <button
                key={`timeline-seg-${idx}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                className={`timeline-segment-btn ${isSelected ? "is-selected" : ""} ${isUnknown ? "is-unknown" : ""}`}
                style={{
                  width: `${widthPct}%`,
                  background: bg,
                }}
                onClick={() => handleCheckpointClick(cp)}
                onMouseEnter={() => setHoveredCp(cp)}
                onMouseLeave={() => setHoveredCp(null)}
                onFocus={() => setHoveredCp(cp)}
                onBlur={() => setHoveredCp(null)}
                title={`Mile ${Math.round(cp.mile)}: ${cp.level_name || "Unknown Risk"} (Click to inspect)`}
              >
                {isSelected && <span className="timeline-active-indicator" />}
              </button>
            );
          })}
        </div>

        {/* Distance and ETA Axis Ticks */}
        <div className="timeline-axis-ticks">
          {ticks.map((t, i) => (
            <div
              key={`tick-${i}`}
              className="axis-tick"
              style={{
                left: `${t.percent}%`,
                transform: i === 0 ? "none" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              <span className="tick-line" />
              <span className="tick-mile">{t.mile} mi</span>
              {t.eta && <span className="tick-eta">{fmtTime(t.eta).split(",")[1] || fmtTime(t.eta)}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Active Checkpoint Detail Callout */}
      {active && (
        <div className="timeline-detail-callout" role="status">
          <div className="callout-main">
            <div className="callout-badge-row">
              <span
                className="callout-risk-pill"
                style={{
                  background: LEVEL_COLORS[active.level] || "#64748b",
                  color: "#fff",
                }}
              >
                <Icon name="shield-alert" size={13} />
                <span>{active.level_name || "Weather Checkpoint"}</span>
              </span>
              <span className="callout-mile-tag">
                Mile <strong>{Math.round(active.mile)}</strong> of {Math.round(totalMiles)} mi
              </span>
              <span className="callout-eta-tag">
                <Icon name="clock" size={12} />
                <span>ETA: {fmtTime(active.eta)}</span>
              </span>
            </div>

            <div className="callout-metrics-row">
              <span className="metric-chip">
                <Icon name="wind" size={12} />
                <span>Wind: <strong>{active.wind_mph ?? active.wind ?? 0} mph</strong></span>
              </span>
              <span className="metric-chip">
                <Icon name="rain" size={12} />
                <span>
                  Precip:{" "}
                  <strong>
                    {active.snow_in_hr > 0
                      ? `${active.snow_in_hr} in/hr snow`
                      : active.rain_in_hr > 0
                      ? `${active.rain_in_hr} in/hr rain`
                      : "0.00 in/hr"}
                  </strong>
                </span>
              </span>
              <span className="metric-chip">
                <Icon name="thermometer" size={12} />
                <span>Temp: <strong>{active.temp_f ?? active.temp ?? "--"}°F</strong></span>
              </span>
            </div>

            {active.reasons && active.reasons.length > 0 && (
              <div className="callout-reasons">
                <strong>Hazard Factors:</strong>
                <ul>
                  {active.reasons.map((r, ri) => (
                    <li key={ri}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="callout-action-group">
            <button
              type="button"
              className="sync-forecast-btn"
              onClick={() => handleCheckpointClick(active)}
              title="Locate on map and set forecast slider to this checkpoint's arrival time"
            >
              <Icon name="compass" size={13} />
              <span>Sync Map & Forecast</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
