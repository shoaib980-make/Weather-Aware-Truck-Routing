import React, { useEffect, useMemo, useState } from "react";
import { LEVELS, LEVEL_COLORS, fmtTime } from "../risk.js";
import { Icon } from "./Icons.jsx";

const MAX_HOUR = 48;

export default function HeatSlider({
  start,
  hour,
  onHour,
  showHeat,
  onToggle,
  selectedRoute,
  collapsed,
  onToggleCollapse,
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 4x
  const [isLocalCollapsed, setIsLocalCollapsed] = useState(false);

  const isCollapsed = collapsed !== undefined ? collapsed : isLocalCollapsed;

  const speedInterval = speed === 1 ? 600 : speed === 2 ? 300 : 150;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      onHour((h) => (h >= MAX_HOUR ? 0 : h + 1));
    }, speedInterval);
    return () => clearInterval(id);
  }, [playing, speedInterval, onHour]);

  const when = useMemo(() => {
    if (!start) return new Date();
    const d = new Date(start);
    return new Date(d.getTime() + hour * 3600_000);
  }, [start, hour]);

  const arrivalHours = useMemo(() => {
    if (!selectedRoute?.duration_s) return null;
    return Math.min(MAX_HOUR, Math.round(selectedRoute.duration_s / 3600));
  }, [selectedRoute]);

  // Compute peak risk across checkpoints at each forecast hour for the timeline ribbon
  const hourlyRiskLevels = useMemo(() => {
    if (!selectedRoute?.checkpoints?.length) return [];
    const ribbon = [];
    for (let h = 0; h <= MAX_HOUR; h++) {
      let maxLvl = 0;
      for (const cp of selectedRoute.checkpoints) {
        if (cp.forecast && cp.forecast[h]) {
          maxLvl = Math.max(maxLvl, cp.forecast[h][0]);
        }
      }
      ribbon.push(maxLvl);
    }
    return ribbon;
  }, [selectedRoute]);

  function handleStep(delta) {
    setPlaying(false);
    onHour((curr) => Math.max(0, Math.min(MAX_HOUR, curr + delta)));
  }

  function toggleSpeed() {
    setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1));
  }

  return (
    <div
      className={`heat-slider-container ${isCollapsed ? "is-collapsed" : ""}`}
      role="region"
      aria-label="Forecast timeline slider"
    >
      <div className="heat-slider-header">
        <div className="heat-toggle-group">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showHeat}
              onChange={(e) => onToggle(e.target.checked)}
              aria-label="Toggle Weather Risk Heatmap"
            />
            <span className="switch-slider" />
            <span className="switch-label">
              <Icon name="layers" size={15} />
              <span>Weather Heatmap</span>
            </span>
          </label>
        </div>

        <div className="timeline-clock">
          <Icon name="clock" size={15} className="clock-icon" />
          <output className="clock-text" aria-live="polite">
            <strong>{fmtTime(when.toISOString())}</strong>
            <span className="hour-offset">({hour === 0 ? "Departure" : `+${hour} hrs`})</span>
          </output>
        </div>

        <div className="playback-controls">
          <button
            type="button"
            className="ctrl-btn"
            onClick={() => handleStep(-1)}
            disabled={!showHeat || hour <= 0}
            title="Step Back 1 Hour"
            aria-label="Step Back 1 Hour"
          >
            <Icon name="chevron-left" size={16} />
          </button>

          <button
            type="button"
            className={`play-btn ${playing ? "is-playing" : ""}`}
            onClick={() => setPlaying((p) => !p)}
            disabled={!showHeat}
            title={playing ? "Pause Timeline Animation" : "Play Timeline Animation"}
            aria-label={playing ? "Pause Forecast" : "Play Forecast"}
          >
            <Icon name={playing ? "pause" : "play"} size={14} />
            <span>{playing ? "Pause" : "Play"}</span>
          </button>

          <button
            type="button"
            className="ctrl-btn"
            onClick={() => handleStep(1)}
            disabled={!showHeat || hour >= MAX_HOUR}
            title="Step Forward 1 Hour"
            aria-label="Step Forward 1 Hour"
          >
            <Icon name="chevron-right" size={16} />
          </button>

          <button
            type="button"
            className="speed-btn"
            onClick={toggleSpeed}
            disabled={!showHeat}
            title="Toggle playback speed"
            aria-label={`Playback speed ${speed}x`}
          >
            {speed}x
          </button>

          {/* Mobile Collapse/Expand Toggle to maximize map view */}
          <button
            type="button"
            className="collapse-toggle-btn"
            onClick={() => {
              if (onToggleCollapse) onToggleCollapse(!isCollapsed);
              else setIsLocalCollapsed(!isLocalCollapsed);
            }}
            title={isCollapsed ? "Expand timeline & weather details" : "Collapse to maximize map view"}
            aria-label={isCollapsed ? "Expand timeline" : "Collapse timeline"}
          >
            <Icon name={isCollapsed ? "chevron-up" : "chevron-down"} size={14} />
            <span className="collapse-text">{isCollapsed ? "Timeline" : "Hide"}</span>
          </button>
        </div>
      </div>

      {/* Slider Track with Timeline Ribbon */}
      <div className="slider-track-wrap">
        <input
          id="forecast-hour-slider"
          type="range"
          min="0"
          max={MAX_HOUR}
          step="1"
          value={hour}
          disabled={!showHeat}
          onChange={(e) => {
            setPlaying(false);
            onHour(Number(e.target.value));
          }}
          aria-label="Forecast hours after departure (0 to 48 hours)"
          className="timeline-range-input"
        />

        {/* Dynamic risk corridor preview ribbon */}
        {hourlyRiskLevels.length > 0 && (
          <div className="risk-ribbon-bar" title="Corridor peak weather risk at each hour">
            {hourlyRiskLevels.map((lvl, h) => (
              <span
                key={h}
                className={`ribbon-slice ${h === hour ? "active-slice" : ""}`}
                style={{ background: LEVEL_COLORS[lvl] }}
                onClick={() => onHour(h)}
              />
            ))}
          </div>
        )}

        <div className="slider-ticks">
          <span className="tick-label" onClick={() => onHour(0)} title="Departure (0h)">0h (Depart)</span>
          <span className="tick-label tick-mid" onClick={() => onHour(12)} title="+12 hours">+12h</span>
          <span className="tick-label" onClick={() => onHour(24)} title="+24 hours (+1 day)">+24h</span>
          <span className="tick-label tick-mid" onClick={() => onHour(36)} title="+36 hours">+36h</span>
          <span className="tick-label" onClick={() => onHour(48)} title="+48 hours (+2 days)">+48h</span>
        </div>
      </div>

      {/* Quick Jump Shortcuts & Legend */}
      <div className="heat-slider-footer">
        <div className="quick-jump-actions">
          <button
            type="button"
            className="jump-chip"
            onClick={() => onHour(0)}
            disabled={!showHeat || hour === 0}
          >
            Start (0h)
          </button>
          {arrivalHours && arrivalHours > 0 && arrivalHours <= MAX_HOUR && (
            <button
              type="button"
              className="jump-chip"
              onClick={() => onHour(arrivalHours)}
              disabled={!showHeat || hour === arrivalHours}
            >
              Arrival (+{arrivalHours}h)
            </button>
          )}
        </div>

        <div className="risk-legend" role="group" aria-label="Weather risk levels">
          {LEVELS.map((lvl, i) => (
            <span key={lvl} className="legend-chip">
              <span className="legend-indicator" style={{ background: LEVEL_COLORS[i] }} />
              <span className="legend-name">{lvl}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
