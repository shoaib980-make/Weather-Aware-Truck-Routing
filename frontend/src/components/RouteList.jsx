import { LEVELS, LEVEL_COLORS, ROUTE_COLORS, fmtDuration, fmtTime } from "../risk.js";

function MixBar({ miles }) {
  const total = Object.values(miles).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="mix" role="img" aria-label={LEVELS.map((l) => `${l} ${Math.round(miles[l])} miles`).join(", ")}>
      {LEVELS.map((l, i) => miles[l] > 0 && <span key={l} style={{ width: `${(miles[l] / total) * 100}%`, background: LEVEL_COLORS[i] }} title={`${l}: ${Math.round(miles[l])} mi`} />)}
    </div>
  );
}

function RouteCard({ route, selected, recommended, onSelect }) {
  const s = route.stats;
  return (
    <li>
      <button className={`route-card ${selected ? "selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
        <div className="route-head">
          <span className="swatch" style={{ background: ROUTE_COLORS[(route.id - 1) % 3] }} />
          <strong>{route.name}</strong>
          {recommended && <span className="badge">Recommended</span>}
        </div>
        <div className="route-meta">
          <span>{Math.round(route.distance_mi)} mi</span>
          <span>{fmtDuration(route.duration_s)}</span>
          <span>Avg risk {s.avg_risk.toFixed(2)}</span>
        </div>
        <MixBar miles={s.miles_by_level} />
        <div className="route-meta small">
          <span>No Travel {s.no_travel_miles} mi</span>
          <span>Severe {s.severe_miles} mi</span>
          <span>High {s.high_miles} mi</span>
        </div>
      </button>
    </li>
  );
}

function CheckpointTable({ route }) {
  return (
    <details className="checkpoints" open>
      <summary>{route.name}: {route.checkpoints.length} checkpoints, every {route.interval_mi} mi</summary>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mile</th><th>ETA</th><th>Wind</th><th>Rain</th><th>Snow</th><th>Risk</th></tr></thead>
          <tbody>
            {route.checkpoints.map((c) => (
              <tr key={c.mile}>
                <td>{Math.round(c.mile)}</td>
                <td>{fmtTime(c.eta)}</td>
                <td>{c.wind_mph} mph</td>
                <td>{c.rain_in_hr} in/hr</td>
                <td>{c.snow_in_hr} in/hr</td>
                <td><span className="pill" style={{ background: LEVEL_COLORS[c.level] }}>{c.level_name}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function RouteList({ result, selectedId, onSelect }) {
  const selected = result.routes.find((r) => r.id === selectedId);
  return (
    <section className="results" aria-live="polite">
      <div className="recommendation">
        <h2>Take Route {result.recommended_id}</h2>
        <p>{result.rationale}</p>
      </div>
      <ul className="route-list">
        {result.routes.map((r) => (
          <RouteCard key={r.id} route={r} selected={r.id === selectedId} recommended={r.id === result.recommended_id} onSelect={() => onSelect(r.id)} />
        ))}
      </ul>
      {selected && <CheckpointTable route={selected} />}
    </section>
  );
}
