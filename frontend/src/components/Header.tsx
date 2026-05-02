import type { Mode } from "../hooks/useTriage";

interface HeaderProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export function Header({ mode, setMode }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-content">
        <h1 className="app-title">
          <span className="gradient-text">Symptom Triage</span> Assistant
        </h1>
        <p className="app-sub">
          Informational guidance only — not a diagnosis. Share symptoms safely;
          street address for clinics is kept off the AI chat path.
        </p>
      </div>
      <nav className="mode-tabs" aria-label="Input mode">
        <button
          type="button"
          data-active={mode === "chat"}
          onClick={() => setMode("chat")}
          className="tab-btn"
        >
          <span className="tab-icon">💬</span> Chat
        </button>
        <button
          type="button"
          data-active={mode === "form"}
          onClick={() => setMode("form")}
          className="tab-btn"
        >
          <span className="tab-icon">📝</span> Form
        </button>
      </nav>
    </header>
  );
}
