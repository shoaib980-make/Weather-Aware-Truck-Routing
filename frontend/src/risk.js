export const LEVELS = ["Low", "Moderate", "High", "Severe", "No Travel"];
export const LEVEL_COLORS = ["#2f9e6e", "#e2b928", "#ee8a2b", "#d8433b", "#6d1b7b"];
export const ROUTE_COLORS = ["#0f6cbd", "#7a4fd1", "#0b8f9c"];

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

export const fmtTime = (iso) =>
  new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function fmtDuration(seconds) {
  const m = Math.round(seconds / 60);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m`;
}
