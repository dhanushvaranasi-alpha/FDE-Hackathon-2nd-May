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
      <section className="dashboard panel" aria-label="Triage summary">
        <p className="dashboard-empty">
          Your triage summary will appear here after you send symptoms (chat or
          form).
        </p>
      </section>
    );
  }

  const tierClass = `tier-badge tier-${triage.tier.toLowerCase()}`;
  const isHighAlert =
    triage.tier === "EMERGENCY" || triage.tier === "URGENT";
  const hideClinicsDefault =
    triage.tier === "EMERGENCY" && !showClinicsDespiteEmergency;

  return (
    <section className="dashboard panel" aria-label="Triage summary">
      {triage.mental_health_flag && (
        <div className="dashboard-alert dashboard-alert--mh" role="status">
          <strong>Mental health support</strong>
          <p>
            If you are in India, you can reach{" "}
            <strong>iCall</strong> at <a href="tel:9152987821">9152987821</a>,{" "}
            <strong>Tele-MANAS</strong> at{" "}
            <a href="tel:14416">14416</a> /{" "}
            <a href="tel:18008914416">1800-891-4416</a>, or{" "}
            <strong>AASRA</strong> at{" "}
            <a href="tel:9820466726">9820466726</a>. For abuse-related concerns,
            Women Helpline <a href="tel:181">181</a>.
          </p>
        </div>
      )}

      {isHighAlert && (
        <div
          className={`dashboard-alert ${triage.tier === "EMERGENCY" ? "dashboard-alert--em" : "dashboard-alert--ur"}`}
          role="alert"
        >
          <strong>
            {triage.tier === "EMERGENCY"
              ? "Possible emergency"
              : "Urgent medical attention"}
          </strong>
          {triage.emergency_contact && (
            <p className="dashboard-em-contact">
              Emergency:{" "}
              <a href={`tel:${triage.emergency_contact.replace(/\s/g, "")}`}>
                {triage.emergency_contact}
              </a>
            </p>
          )}
        </div>
      )}

      <div className="dashboard-row">
        <span className={tierClass}>{TIER_LABELS[triage.tier] ?? triage.tier}</span>
        <span className="confidence-pill" title="How well inputs match the tier">
          Confidence: {triage.confidence}
        </span>
      </div>

      {triage.needs_more_info && (
        <p className="dashboard-meta">
          More detail may help narrow this down safely.
        </p>
      )}

      {triage.follow_up_questions.length > 0 && (
        <div className="dashboard-block">
          <h3>Questions to consider</h3>
          <ul>
            {triage.follow_up_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {triage.red_flags_detected.length > 0 && (
        <div className="dashboard-block dashboard-block--flags">
          <h3>Red flags noted</h3>
          <ul>
            {triage.red_flags_detected.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {triage.suggested_conditions.length > 0 && (
        <div className="dashboard-block">
          <h3>Possible conditions (not a diagnosis)</h3>
          <ul className="condition-list">
            {triage.suggested_conditions.map((c) => (
              <li key={c.name}>
                <strong>{c.name}</strong>{" "}
                <span className="likelihood">({c.likelihood})</span>
                <div className="rationale">{c.rationale}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="dashboard-block">
        <h3>Recommended action</h3>
        <p>{triage.recommended_action}</p>
      </div>

      <footer className="dashboard-disclaimer">
        <p>{triage.disclaimer}</p>
      </footer>

      {clinicResults.length > 0 && hideClinicsDefault && (
        <button
          type="button"
          className="btn-ghost dashboard-expand"
          onClick={() => setShowClinicsDespiteEmergency(true)}
        >
          Show nearby clinic search results (non-emergency)
        </button>
      )}

      {(clinicSearchStatus === "disabled" || clinicSearchStatus === "error") &&
        triage.tier !== "EMERGENCY" && (
          <p className="clinic-meta">
            {clinicSearchStatus === "disabled"
              ? "Clinic search is not configured (add Google CSE or MCP HTTP URL on the server)."
              : "Clinic search failed — try again later."}
          </p>
        )}

      {clinicResults.length > 0 && !hideClinicsDefault && (
        <div className="dashboard-block dashboard-block--clinics">
          <h3>Nearby clinics (web search)</h3>
          <p className="clinic-meta">
            Third-party search results for wayfinding only — not medical
            referrals or endorsements.
          </p>
          <ul className="clinic-list">
            {clinicResults.map((c, i) => (
              <li key={`${c.title}-${i}`}>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noopener noreferrer">
                    {c.title}
                  </a>
                ) : (
                  <span>{c.title}</span>
                )}
                {c.snippet && <div className="clinic-snippet">{c.snippet}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
