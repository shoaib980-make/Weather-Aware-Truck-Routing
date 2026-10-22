const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options) {
  const res = await fetch(BASE + path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const geocode = (q, signal) => request(`/api/geocode?q=${encodeURIComponent(q)}`, { signal });

export const analyze = (body) =>
  request("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
