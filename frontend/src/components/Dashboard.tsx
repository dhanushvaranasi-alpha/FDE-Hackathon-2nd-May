import { useState } from "react";
import type { ClinicResult, TriageResult } from "../types";
import "./Dashboard.css";

const TIER_LABELS: Record<string, string> = {
  EMERGENCY: "Emergency — immediate care",
  URGENT: "Urgent — within hours",
  SOON: "Soon — 24–72 hours",
  ROUTINE: "Routine — 1–2 weeks",
  SELF_CARE: "Self-care — monitor",
  INSUFFICIENT_INFO: "Need more information",
};

const TIER_ICONS: Record<string, string> = {
  EMERGENCY: "🚨",
  URGENT: "⚡",
  SOON: "🕒",
  ROUTINE: "📅",
  SELF_CARE: "🏠",
  INSUFFICIENT_INFO: "🔍",
};

const LIKELIHOOD_PERCENT: Record<string, string> = {
  HIGH: "90%",
  MEDIUM: "50%",
  LOW: "20%",
};

interface DashboardProps {
  triage: TriageResult | null;
  clinicResults: ClinicResult[];
  clinicSearchStatus: "skipped" | "ok" | "disabled" | "error";
}

export function Dashboard({
  triage,
  clinicResults,
  clinicSearchStatus,
}: DashboardProps) {
  const [showClinicsDespiteEmergency, setShowClinicsDespiteEmergency] =
    useState(false);

  if (!triage) {
    return (
      <section id="dashboard-view" className="dashboard-panel panel empty" aria-label="Triage summary">
        <div className="dashboard-empty-state">
          <div className="empty-icon-large">📊</div>
          <h3>Triage Summary</h3>
          <p>
            Your results will appear here after analysis. 
            <strong> Enter an address above</strong> to find nearby clinics.
          </p>
        </div>
      </section>
    );
  }

  const isHighAlert = triage.tier === "EMERGENCY" || triage.tier === "URGENT";
  const hideClinicsDefault = triage.tier === "EMERGENCY" && !showClinicsDespiteEmergency;

  return (
    <section id="dashboard-view" className="dashboard-panel panel animate-fade-in" aria-label="Triage summary">
      {/* High-Impact Urgency Header */}
      <div className={`urgency-hero tier-${triage.tier.toLowerCase()}`}>
        <div className="hero-icon">{TIER_ICONS[triage.tier]}</div>
        <div className="hero-content">
          <span className="hero-label">Recommended Urgency</span>
          <h2 className="hero-title">{TIER_LABELS[triage.tier] ?? triage.tier}</h2>
          <div className="hero-meta">
            <span className="confidence-pill">
              {triage.confidence} Confidence
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-scroll-area">
        {triage.mental_health_flag && (
          <div className="dashboard-alert dashboard-alert--mh" role="status">
            <div className="alert-icon">🧘</div>
            <div className="alert-content">
              <strong>Mental health support</strong>
              <p>
                Reach <strong>Tele-MANAS</strong>: <a href="tel:14416">14416</a> or 
                <strong> AASRA</strong>: <a href="tel:9820466726">9820466726</a>.
              </p>
            </div>
          </div>
        )}

        {isHighAlert && triage.emergency_contact && (
          <div className="emergency-contact-box">
            <span className="box-label">Emergency Number</span>
            <a href={`tel:${triage.emergency_contact.replace(/\s/g, "")}`} className="box-number">
              {triage.emergency_contact}
            </a>
          </div>
        )}

        <div className="dashboard-section">
          <h3 className="section-title">Analysis & Guidance</h3>
          
          <div className="recommendation-hero-card">
            <div className="rec-icon-large">💡</div>
            <div className="rec-text">
              <h4>Recommended Action</h4>
              <p>{triage.recommended_action}</p>
            </div>
          </div>

          <div className="analysis-grid">
            {triage.suggested_conditions.length > 0 && (
              <div className="dashboard-block conditions-card">
                <h3>Possible conditions</h3>
                <div className="condition-stack">
                  {triage.suggested_conditions.map((c, i) => (
                    <div key={i} className="condition-card-mini">
                      <div className="condition-info">
                        <strong>{c.name}</strong>
                        <p>{c.rationale}</p>
                      </div>
                      <div className="condition-meter-box">
                        <span className={`likelihood-label likelihood-${c.likelihood.toLowerCase()}`}>
                          {c.likelihood}
                        </span>
                        <div className="meter-bg">
                          <div 
                            className={`meter-fill likelihood-${c.likelihood.toLowerCase()}`} 
                            style={{ width: LIKELIHOOD_PERCENT[c.likelihood] }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {triage.red_flags_detected.length > 0 && (
              <div className="dashboard-block danger-card">
                <h3>Red flags noted</h3>
                <ul className="danger-list">
                  {triage.red_flags_detected.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {triage.report_analysis && triage.report_analysis.length > 0 && (
          <div className="dashboard-section animate-fade-in">
            <h3 className="section-title">Medical Report Analysis</h3>
            <div className="report-insight-grid">
              {triage.report_analysis.map((insight, i) => (
                <div key={i} className="report-insight-card">
                  <div className="insight-header">
                    <span className="insight-category">{insight.category}</span>
                    <span className="insight-original">{insight.detail}</span>
                  </div>
                  <p className="insight-simple">
                    <span className="sparkle-icon">✨</span>
                    {insight.simplified_explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {triage.follow_up_questions.length > 0 && (
          <div className="dashboard-block questions-card">
            <h3>Follow-up Considerations</h3>
            <ul className="styled-list">
              {triage.follow_up_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {clinicResults.length > 0 && (
          <div className="dashboard-section">
            <div className="section-header">
              <h3 className="section-title">Nearby Facilities</h3>
              {hideClinicsDefault && (
                <button
                  type="button"
                  className="btn-link-small"
                  onClick={() => setShowClinicsDespiteEmergency(true)}
                >
                  Show clinics
                </button>
              )}
            </div>

            {!hideClinicsDefault && (
              <div className="clinic-compact-grid">
                {clinicResults.map((c, i) => (
                  <div key={i} className="clinic-card-mini">
                    <div className="clinic-details">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="clinic-name">
                          {c.title}
                        </a>
                      ) : (
                        <span className="clinic-name">{c.title}</span>
                      )}
                      {c.snippet && <p className="clinic-desc">{c.snippet}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <footer className="dashboard-footer">
          <p>{triage.disclaimer}</p>
        </footer>
      </div>
    </section>
  );
}
