import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { levelColor } from "../risk.js";

const RADIUS_M = 14000;
const MAX_NODES = 600;

/** Interpolate extra points between checkpoints so the heat reads as a continuous corridor. */
function densify(routes) {
  if (!routes || routes.length === 0) return [];
  const totalMiles = routes.reduce((a, r) => a + (r.distance_mi || 0), 0);
  if (totalMiles <= 0) return [];
  const step = Math.max(8, totalMiles / MAX_NODES);
  const nodes = [];

  for (const r of routes) {
    const cps = r.checkpoints || [];
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
          fa: a.forecast || [],
          fb: b.forecast || [],
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

  // Setup pane and layer once per route dataset
  useEffect(() => {
    if (!map) return;

    if (!map.getPane("heat")) {
      const pane = map.createPane("heat");
      pane.style.zIndex = "350";
      pane.style.filter = "blur(9px)";
      pane.style.pointerEvents = "none";
    }

    if (groupRef.current) {
      map.removeLayer(groupRef.current);
      groupRef.current = null;
      circlesRef.current = [];
    }

    if (nodes.length === 0) return;

    const renderer = L.canvas({ pane: "heat", padding: 0.5 });
    const circles = nodes.map((n) =>
      L.circle([n.lat, n.lon], {
        radius: RADIUS_M,
        stroke: false,
        fillOpacity: 0.38,
        renderer,
        interactive: false,
      })
    );

    circlesRef.current = circles;
    const group = L.layerGroup(circles);
    groupRef.current = group;

    if (visible) {
      group.addTo(map);
    }

    return () => {
      if (groupRef.current && map) {
        map.removeLayer(groupRef.current);
      }
    };
  }, [map, nodes]);

  // Fast recoloring for the selected forecast hour (no expensive re-render of canvas)
  useEffect(() => {
    const group = groupRef.current;
    if (!group || !map) return;

    if (!visible) {
      if (map.hasLayer(group)) map.removeLayer(group);
      return;
    }

    if (!map.hasLayer(group)) {
      group.addTo(map);
    }

    const circles = circlesRef.current;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!circles[i]) continue;
      const faLen = n.fa.length;
      const fbLen = n.fb.length;
      if (faLen === 0 || fbLen === 0) continue;

      const ha = Math.min(hour, faLen - 1);
      const hb = Math.min(hour, fbLen - 1);
      const level = n.fa[ha][0] * (1 - n.t) + n.fb[hb][0] * n.t;
      circles[i].setStyle({ fillColor: levelColor(level) });
    }
  }, [map, nodes, hour, visible]);

  return null;
}
