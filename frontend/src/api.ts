import type { TriageRequestBody, TriageResponse } from "./types";

const MAX_MESSAGE_CHARS = 12000;

function formatFastApiDetail(detail: unknown, status: number): string {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (item && typeof item === "object" && "msg" in item) {
        return String((item as { msg: string }).msg);
      }
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    });
    return parts.join(" — ") || `Request failed (${status})`;
  }
  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return `Request failed (${status})`;
    }
  }
  return `Request failed (${status})`;
}
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class TriageApiError extends Error {
  status?: number;
  detail?: unknown;

  constructor(message: string, status?: number, detail?: unknown) {
    super(message);
    this.name = "TriageApiError";
    this.status = status;
    this.detail = detail;
  }
}

function validateOutgoingMessage(text: string): void {
  if (text.length > MAX_MESSAGE_CHARS) {
    throw new TriageApiError(`Message must be under ${MAX_MESSAGE_CHARS} characters.`);
  }
}

export function validateFiles(files: File[]): void {
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      throw new TriageApiError(`File "${f.name}" exceeds 5 MB limit.`);
    }
    const ok =
      f.type.startsWith("image/") ||
      f.type === "application/pdf";
    if (!ok && f.type !== "") {
      throw new TriageApiError(`Unsupported file type: ${f.type || "unknown"}`);
    }
  }
}

/**
 * POST /api/triage — JSON when no files; multipart when files attached.
 */
export async function postTriage(
  body: TriageRequestBody,
  files: File[] = [],
): Promise<TriageResponse> {
  const msg = body.message ?? "";
  validateOutgoingMessage(msg);

  let res: Response;

  if (files.length > 0) {
    validateFiles(files);
    const fd = new FormData();
    fd.append("message", msg);
    fd.append("messages", JSON.stringify(body.messages ?? []));
    if (body.locale) fd.append("locale", body.locale);
    if (body.pincode) fd.append("pincode", body.pincode);
    if (body.address) fd.append("address", body.address);
    if (body.conversation_id) fd.append("conversation_id", body.conversation_id);
    for (const f of files) {
      fd.append("files", f);
    }
    res = await fetch("/api/triage", {
      method: "POST",
      body: fd,
    });
  } else {
    res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg || null,
        messages: body.messages ?? [],
        locale: body.locale ?? null,
        pincode: body.pincode ?? null,
        address: body.address ?? null,
        conversation_id: body.conversation_id ?? null,
      }),
    });
  }

  const rawText = await res.text();
  let data: unknown = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail =
      data &&
      typeof data === "object" &&
      "detail" in data &&
      (data as { detail: unknown }).detail;
    const msg = formatFastApiDetail(detail, res.status);
    throw new TriageApiError(msg, res.status, detail);
  }

  if (!data || typeof data !== "object" || !("triage" in data)) {
    throw new TriageApiError("Invalid response from server.");
  }

  return data as TriageResponse;
}
