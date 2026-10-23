import React from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("SafeHaul RouteIQ UI Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px 20px", maxWidth: "600px", margin: "80px auto", fontFamily: "sans-serif", textAlign: "center", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 10px 25px rgba(0,0,0,0.08)" }}>
          <h2 style={{ color: "#ef4444", marginBottom: "12px" }}>Application Error Encountered</h2>
          <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6" }}>
            An unexpected error occurred while rendering the view.
          </p>
          <pre style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", fontSize: "12px", textAlign: "left", overflowX: "auto", color: "#334155", border: "1px solid #e2e8f0" }}>
            {this.state.error?.toString() || "Unknown error"}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: "16px", padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
