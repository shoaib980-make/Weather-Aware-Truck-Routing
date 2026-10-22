export const LEVELS = ["Low", "Moderate", "High", "Severe", "No Travel", "Unknown"];

export const LEVEL_COLORS = [
  "#10b981", // Low - Emerald Green
  "#f59e0b", // Moderate - Amber
  "#f97316", // High - Alert Orange
  "#ef4444", // Severe - Danger Red
  "#7c3aed", // No Travel - Deep Purple
  "#64748b", // Unknown - Slate Gray
];

export const LEVEL_BG_TINTS = [
  "rgba(16, 185, 129, 0.12)",
  "rgba(245, 158, 11, 0.14)",
  "rgba(249, 115, 22, 0.15)",
  "rgba(239, 68, 68, 0.15)",
  "rgba(124, 58, 237, 0.16)",
  "rgba(100, 116, 139, 0.16)",
];

export const ROUTE_COLORS = [
  "#2563eb", // Route 1: Cobalt Blue
  "#7c3aed", // Route 2: Royal Purple
  "#0891b2", // Route 3: Deep Cyan
];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

/** Smoothly interpolated colour for a fractional risk level (0-4). */
export function levelColor(x) {
  const v = Math.max(0, Math.min(4, x));
  const i = Math.min(3, Math.floor(v));
  const t = v - i;
  const a = hex(LEVEL_COLORS[i]);
  const b = hex(LEVEL_COLORS[i + 1]);
  return `rgb(${a.map((n, k) => Math.round(n + (b[k] - n) * t)).join(",")})`;
}

export function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtTimeOnly(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return "0 m";
  const m = Math.round(seconds / 60);
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours === 0) return `${mins} m`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

export function calcETA(departureIso, durationSeconds) {
  if (!departureIso) return "—";
  const d = new Date(departureIso);
  if (isNaN(d.getTime())) return "—";
  const eta = new Date(d.getTime() + (durationSeconds || 0) * 1000);
  return eta.toISOString();
}

export function getRiskLevelBadge(level) {
  const idx = Math.max(0, Math.min(5, Math.round(level)));
  return {
    name: LEVELS[idx],
    color: LEVEL_COLORS[idx],
    bg: LEVEL_BG_TINTS[idx],
  };
}
