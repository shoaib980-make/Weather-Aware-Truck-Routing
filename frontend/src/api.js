const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) || "";

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

/* ==========================================================================
   Saved Trips & Reanalysis API
   ========================================================================== */

export const listTrips = (signal) =>
  request("/api/trips", { signal, timeout: 10000 });

export const saveTrip = (body, signal) =>
  request("/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    timeout: 15000,
  });

export const getTrip = (id, signal) =>
  request(`/api/trips/${id}`, { signal, timeout: 10000 });

export const updateTrip = (id, body, signal) =>
  request(`/api/trips/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

export const deleteTrip = (id, signal) =>
  request(`/api/trips/${id}`, {
    method: "DELETE",
    signal,
  });

export const duplicateTrip = (id, body = {}, signal) =>
  request(`/api/trips/${id}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

export const reanalyzeTrip = (id, body = {}, signal) =>
  request(`/api/trips/${id}/reanalyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    timeout: 50000,
  });

export const getTripAnalysis = (tripId, analysisId, signal) =>
  request(`/api/trips/${tripId}/analyses/${analysisId}`, { signal });

/* ==========================================================================
   PDF Report Download Utilities
   ========================================================================== */

export function getRouteReportFilename(origin, destination) {
  const getClean = (place) => {
    if (!place) return "";
    const raw = typeof place === "string" ? place : (place.label || place.name || "");
    if (!raw || typeof raw !== "string") return "";
    const primary = raw.split(",")[0].trim();
    return primary
      .replace(/[\\/*?:"<>|]/g, "")
      .trim()
      .replace(/[\s\-]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const o = getClean(origin);
  const d = getClean(destination);

  if (o && d) {
    return `${o}_to_${d}_Route_Report.pdf`;
  }
  return "SafeHaul_Route_Report.pdf";
}

export async function downloadPdfBlob(path, filename, options = {}) {
  const controller = new AbortController();
  const signal = options.signal || controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 45000);

  try {
    const res = await fetch(BASE + path, { ...options, signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let msg = `PDF generation failed (HTTP ${res.status})`;
      try {
        const data = JSON.parse(text);
        if (data.error) msg = data.error;
      } catch (_) {}
      throw new Error(msg);
    }

    let downloadFilename = filename;
    if (!downloadFilename) {
      const disposition = res.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/);
        if (match && match[1]) downloadFilename = match[1];
      }
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = downloadFilename || "SafeHaul_Route_Report.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError" && !options.signal?.aborted) {
      throw new Error("PDF report generation timed out. Please retry.");
    }
    throw err;
  }
}

export const downloadSavedTripPdf = (tripId, analysisId, filename) => {
  const url = analysisId
    ? `/api/trips/${tripId}/analyses/${analysisId}/report.pdf`
    : `/api/trips/${tripId}/report.pdf`;
  return downloadPdfBlob(url, filename);
};

export const downloadOnDemandPdf = (tripInfo, analysisData, filename) => {
  return downloadPdfBlob("/api/report/pdf", filename, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trip: tripInfo, analysis_data: analysisData }),
  });
};

