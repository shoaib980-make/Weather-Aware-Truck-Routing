import React, { useEffect } from "react";
import { Icon } from "./Icons.jsx";
import { LEVELS, LEVEL_COLORS } from "../risk.js";

export default function SafetyModal({ isOpen, onClose }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="safety-modal-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <Icon name="shield-check" size={22} />
            </div>
            <div>
              <h2 id="safety-modal-title">Safety Thresholds & Truck Rollover Rules</h2>
              <p className="modal-subtitle">Official federal crosswind physics and weather risk classification standard</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="modal-body">
          <section className="modal-section">
            <h3 className="section-title">
              <Icon name="wind" size={16} /> Weather Risk Matrix
            </h3>
            <p className="section-desc">
              Checkpoints sample sustained 10-meter wind speed, hourly precipitation rate, and snowfall accumulation at the exact projected time of truck arrival.
            </p>
            <div className="table-responsive">
              <table className="safety-table">
                <thead>
                  <tr>
                    <th>Risk Level</th>
                    <th>Sustained Wind</th>
                    <th>Rain Rate</th>
                    <th>Snow Rate</th>
                    <th>Operational Guidance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="pill" style={{ background: LEVEL_COLORS[0] }}>Low</span>
                    </td>
                    <td>&lt; 25 mph</td>
                    <td>&lt; 0.10 in/hr</td>
                    <td>&lt; 0.5 in/hr</td>
                    <td>Safe for normal highway travel. Standard precautions.</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="pill" style={{ background: LEVEL_COLORS[1] }}>Moderate</span>
                    </td>
                    <td>25 – 34 mph</td>
                    <td>0.10 – 0.24 in/hr</td>
                    <td>0.5 – 0.9 in/hr</td>
                    <td>Maintain increased following distance. Be alert for gusts.</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="pill" style={{ background: LEVEL_COLORS[2] }}>High</span>
                    </td>
                    <td>35 – 44 mph</td>
                    <td>0.25 – 0.49 in/hr</td>
                    <td>1.0 – 1.9 in/hr</td>
                    <td>Reduce speed by 15-20 mph. Heightened crosswind sensitivity.</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="pill" style={{ background: LEVEL_COLORS[3] }}>Severe</span>
                    </td>
                    <td>45 – 54 mph</td>
                    <td>0.50 – 1.00 in/hr</td>
                    <td>2.0 – 3.0 in/hr</td>
                    <td>Significant danger. High rollover risk; consider holding at rest stop.</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="pill" style={{ background: LEVEL_COLORS[4] }}>No Travel</span>
                    </td>
                    <td>&ge; 55 mph</td>
                    <td>&gt; 1.00 in/hr</td>
                    <td>&gt; 3.0 in/hr</td>
                    <td><strong>DO NOT PROCEED.</strong> Extreme rollover or whiteout corridor.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="modal-section highlight-box">
            <h3 className="section-title text-alert">
              <Icon name="scale" size={16} /> Load Weight & Crosswind Rollover Mechanics
            </h3>
            <p className="section-desc">
              Heavy 53-ft dry vans and refrigerated trailers present large aerodynamic sail areas. High gross vehicle weight amplifies rollover moments and tire-slip angles in lateral shear winds.
            </p>
            <div className="rules-grid">
              <div className="rule-card">
                <div className="rule-badge no-travel">No Travel Rule</div>
                <h4>Wind &ge; 55 mph</h4>
                <p>Universal travel ban regardless of gross vehicle weight. Crosswinds exceed safe lateral resistance.</p>
              </div>
              <div className="rule-card">
                <div className="rule-badge no-travel">No Travel Rule</div>
                <h4>Wind 45–54 mph + Weight &gt; 30,000 lb</h4>
                <p>Classified as <strong>No Travel</strong> due to elevated center-of-gravity and trailer tip threshold.</p>
              </div>
              <div className="rule-card">
                <div className="rule-badge severe">Severe Risk Rule</div>
                <h4>Wind 35–44 mph + Weight &gt; 40,000 lb</h4>
                <p>Escalated to <strong>Severe</strong> due to lateral sway, lane encroachment, and jackknife vulnerability.</p>
              </div>
            </div>
          </section>

          <section className="modal-section">
            <h3 className="section-title">
              <Icon name="shield-check" size={16} /> Lexicographic Recommendation Algorithm
            </h3>
            <p className="section-desc">
              The routing engine evaluates all candidate corridors through a strict lexicographic priority queue:
            </p>
            <ol className="priority-list">
              <li>
                <strong>Fewest No Travel Miles:</strong> Any route traversing No Travel segments is strictly penalized.
              </li>
              <li>
                <strong>Fewest Severe Miles:</strong> Minimizes exposure to dangerous storm cells and gale winds.
              </li>
              <li>
                <strong>Fewest High-Risk Miles:</strong> Limits sustained buffeting and hazardous driving conditions.
              </li>
              <li>
                <strong>Lowest Route Average Risk:</strong> Integrated corridor risk weighted by segment lengths.
              </li>
              <li>
                <strong>Shortest Travel Time:</strong> Final tie-breaker when safety scores are equivalent.
              </li>
            </ol>
          </section>
        </div>

        <div className="modal-footer">
          <button className="primary-btn" onClick={onClose}>
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
