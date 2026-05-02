import { useRef, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { ChatMessage } from "../types";

interface ChatInterfaceProps {
  history: ChatMessage[];
  loading: boolean;
  files: File[];
  mergeNewFiles: (files: FileList | File[]) => void;
  removeFile: (idx: number) => void;
  clearSession: () => void;
  submitTriage: (msg: string) => Promise<boolean>;
  error: string | null;
}

export function ChatInterface({
  history,
  loading,
  files,
  mergeNewFiles,
  removeFile,
  clearSession,
  submitTriage,
  error
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, loading]);

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && files.length === 0) return;

    const success = await submitTriage(trimmed);
    if (success) {
      setInput("");
    }
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
    <>
      <div className="chat-log" aria-label="Chat messages" aria-live="polite">
        {history.length === 0 && !loading && (
          <div className="empty-state">
            <span className="empty-icon">👋</span>
            <p>
              Describe what you are feeling, how long it has lasted, and how
              severe it is. You can attach a prescription photo or PDF.
            </p>
          </div>
        )}
        {history.map((m, i) => (
          <div
            key={`${i}-${m.role}-${m.content.slice(0, 24)}`}
            className={`bubble bubble-${m.role} animate-fade-in`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="bubble bubble-assistant animate-pulse" aria-busy="true">
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form className="composer" onSubmit={handleChatSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your symptoms here..."
          disabled={loading}
          aria-label="Your message"
          maxLength={12000}
        />
        
        {error && (
          <div className="error-banner animate-fade-in" role="alert">
            <span className="error-icon">⚠️</span> {error}
          </div>
        )}

        <div className="row-actions">
          <label className="btn-ghost file-upload-btn">
            <span className="icon">📎</span> Attach
            <input {...fileInputProps} className="sr-only" />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Sending..." : "Send Message"}
            {!loading && <span className="icon">↗</span>}
          </button>
          {history.length > 0 && (
            <button
              type="button"
              className="btn-ghost"
              onClick={clearSession}
              disabled={loading}
            >
              Clear chat
            </button>
          )}
        </div>
        {files.length > 0 && (
          <ul className="file-chip-list animate-fade-in">
            {files.map((f, idx) => (
              <li key={`${f.name}-${idx}`} className="file-chip">
                <span className="file-icon">📄</span>
                <span className="file-name" title={f.name}>{f.name}</span>
                <button
                  type="button"
                  className="file-remove-btn"
                  onClick={() => removeFile(idx)}
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </>
  );
}
