import { useState, type ChangeEvent, type FormEvent } from "react";

interface IntakeFormProps {
  loading: boolean;
  files: File[];
  mergeNewFiles: (files: FileList | File[]) => void;
  removeFile: (idx: number) => void;
  submitTriage: (msg: string, isForm: boolean) => Promise<boolean>;
  error: string | null;
}

export function IntakeForm({
  loading,
  files,
  mergeNewFiles,
  removeFile,
  submitTriage,
  error,
}: IntakeFormProps) {
  const [formPrimary, setFormPrimary] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formSeverity, setFormSeverity] = useState("");
  const [formAge, setFormAge] = useState("");

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (
      !formPrimary.trim() ||
      !formDuration.trim() ||
      !formSeverity.trim() ||
      !formAge.trim()
    ) {
      return;
    }

    const msg = [
      `Primary symptom: ${formPrimary.trim()}`,
      `Duration / onset: ${formDuration.trim()}`,
      `Severity: ${formSeverity.trim()}`,
      `Age band: ${formAge.trim()}`,
    ].join("\n");

    await submitTriage(msg, true);
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
    <form className="intake-form animate-fade-in" onSubmit={handleFormSubmit}>
      <div className="input-group full-width">
        <label htmlFor="form-primary">Primary symptom</label>
        <textarea
          id="form-primary"
          value={formPrimary}
          onChange={(e) => setFormPrimary(e.target.value)}
          required
          disabled={loading}
          placeholder="Describe what's bothering you most..."
        />
      </div>

      <div className="form-row">
        <div className="input-group">
          <label htmlFor="form-duration">Duration / onset</label>
          <input
            id="form-duration"
            value={formDuration}
            onChange={(e) => setFormDuration(e.target.value)}
            required
            disabled={loading}
            placeholder="e.g. 2 days ago"
          />
        </div>
        <div className="input-group">
          <label htmlFor="form-severity">Severity</label>
          <input
            id="form-severity"
            value={formSeverity}
            onChange={(e) => setFormSeverity(e.target.value)}
            required
            disabled={loading}
            placeholder="e.g. mild / 6 out of 10"
          />
        </div>
      </div>

      <div className="input-group">
        <label htmlFor="form-age">Age band</label>
        <input
          id="form-age"
          value={formAge}
          onChange={(e) => setFormAge(e.target.value)}
          required
          disabled={loading}
          placeholder="infant / child / adult / elderly"
        />
      </div>

      {error && (
        <div className="error-banner animate-fade-in" role="alert">
          <span className="error-icon">⚠️</span> {error}
        </div>
      )}

      <div className="row-actions">
        <label className="btn-ghost file-upload-btn">
          <span className="icon">📎</span> Attach files
          <input {...fileInputProps} className="sr-only" />
        </label>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Submitting..." : "Submit Intake"}
          {!loading && <span className="icon">✓</span>}
        </button>
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
  );
}
