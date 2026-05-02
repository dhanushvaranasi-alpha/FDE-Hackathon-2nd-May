/** API types aligned with backend `app/schemas.py`. */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type TriageTier =
  | "EMERGENCY"
  | "URGENT"
  | "SOON"
  | "ROUTINE"
  | "SELF_CARE"
  | "INSUFFICIENT_INFO";

export interface SuggestedCondition {
  name: string;
  likelihood: "LOW" | "MEDIUM" | "HIGH";
  rationale: string;
}

export interface TriageResult {
  tier: TriageTier;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  locale: string;
  pincode: string | null;
  red_flags_detected: string[];
  suggested_conditions: SuggestedCondition[];
  recommended_action: string;
  emergency_contact: string | null;
  follow_up_questions: string[];
  needs_more_info: boolean;
  mental_health_flag: boolean;
  user_message: string;
  disclaimer: string;
}

export interface ClinicResult {
  title: string;
  snippet?: string | null;
  url?: string | null;
}

export interface TriageResponse {
  triage: TriageResult;
  clinic_results: ClinicResult[];
  clinic_search_status: "skipped" | "ok" | "disabled" | "error";
  error_detail?: string | null;
}

export interface TriageRequestBody {
  message?: string | null;
  messages: ChatMessage[];
  locale?: string | null;
  pincode?: string | null;
  /** Street address — sent only to clinic MCP / search backend, never duplicated into chat. */
  address?: string | null;
  conversation_id?: string | null;
}
