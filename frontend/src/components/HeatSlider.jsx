import { useEffect, useState } from "react";
import { LEVELS, LEVEL_COLORS } from "../risk.js";

const MAX_HOUR = 48;

export default function HeatSlider({ start, hour, onHour, showHeat, onToggle }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => onHour((h) => (h >= MAX_HOUR ? 0 : h + 1)), 500);
    return () => clearInterval(id);
  }, [playing, onHour]);

  const when = new Date(new Date(start).getTime() + hour * 3600_000);
  return (
    <div className="heat-bar">
      <div className="heat-top">
        <label className="toggle">
          <input type="checkbox" checked={showHeat} onChange={(e) => onToggle(e.target.checked)} /> Weather heatmap
        </label>
        <button className="ghost small" onClick={() => setPlaying((p) => !p)} disabled={!showHeat}>{playing ? "Pause" : "Play"}</button>
        <output htmlFor="hour">
          {when.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} (+{hour} h)
        </output>
      </div>
      <input id="hour" type="range" min="0" max={MAX_HOUR} value={hour} disabled={!showHeat} onChange={(e) => onHour(Number(e.target.value))} aria-label="Forecast hour after departure" />
      <div className="legend">
        {LEVELS.map((l, i) => <span key={l}><i style={{ background: LEVEL_COLORS[i] }} />{l}</span>)}
      </div>
    </div>
  );
}
