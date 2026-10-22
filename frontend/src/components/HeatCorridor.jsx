import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { levelColor } from "../risk.js";

const RADIUS_M = 12000;
const MAX_NODES = 700;

/** Interpolate extra points between checkpoints so the heat reads as a continuous corridor. */
function densify(routes) {
  const totalMiles = routes.reduce((a, r) => a + r.distance_mi, 0);
  const step = Math.max(6, totalMiles / MAX_NODES);
  const nodes = [];
  for (const r of routes) {
    const cps = r.checkpoints;
    for (let i = 0; i < cps.length; i++) {
      const a = cps[i];
      const b = cps[i + 1] || a;
      const n = i === cps.length - 1 ? 1 : Math.max(1, Math.round((b.mile - a.mile) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        nodes.push({
          lat: a.lat + (b.lat - a.lat) * t,
          lon: a.lon + (b.lon - a.lon) * t,
          t,
          fa: a.forecast,
          fb: b.forecast,
        });
      }
    }
  }
  return nodes;
}

export default function HeatCorridor({ routes, hour, visible }) {
  const map = useMap();
  const nodes = useMemo(() => densify(routes), [routes]);
  const circlesRef = useRef([]);
  const groupRef = useRef(null);

  // Build the layer once per result: a canvas-rendered, softly blurred pane of translucent circles.
  useEffect(() => {
    if (!map.getPane("heat")) {
      const pane = map.createPane("heat");
      pane.style.zIndex = 350;
      pane.style.filter = "blur(7px)";
      pane.style.pointerEvents = "none";
    }
    const renderer = L.canvas({ pane: "heat", padding: 0.5 });
    const circles = nodes.map((n) =>
      L.circle([n.lat, n.lon], { radius: RADIUS_M, stroke: false, fillOpacity: 0.3, renderer, interactive: false })
    );
    circlesRef.current = circles;
    groupRef.current = L.layerGroup(circles);
    return () => {
      map.removeLayer(groupRef.current);
    };
  }, [map, nodes]);

  // Recolour for the chosen forecast hour; cheap, so the slider stays smooth.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    if (!visible) {
      map.removeLayer(group);
      return;
    }
    if (!map.hasLayer(group)) group.addTo(map);
    nodes.forEach((n, i) => {
      const h = Math.min(hour, n.fa.length - 1);
      const level = n.fa[h][0] * (1 - n.t) + n.fb[h][0] * n.t;
      circlesRef.current[i].setStyle({ fillColor: levelColor(level) });
    });
  }, [map, nodes, hour, visible]);

  return null;
}
