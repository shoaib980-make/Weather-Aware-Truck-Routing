import { useState } from "react";
import { geocode } from "../api.js";
import PlaceInput from "./PlaceInput.jsx";

const pad = (n) => String(n).padStart(2, "0");
function localInputValue(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function nextHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return localInputValue(d);
}

const EXAMPLE = {
  origin: { label: "Chicago, Illinois", lat: 41.8781, lon: -87.6298 },
  destination: { label: "Denver, Colorado", lat: 39.7392, lon: -104.9903 },
};

export default function TripForm({ onSubmit, loading }) {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [departure, setDeparture] = useState(nextHour);
  const [weight, setWeight] = useState(42000);
  const [interval, setIntervalMiles] = useState("auto");
  const [formError, setFormError] = useState("");

  // If the user typed a place but didn't pick a suggestion, use the first match.
  async function resolve(place, text) {
    if (place) return place;
    const { results } = await geocode(text);
    if (!results.length) throw new Error(`Couldn't find "${text}".`);
    return results[0];
  }

  async function submit(e) {
    e.preventDefault();
    setFormError("");
    try {
      const typed = (id) => document.getElementById(id).value.trim();
      if (!typed("origin") || !typed("destination")) throw new Error("Enter an origin and a destination.");
      const [o, d] = await Promise.all([resolve(origin, typed("origin")), resolve(destination, typed("destination"))]);
      setOrigin(o);
      setDestination(d);
      onSubmit({
        origin: o,
        destination: d,
        departure: new Date(departure).toISOString(),
        weight_lb: Number(weight),
        interval_miles: interval,
      });
    } catch (err) {
      setFormError(err.message);
    }
  }

  return (
    <form className="trip-form" onSubmit={submit}>
      <PlaceInput id="origin" label="Origin" value={origin} onChange={setOrigin} />
      <PlaceInput id="destination" label="Destination" value={destination} onChange={setDestination} />
      <div className="row">
        <div className="field">
          <label htmlFor="departure">Departure</label>
          <input id="departure" type="datetime-local" required value={departure} onChange={(e) => setDeparture(e.target.value)} />
        </div>
        <div className="field narrow">
          <label htmlFor="weight">Load (lb)</label>
          <input id="weight" type="number" min="1" max="200000" step="500" required value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="interval">Weather checkpoints</label>
        <select id="interval" value={interval} onChange={(e) => setIntervalMiles(e.target.value)}>
          <option value="auto">Automatic (10 / 25 / 50 mi by trip length)</option>
          <option value="10">Every 10 miles</option>
          <option value="25">Every 25 miles</option>
          <option value="50">Every 50 miles</option>
        </select>
      </div>
      {formError && <p className="error" role="alert">{formError}</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={loading}>{loading ? "Checking weather…" : "Find safest route"}</button>
        <button type="button" className="ghost" onClick={() => { setOrigin(EXAMPLE.origin); setDestination(EXAMPLE.destination); }}>
          Use example trip
        </button>
      </div>
    </form>
  );
}
