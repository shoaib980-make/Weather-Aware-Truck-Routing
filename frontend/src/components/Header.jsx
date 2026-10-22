import React, { useEffect, useState } from "react";
import { Icon } from "./Icons.jsx";
import { checkHealth } from "../api.js";

export const PRESETS = [
  {
    name: "Chicago → Denver",
    subtitle: "I-80 Plains Corridor",
    origin: { label: "Chicago, Illinois, United States", lat: 41.8781, lon: -87.6298 },
    destination: { label: "Denver, Colorado, United States", lat: 39.7392, lon: -104.9903 },
    weight: 42000,
  },
  {
    name: "Dallas → Atlanta",
    subtitle: "I-20 Freight Spine",
    origin: { label: "Dallas, Texas, United States", lat: 32.7767, lon: -96.797 },
    destination: { label: "Atlanta, Georgia, United States", lat: 33.749, lon: -84.388 },
    weight: 35000,
  },
  {
    name: "Seattle → Salt Lake City",
    subtitle: "I-84 Mountain Pass",
    origin: { label: "Seattle, Washington, United States", lat: 47.6062, lon: -122.3321 },
    destination: { label: "Salt Lake City, Utah, United States", lat: 40.7608, lon: -111.891 },
    weight: 45000,
  },
  {
    name: "New York → Miami",
    subtitle: "I-95 Atlantic Highway",
    origin: { label: "New York, New York, United States", lat: 40.7128, lon: -74.006 },
    destination: { label: "Miami, Florida, United States", lat: 25.7617, lon: -80.1918 },
    weight: 38000,
  },
];

export default function Header({ onSelectPreset, onOpenSafety, theme, onToggleTheme }) {
  const [healthy, setHealthy] = useState(null);

  useEffect(() => {
    let mounted = true;
    checkHealth().then((ok) => {
      if (mounted) setHealthy(ok);
    });
    const interval = setInterval(() => {
      checkHealth().then((ok) => {
        if (mounted) setHealthy(ok);
      });
    }, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-logo" aria-hidden="true">
          <Icon name="truck" size={24} />
          <span className="logo-badge">
            <Icon name="shield-check" size={14} />
          </span>
        </div>
        <div className="brand-text">
          <div className="brand-title-row">
            <h1 className="brand-name">SafeHaul RouteIQ</h1>
            <span className="version-pill">v2.0</span>
          </div>
          <p className="brand-tagline">Weather-Aware Dynamic Truck Routing & Corridor Safety</p>
        </div>
      </div>

      <div className="header-actions">
        {/* Presets dropdown */}
        <div className="preset-selector">
          <label htmlFor="corridor-preset" className="sr-only">Quick Freight Corridors</label>
          <select
            id="corridor-preset"
            className="preset-dropdown"
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value;
              if (val !== "") {
                const preset = PRESETS[Number(val)];
                if (preset) onSelectPreset(preset);
                e.target.value = "";
              }
            }}
          >
            <option value="" disabled>Load Example Corridor...</option>
            {PRESETS.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name} ({p.subtitle})
              </option>
            ))}
          </select>
        </div>

        {/* Safety Guide modal trigger */}
        <button
          type="button"
          className="header-btn"
          onClick={onOpenSafety}
          title="Open Safety Guidelines and Risk Matrix"
          aria-label="View Safety Guidelines"
        >
          <Icon name="shield-check" size={16} />
          <span className="btn-label">Safety Rules</span>
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          className="header-btn icon-only"
          onClick={onToggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
        </button>

        {/* Live Service Indicator */}
        <div
          className={`service-status ${healthy === true ? "online" : healthy === false ? "offline" : "checking"}`}
          title={healthy ? "Live API (OSRM & Open-Meteo operational)" : "Checking API health..."}
          role="status"
        >
          <span className="status-dot" />
          <span className="status-text">{healthy ? "Live Engine" : "Connecting..."}</span>
        </div>
      </div>
    </header>
  );
}
