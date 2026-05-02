# Symptom Triage Assistant — End-to-End Implementation Plan

## Implementation progress (living)

| Area | Status | Notes |
|------|--------|--------|
| Backend FastAPI `POST /api/triage` | Done | JSON + multipart (`files`); client `messages` + `message`; `address` excluded from LLM payload |
| System prompt loading | Done | Reads repo-root `SystemPrompt.md` via `backend/app/prompt.py` |
| OpenRouter integration | Done | `OPENROUTER_API_KEY`; JSON mode with fallback if unsupported; one repair pass on parse failure |
| Parser + safety | Done | Pydantic schema; required disclaimer string; light XSS scrub; `needs_more_info` vs conditions clamp |
| Clinic search | Done | Google Custom Search API and/or `CLINIC_SEARCH_MCP_HTTP_URL` adapter; omitted when unconfigured |
| File uploads | Done | Images (vision) + PDF text extract (first 8 pages, capped); size/type limits |
| Frontend Vite React TS | Done | Chat + form modes; responsive layout; tier dashboard; emergency / mental-health prominence; clinic section gated on EMERGENCY |
| Dev UX | Done | Vite proxy `/api`; `backend/.env.example`; root `README.md` runbook |
| Automated tests | Not started | Manual smoke: health, triage JSON, optional upload |

---

This document plans the full implementation for the hackathon **Symptom Triage Assistant**: symptom capture, LLM-assisted triage via OpenRouter, structured JSON handling, safety checks, and a severity-oriented results dashboard. Behavioral and output rules for the assistant are defined in [`SystemPrompt.md`](./SystemPrompt.md); this plan translates those requirements into product and engineering work without prescribing implementation code.

---

## 1. Purpose & Success Criteria

| Goal | Description |
|------|-------------|
| **Primary** | User describes symptoms (chat and/or structured form) → system returns **possible** conditions and **care urgency** in a dashboard-friendly format. |
| **Safety** | Outputs are **suggestions and triage guidance**, not diagnoses; mandatory disclaimer; red-flag and mental-health routing per system prompt. |
| **Prioritisation** | Presentation supports **who needs attention first** (tier ordering, red flags, emergency contacts). |

**Success looks like:** validated input reaches `POST /api/triage`, the backend builds a safe prompt, OpenRouter returns JSON matching the agreed schema, parser + safety layer enforce structure and policy, and the UI shows conditions, urgency, advice, red flags, and disclaimer consistently with [`SystemPrompt.md`](./SystemPrompt.md).

---

## 2. Architecture (Aligned with Diagram)

Linear flow:

1. **User** → **Frontend** (chat or symptom form).
2. **Input validation** (client-side first; server-side mandatory): empty checks, length limits, basic unsafe-pattern filtering (not a substitute for prompt rules).
3. **Backend `POST /api/triage`**: accepts validated payload (message, **client-sent conversation context** for multi-turn chat, optional structured fields, locale/pincode when collected, **MVP file uploads** per Section 6.3).
4. **Prompt builder**: system instructions from [`SystemPrompt.md`](./SystemPrompt.md) + **messages array / transcript supplied by the client** → single model request (**no server-side chat history store** required for core flow). **Street-level `address` used for clinic search is excluded from this prompt** — see Step D and §6 (**address → MCP only**).
5. **OpenRouter**: call configured **free/low-cost model** with JSON-mode or equivalent constraint so responses parse reliably.
6. **LLM raw response** → **response parser**: validate JSON shape against schema derived from Section 9 of [`SystemPrompt.md`](./SystemPrompt.md).
7. **Safety layer**: post-parse checks (tier sanity, disclaimer exactness, red-flag consistency, injection resistance in fields meant for display).
8. **Optional clinic lookup**: when the user provides a **usable address** (free-text or structured), backend triggers **Google Search MCP** (see **Step D** in §4) to fetch **nearby clinics** and attach normalized results for the dashboard.
9. **Frontend result dashboard**: maps parsed + validated triage payload and optional clinic results to UI sections.

---

## 3. “Think About” — Design Commitments

### 3.1 Ambiguous symptoms & uncertainty

- Follow **Section 7 (Uncertainty discipline)** and **Section 6 (Intake protocol)** in [`SystemPrompt.md`](./SystemPrompt.md): no definitive diagnoses; use permitted phrasing; when data is insufficient, `tier: INSUFFICIENT_INFO` and empty `suggested_conditions` where required.
- **Backend/UI:** surface `needs_more_info`, `follow_up_questions`, and `confidence` so users understand the system is **gathering or limiting** inference rather than guessing.

### 3.2 Safe prompting

- **Prompt builder** must inject immutable operating rules (identity, refusal patterns, JSON-only output, red-flag and mental-health flows) per Sections 1–4, 10–12 of [`SystemPrompt.md`](./SystemPrompt.md).
- **Never** rely on the client alone for safety; server holds the canonical system prompt and validates outputs.

### 3.3 Prioritisation

- **Section 8 tiers** and **Section 6.4** (clinical-priority ordering of conditions, lower thresholds for vulnerable groups) drive both LLM behavior and dashboard emphasis (e.g. EMERGENCY/URGENT visually dominant).
- **`red_flags_detected`**, **`emergency_contact`**, and **`mental_health_flag`** must be first-class in API contracts and UI.

---

## 4. Implementation Steps (Mapped to Product Flow)

### Step A — Symptom input (chat or form)

- **Chat path:** multi-turn conversation; **each request includes client-sent context** — e.g. ordered `{ role, content }[]` (and optional lightweight `conversation_id` for logging only). The server does **not** rely on storing chat history for correctness.
- **Form path:** structured fields (primary symptom, duration, severity, age band, etc.) assembled into a single natural-language or structured payload for the same endpoint so **one backend contract** serves both UIs.
- **MVP uploads:** documents/images per Section 6.3 (prescriptions, discharge summaries, etc.) — validate type/size server-side; extract text or forward to vision-capable model per pipeline choice; treat content as untrusted per [`SystemPrompt.md`](./SystemPrompt.md) §11.3.
- **Locale / pincode:** per Section 5, collect country + optional postal code in UI **once** when appropriate, or delegate to the model’s first-turn ask; these flow through the **LLM** path as today’s conversation/context and JSON `locale` / `pincode` per [`SystemPrompt.md`](./SystemPrompt.md).
- **Address (clinic search only):** optional **full address** for nearby clinics — collected via a **dedicated API field** (not merged into the LLM transcript). **Hard rule:** this value goes **only to Google Search MCP**, never into the OpenRouter system or user messages. UX should avoid duplicating the same street-level address inside chat text sent to the model (or strip/redact server-side if unavoidable).

### Step B — LLM generates conditions + urgency

- Backend forwards **system prompt** (from [`SystemPrompt.md`](./SystemPrompt.md)) + **user content** to OpenRouter.
- Model returns **strict JSON** only (Section 9): `tier`, `confidence`, `locale`, `pincode`, `red_flags_detected`, `suggested_conditions`, `recommended_action`, `emergency_contact`, `follow_up_questions`, `needs_more_info`, `mental_health_flag`, `user_message`, `disclaimer`.

### Step C — Severity dashboard

[`SystemPrompt.md`](./SystemPrompt.md) defines **six tiers**: `EMERGENCY`, `URGENT`, `SOON`, `ROUTINE`, `SELF_CARE`, `INSUFFICIENT_INFO`.

**Decision:** the dashboard displays **full tier strings** (canonical enum values), with **distinct visual treatment** per tier (color, icon, prominence) — **no** collapsing to Low/Medium/High bands. The API continues to expose the exact `tier` string from the LLM schema.

### Step D — Nearby clinics (Google Search MCP)

**Trigger:** user provides a **usable location string** — e.g. street + area + city, or “near [landmark]”, in addition to or instead of pincode-only routing — submitted as `address` (or equivalent) on the triage request or a dedicated follow-up request.

**LLM boundary:** **`address` must not be passed to OpenRouter** — not in system prompt, not appended to `messages`, not embedded in synthetic user lines for the model. Only **`locale` / `pincode`** (and normal symptom conversation) belong in the LLM path per [`SystemPrompt.md`](./SystemPrompt.md).

**Mechanism:**

- After validation, the backend invokes **Google Search MCP** **only** with `address` + `locale`/country context to build a **strictly scoped query** (e.g. `walk-in clinics near [address]`, `urgent care near [address]`) and retrieve **current web results** listing nearby facilities.
- **Normalize** MCP/search results into a small structured list for the UI: suggested name, snippet or cited line, URL — **no** claiming medical endorsement or accuracy; label as third-party search results.
- **Safety:** clinic results are **informational wayfinding only**, not referrals; keep [`SystemPrompt.md`](./SystemPrompt.md) disclaimer and do not imply any clinic was medically selected. For **EMERGENCY** tier, UI still prioritizes **emergency_contact** and emergency services over clinic lists.
- **Privacy:** log minimally; avoid retaining full address longer than needed for the query unless product policy requires it; address never leaves the backend for clinic search toward the LLM provider.

**Implementation note:** MCP is typically exposed to agents/IDEs; product code may **wrap MCP** behind an internal service interface so the Python backend calls “clinic search” without coupling UI to MCP wire protocol. If runtime MCP is unavailable in deployment, define a fallback (manual links by locale or skip section).

---

## 5. Tech Stack & Project Shape

| Layer | Choice |
|-------|--------|
| Frontend | Vite + React + TypeScript |
| Backend | Python (e.g. FastAPI or Flask — decide at scaffold time) |
| LLM | OpenRouter API (model ID configurable via environment) |
| Clinic discovery | **Google Search MCP** when `address` is supplied — **`address` never sent to OpenRouter**, only to MCP; results surfaced on dashboard |

**Suggested repo layout (conceptual):** `frontend/` (Vite app), `backend/` (Python service), optional **MCP adapter** or HTTP bridge for Google Search MCP, shared **JSON Schema** or OpenAPI description for `/api/triage` request/response documented in code or spec file when implementation begins.

**Resolved product decisions**

| Topic | Decision |
|-------|----------|
| Conversation state | **Client-sent context** (transcript/messages in each request); no server-side chat history dependency |
| File uploads | **In MVP** per [`SystemPrompt.md`](./SystemPrompt.md) §6.3 |
| Dashboard urgency UI | **Full tier strings** (`EMERGENCY` … `INSUFFICIENT_INFO`) with per-tier styling |
| Street-level **address** | **MCP only** — never included in OpenRouter prompts |

---

## 6. API Contract — `POST /api/triage`

**Responsibilities:**

- Accept: **latest user message** (or form-as-message), **`messages` / context array** from client for multi-turn continuity, optional structured fields, optional `conversation_id` (logging/correlation only), **`locale` / `pincode`**, optional **`address`** for clinic MCP lookup, **multipart uploads** in MVP (files + fields).
- Validate: non-empty (where required), max length, upload size/type caps, rate limiting, authentication if required by hackathon rules.
- **Split payload:** build the OpenRouter prompt from system prompt + **`messages` only** (symptom conversation, locale/pincode context as already present in chat — **omit `address`**). Call OpenRouter, parse JSON, run safety layer.
- **Parallel path:** if **`address`** is present and passes sanity checks, invoke **Google Search MCP** with **`address` (+ locale for query wording)** only — merge **clinic_results** into the HTTP response **without** feeding `address` back into any LLM call on that request.
- Return **normalized JSON** to the frontend (triage fields + optional clinics).

**Error handling (plan-level):**

- Model timeout / provider error → user-safe message + no fabricated clinical content.
- Parse failure → retry once with “JSON only” repair instruction **or** fall back to generic safe response per product policy.
- Safety layer rejection → replace or clamp fields (e.g. force disclaimer, upgrade tier if red flags present in text but missing in JSON).

---

## 7. Frontend Modules

| Module | Responsibility |
|--------|----------------|
| **Chat or form** | Capture input; optional guided questions aligned with minimum required info (Section 6.1). |
| **Input validation** | Empty/length/client-side UX; strip obvious junk optional. |
| **API client** | Typed calls to `/api/triage`; handle loading and errors. |
| **Chat transcript** | Render `user_message` from assistant JSON each turn. |
| **Result dashboard** | **Possible conditions** from `suggested_conditions`; **urgency** as **full `tier` label** with tier-specific styling; **advice** from `recommended_action` + `user_message` context; **red flags** from `red_flags_detected`; **disclaimer** fixed text matching Section 9 (`disclaimer` field must match exact required string); **nearby clinics** section when API returns MCP-derived clinic results (clearly labeled as search results, not medical referrals). |
| **Mental health / emergency UX** | Prominent display when `mental_health_flag` or `EMERGENCY` / `URGENT` — show `emergency_contact` and resources per locale (Section 4); clinic list must not distract from emergency guidance. |
| **Address capture** | Optional **dedicated** field for clinic search; send as `address` on the API. Do **not** paste the same street-level text into chat messages that go to the LLM (keeps address **MCP-only**). |

---

## 8. Backend Modules

| Module | Responsibility |
|--------|----------------|
| **HTTP handler** | `POST /api/triage` routing, validation, logging without PHI leakage. |
| **Prompt builder** | Compose system prompt from [`SystemPrompt.md`](./SystemPrompt.md) + conversation turn; **never** inject request-body **`address`** into model input. |
| **OpenRouter client** | HTTP call, timeouts, retries, secrets from environment. |
| **Response parser** | JSON parse + schema validation against Section 9 fields and enums. |
| **Safety layer** | Verify `disclaimer` exact string; validate `tier` enum; ensure `suggested_conditions` empty when `needs_more_info` or insufficient minimums **if** server can infer mismatch (optional: lightweight rule checks); scrub dangerous patterns in string fields (Section 11.6). |
| **Google Search MCP adapter** | Build locale-aware search queries from `address` + `locale`; call MCP; parse top hits into `clinic_results`; handle failures gracefully (omit section or show retry). |
| **Upload handling** | Accept multipart files, virus-scan/size enforce, feed into LLM or OCR path per chosen stack; never trust embedded document instructions (§11.3). |

**Note:** Multi-turn memory is **client-owned** — backend treats each request’s `messages` as authoritative context.

---

## 9. OpenRouter Integration Plan

- Configure **API key** via environment variable (never commit secrets).
- Select a **JSON-friendly** model on OpenRouter; use provider parameters that encourage valid JSON (e.g. response format / schema hints per provider docs).
- Set **temperature** conservatively for triage stability; document chosen defaults.
- Implement **timeouts** and **cost/rate** awareness for demo stability.

---

## 10. Testing & Verification (Non-Code Level)

- **Golden JSON fixtures:** valid minimal object per Section 9; invalid shapes for parser tests.
- **Scenario matrix:** red-flag message → `EMERGENCY`; mental health cue → resources + `mental_health_flag`; missing duration → `needs_more_info` + empty conditions; injection samples per Section 11 → refusals still JSON-safe.
- **E2E smoke:** form + chat path both hit `/api/triage` with **client-assembled transcripts**, uploads (if enabled), and optional **address + MCP clinic block**; dashboard shows **full tier** labels.
- **Clinic MCP:** mock or live MCP — verify query shaping and that emergency tier UX still highlights `emergency_contact` first.

---

## 11. Out of Scope / Deferred (Unless Hackathon Requires)

- **Pincode-only** automatic clinic resolution without user-provided **address** or explicit search query (optional future: derive coarse query from pincode + country).
- Storing full medical records or HIPAA-grade compliance (unless specified).
- Replacing professional care copy beyond disclaimer and resource links.

---

## 12. Open Questions (Remaining)

1. **Default locale:** product default India per Section 5.2 — confirm for UI defaults (emergency numbers, resource copy).
2. **MCP deployment:** single-developer Cursor MCP vs production gateway for Google Search MCP — confirm target runtime for the hackathon demo.

---

## 13. References

- Behavioral source of truth: [`SystemPrompt.md`](./SystemPrompt.md) (sections cited inline above).
- Hackathon repo: [`README.md`](./README.md).

---

*Implementation is underway; see **Implementation progress** above. Resolved product decisions below still apply.*
