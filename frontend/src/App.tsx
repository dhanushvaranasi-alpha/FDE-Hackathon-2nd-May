import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { TriageApiError, postTriage, validateFiles } from "./api";
import { Dashboard } from "./components/Dashboard";
import type { ChatMessage, TriageResponse } from "./types";
import "./App.css";

type Mode = "chat" | "form";

function randomConversationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const baseId = useId();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>("chat");
  const [conversationId] = useState(randomConversationId);

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [locale, setLocale] = useState("IN");
  const [pincode, setPincode] = useState("");
  const [address, setAddress] = useState("");

  const [formPrimary, setFormPrimary] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formSeverity, setFormSeverity] = useState("");
  const [formAge, setFormAge] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<TriageResponse | null>(null);

  const composedFormMessage = useMemo(() => {
    const parts = [
      `Primary symptom: ${formPrimary.trim()}`,
      `Duration / onset: ${formDuration.trim()}`,
      `Severity: ${formSeverity.trim()}`,
      `Age band: ${formAge.trim()}`,
    ];
    return parts.join("\n");
  }, [formPrimary, formDuration, formSeverity, formAge]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, loading]);

  const mergeNewFiles = (incoming: FileList | File[]) => {
    try {
      const next = [...files, ...Array.from(incoming)];
      validateFiles(next);
      setFiles(next);
      setError(null);
    } catch (err) {
      if (err instanceof TriageApiError) {
        setError(err.message);
      }
    }
  };

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && files.length === 0) {
      setError("Enter a message or attach a file (prescription / photo).");
      return;
    }
    const userVisible = trimmed || "(Attached file(s) only)";
    setLoading(true);
    setError(null);
    setInput("");
    try {
      const res = await postTriage(
        {
          message: trimmed,
          messages: history,
          locale: locale.trim() || null,
          pincode: pincode.trim() || null,
          address: address.trim() || null,
          conversation_id: conversationId,
        },
        files,
      );
      setLastResponse(res);
      setHistory((h) => [
        ...h,
        { role: "user", content: userVisible },
        { role: "assistant", content: res.triage.user_message },
      ]);
      setFiles([]);
    } catch (err) {
      if (err instanceof TriageApiError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error ? err.message : "Something went wrong. Try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (
      !formPrimary.trim() ||
      !formDuration.trim() ||
      !formSeverity.trim() ||
      !formAge.trim()
    ) {
      setError("Fill all symptom fields before submitting the form.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const msg = composedFormMessage;
      const res = await postTriage(
        {
          message: msg,
          messages: [],
          locale: locale.trim() || null,
          pincode: pincode.trim() || null,
          address: address.trim() || null,
          conversation_id: conversationId,
        },
        files,
      );
      setLastResponse(res);
      setHistory([
        { role: "user", content: msg },
        { role: "assistant", content: res.triage.user_message },
      ]);
      setFiles([]);
      setMode("chat");
    } catch (err) {
      if (err instanceof TriageApiError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error ? err.message : "Something went wrong. Try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const clearSession = () => {
    setHistory([]);
    setLastResponse(null);
    setError(null);
    setInput("");
    setFiles([]);
  };

  const removeFile = (idx: number) => {
    setFiles((f) => f.filter((_, i) => i !== idx));
  };

  const fileInputProps = {
    type: "file" as const,
    accept: "image/*,application/pdf",
    multiple: true,
    disabled: loading,
    name: "files",
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list?.length) return;
      mergeNewFiles(list);
      e.target.value = "";
    },
  };

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <div>
          <h1 className="app-title">Symptom Triage Assistant</h1>
          <p className="app-sub">
            Informational guidance only — not a diagnosis. Share symptoms
            safely; street address for clinics is kept off the AI chat path.
          </p>
        </div>
        <nav className="mode-tabs" aria-label="Input mode">
          <button
            type="button"
            data-active={mode === "chat"}
            onClick={() => setMode("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            data-active={mode === "form"}
            onClick={() => setMode("form")}
          >
            Form
          </button>
        </nav>
      </header>

      <div id="main-content" className="layout-grid">
        <div className="panel">
          <h2>{mode === "chat" ? "Conversation" : "Structured intake"}</h2>

          <div className="field-grid" style={{ marginBottom: "1rem" }}>
            <label htmlFor={`${baseId}-locale`}>
              Country / locale (ISO, e.g. IN)
              <input
                id={`${baseId}-locale`}
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                autoComplete="country"
                maxLength={8}
                placeholder="IN"
              />
            </label>
            <label htmlFor={`${baseId}-pincode`}>
              Postal / ZIP code (optional — goes to triage context)
              <input
                id={`${baseId}-pincode`}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                autoComplete="postal-code"
                maxLength={16}
              />
            </label>
            <label htmlFor={`${baseId}-address`}>
              Street address for nearby clinics (optional)
              <input
                id={`${baseId}-address`}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
                maxLength={512}
                placeholder="Not sent to the AI — search only"
              />
              <p className="hint">
                Use the field above only — do not paste this address into chat if
                you want it excluded from the model.
              </p>
            </label>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}

          {mode === "chat" ? (
            <>
              <div
                className="chat-log"
                aria-label="Chat messages"
                aria-live="polite"
              >
                {history.length === 0 && !loading && (
                  <p className="hint">
                    Describe what you are feeling, how long it has lasted, and
                    how severe it is. You can attach a prescription photo or PDF.
                  </p>
                )}
                {history.map((m, i) => (
                  <div
                    key={`${i}-${m.role}-${m.content.slice(0, 24)}`}
                    className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-assistant"}`}
                  >
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div className="bubble bubble-assistant" aria-busy="true">
                    Analyzing…
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form className="composer" onSubmit={handleChatSubmit}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your symptoms…"
                  disabled={loading}
                  aria-label="Your message"
                  maxLength={12000}
                />
                <div className="row-actions">
                  <label className="btn-ghost" style={{ cursor: "pointer" }}>
                    Attach
                    <input {...fileInputProps} className="sr-only" />
                  </label>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Sending…" : "Send"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={clearSession}
                    disabled={loading}
                  >
                    Clear chat
                  </button>
                </div>
                {files.length > 0 && (
                  <ul className="hint file-chip-list">
                    {files.map((f, idx) => (
                      <li key={`${f.name}-${idx}`}>
                        <span className="file-name">{f.name}</span>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => removeFile(idx)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </form>
            </>
          ) : (
            <form className="field-grid" onSubmit={handleFormSubmit}>
              <label htmlFor={`${baseId}-sym`}>
                Primary symptom
                <textarea
                  id={`${baseId}-sym`}
                  value={formPrimary}
                  onChange={(e) => setFormPrimary(e.target.value)}
                  required
                  disabled={loading}
                />
              </label>
              <label htmlFor={`${baseId}-dur`}>
                Duration / onset
                <input
                  id={`${baseId}-dur`}
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  required
                  disabled={loading}
                />
              </label>
              <label htmlFor={`${baseId}-sev`}>
                Severity (e.g. mild / 6 out of 10)
                <input
                  id={`${baseId}-sev`}
                  value={formSeverity}
                  onChange={(e) => setFormSeverity(e.target.value)}
                  required
                  disabled={loading}
                />
              </label>
              <label htmlFor={`${baseId}-age`}>
                Age band (infant / child / adult / elderly)
                <input
                  id={`${baseId}-age`}
                  value={formAge}
                  onChange={(e) => setFormAge(e.target.value)}
                  required
                  disabled={loading}
                />
              </label>
              <div className="row-actions">
                <label className="btn-ghost" style={{ cursor: "pointer" }}>
                  Attach files
                  <input {...fileInputProps} className="sr-only" />
                </label>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? "Submitting…" : "Submit intake"}
                </button>
              </div>
              {files.length > 0 && (
                <ul className="hint file-chip-list">
                  {files.map((f, idx) => (
                    <li key={`${f.name}-${idx}`}>
                      <span className="file-name">{f.name}</span>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => removeFile(idx)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </form>
          )}
        </div>

        <Dashboard
          triage={lastResponse?.triage ?? null}
          clinicResults={lastResponse?.clinic_results ?? []}
          clinicSearchStatus={lastResponse?.clinic_search_status ?? "skipped"}
        />

        {lastResponse?.error_detail && (
          <p className="hint service-note">
            Service note: {lastResponse.error_detail}
          </p>
        )}
      </div>
    </div>
  );
}
