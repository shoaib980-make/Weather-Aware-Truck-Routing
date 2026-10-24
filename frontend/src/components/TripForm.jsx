import React, { useEffect, useState } from "react";
import { geocode } from "../api.js";
import { Icon } from "./Icons.jsx";
import PlaceInput from "./PlaceInput.jsx";

const pad = (n) => String(n).padStart(2, "0");

function formatLocalDatetime(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getInitialDeparture() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  d.setSeconds(0, 0);
  return formatLocalDatetime(d);
}

const WEIGHT_PRESETS = [
  { label: "Empty Bobtail", value: 15000 },
  { label: "Standard Dry Van", value: 38000 },
  { label: "Heavy Freight", value: 45000 },
  { label: "Max 80k Semi", value: 78000 },
];

export default function TripForm({ initialValues, onSubmit, loading, onPlacesChange }) {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [departure, setDeparture] = useState(getInitialDeparture);
  const [weight, setWeight] = useState(42000);
  const [interval, setIntervalMiles] = useState("auto");
  const [validationError, setValidationError] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);

  // Synchronize when a preset is selected from parent
  useEffect(() => {
    if (initialValues) {
      if (initialValues.origin) setOrigin(initialValues.origin);
      if (initialValues.destination) setDestination(initialValues.destination);
      if (initialValues.weight) setWeight(initialValues.weight);
    }
  }, [initialValues]);

  // Notify parent of location changes so Map can show markers immediately
  useEffect(() => {
    onPlacesChange?.({ origin, destination });
  }, [origin, destination, onPlacesChange]);

  // Animated loading steps feedback
  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const timer1 = setTimeout(() => setLoadingStep(1), 800);
    const timer2 = setTimeout(() => setLoadingStep(2), 2200);
    const timer3 = setTimeout(() => setLoadingStep(3), 4000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [loading]);

  const LOADING_MESSAGES = [
    "Contacting OSRM road network for corridors...",
    "Computing checkpoint mileage & truck ETAs...",
    "Fetching Open-Meteo hourly wind, rain & snow...",
    "Evaluating crosswind dynamics & safety ranking...",
  ];

  function handleSwapPlaces() {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
    setValidationError("");
  }

  function handleQuickTime(offsetHours) {
    const d = new Date();
    d.setHours(d.getHours() + offsetHours);
    d.setMinutes(0, 0, 0);
    setDeparture(formatLocalDatetime(d));
  }

  function handleTomorrowMorning() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(7, 0, 0, 0);
    setDeparture(formatLocalDatetime(d));
  }

  async function resolvePlace(place) {
    if (place?.lat && place?.lon) return place;
    if (typeof place === "string" && place.trim().length > 2) {
      const res = await geocode(place.trim());
      if (res.results && res.results.length > 0) return res.results[0];
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setValidationError("");

    if (!origin) {
      setValidationError("Please specify a departure origin.");
      return;
    }
    if (!destination) {
      setValidationError("Please specify an arrival destination.");
      return;
    }

    try {
      const resolvedOrigin = await resolvePlace(origin);
      const resolvedDest = await resolvePlace(destination);

      if (!resolvedOrigin) {
        setValidationError("Could not resolve coordinates for the origin. Please pick from suggestions.");
        return;
      }
      if (!resolvedDest) {
        setValidationError("Could not resolve coordinates for the destination. Please pick from suggestions.");
        return;
      }

      // Check distance / identical places
      const latDiff = Math.abs(resolvedOrigin.lat - resolvedDest.lat);
      const lonDiff = Math.abs(resolvedOrigin.lon - resolvedDest.lon);
      if (latDiff < 0.01 && lonDiff < 0.01) {
        setValidationError("Origin and Destination are identical. Please choose distinct locations.");
        return;
      }

      const numWeight = Number(weight);
      if (isNaN(numWeight) || numWeight < 1 || numWeight > 200000) {
        setValidationError("Load weight must be between 1 and 200,000 lbs.");
        return;
      }

      const departDate = new Date(departure);
      if (isNaN(departDate.getTime())) {
        setValidationError("Please provide a valid departure date and time.");
        return;
      }

      onSubmit({
        origin: resolvedOrigin,
        destination: resolvedDest,
        departure: departDate.toISOString(),
        weight_lb: numWeight,
        interval_miles: interval,
      });
    } catch (err) {
      setValidationError(err.message || "Failed to validate trip configuration.");
    }
  }

  // Crosswind risk advisory based on entered weight
  const isHeavyLoad = Number(weight) > 40000;
  const isMediumLoad = Number(weight) > 30000;

  return (
    <form className="trip-form-card" onSubmit={handleSubmit} noValidate>
      <div className="places-container">
        <PlaceInput
          id="trip-origin"
          label="Origin"
          icon="map-pin"
          placeholder="e.g. Chicago, IL or warehouse address"
          value={origin}
          onChange={(val) => {
            setOrigin(val);
            setValidationError("");
          }}
        />

        <div className="swap-button-row">
          <button
            type="button"
            className="swap-btn"
            onClick={handleSwapPlaces}
            title="Swap Origin and Destination"
            aria-label="Swap Origin and Destination"
          >
            <Icon name="swap" size={16} />
          </button>
        </div>

        <PlaceInput
          id="trip-destination"
          label="Destination"
          icon="navigation"
          placeholder="e.g. Denver, CO or distribution center"
          value={destination}
          onChange={(val) => {
            setDestination(val);
            setValidationError("");
          }}
        />
      </div>

      <div className="form-grid-two">
        {/* Departure Time */}
        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="trip-departure" className="field-label">
              <Icon name="calendar" size={14} className="label-icon" />
              <span>Departure Time</span>
            </label>
          </div>
          <input
            id="trip-departure"
            type="datetime-local"
            className="text-input"
            required
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
          <div className="quick-chips">
            <button type="button" className="chip-btn" onClick={() => handleQuickTime(0)}>
              Now
            </button>
            <button type="button" className="chip-btn" onClick={() => handleQuickTime(2)}>
              +2 hrs
            </button>
            <button type="button" className="chip-btn" onClick={handleTomorrowMorning}>
              Tmrw 7 AM
            </button>
          </div>
        </div>

        {/* Load Weight */}
        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="trip-weight" className="field-label">
              <Icon name="scale" size={14} className="label-icon" />
              <span>Load Weight (lb)</span>
            </label>
            <span className="weight-display">{Number(weight).toLocaleString()} lb</span>
          </div>
          <input
            id="trip-weight"
            type="number"
            className="text-input"
            min="1000"
            max="200000"
            step="500"
            required
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <div className="quick-chips">
            {WEIGHT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`chip-btn ${Number(weight) === p.value ? "active" : ""}`}
                onClick={() => setWeight(p.value)}
                title={p.label}
              >
                {(p.value / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Physics risk notice for current weight */}
      <div className={`weight-advisory ${isHeavyLoad ? "advisory-heavy" : isMediumLoad ? "advisory-medium" : "advisory-standard"}`}>
        <Icon name="info" size={14} className="advisory-icon" />
        <span className="advisory-text">
          {isHeavyLoad ? (
            <>
              <strong>Heavy load &gt;40k lb:</strong> Escalates 35–44 mph winds to <em>Severe</em> risk due to rollover torque.
            </>
          ) : isMediumLoad ? (
            <>
              <strong>Load &gt;30k lb:</strong> Triggers <em>No Travel</em> at 45–54 mph crosswinds.
            </>
          ) : (
            <>
              <strong>Standard weight:</strong> Universal No Travel applies at &ge;55 mph crosswinds.
            </>
          )}
        </span>
      </div>

      {/* Checkpoint interval selector */}
      <div className="field-group">
        <div className="field-label-row">
          <label htmlFor="trip-interval" className="field-label">
            <Icon name="compass" size={14} className="label-icon" />
            <span>Weather Sampling Spacing</span>
          </label>
        </div>
        <select
          id="trip-interval"
          className="select-input"
          value={interval}
          onChange={(e) => setIntervalMiles(e.target.value)}
        >
          <option value="auto">Automatic (Dynamic: 10 mi for short, 25 mi medium, 50 mi long trips)</option>
          <option value="10">High Precision — Every 10 miles (dense weather checkpoints)</option>
          <option value="25">Balanced — Every 25 miles (standard regional)</option>
          <option value="50">Highway Corridor — Every 50 miles (fast long-haul overview)</option>
        </select>
      </div>

      {validationError && (
        <div className="form-error-banner" role="alert">
          <Icon name="alert-triangle" size={16} />
          <span>{validationError}</span>
        </div>
      )}

      {loading && (
        <div className="loading-card" aria-live="polite">
          <div className="loading-header">
            <span className="pulse-loader" />
            <span className="loading-text">{LOADING_MESSAGES[loadingStep]}</span>
          </div>
          <div className="loading-progress-bar">
            <div className="loading-bar-fill" style={{ width: `${(loadingStep + 1) * 25}%` }} />
          </div>
        </div>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="submit-btn"
          disabled={loading}
          aria-busy={loading}
        >
          <Icon name="truck" size={18} />
          <span>{loading ? "Analyzing Corridors…" : "Analyze & Compare Routes"}</span>
        </button>
      </div>
    </form>
  );
}
