const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const controller = new AbortController();
  const signal = options.signal || controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 35000);

  try {
    const res = await fetch(BASE + path, { ...options, signal });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || (res.status === 502
        ? "Routing or weather upstream service is temporarily unavailable. Please retry in a few seconds."
        : `Request failed (HTTP ${res.status})`);
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError" && !options.signal?.aborted) {
      throw new Error("Request timed out. The routing or weather service took too long to respond.");
    }
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error("Cannot connect to server. Please verify the backend is running at http://127.0.0.1:8000.");
    }
    throw err;
  }
}

export const checkHealth = (signal) =>
  request("/api/health", { signal, timeout: 5000 }).then((d) => d.status === "ok").catch(() => false);

export const geocode = (q, signal) =>
  request(`/api/geocode?q=${encodeURIComponent(q)}`, { signal, timeout: 8000 });

export const analyze = (body, signal) =>
  request("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    timeout: 45000,
  });
