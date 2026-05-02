"""Pydantic models for triage API requests and responses."""

from typing import Literal

from pydantic import BaseModel, Field


ChatRole = Literal["user", "assistant"]


class ChatMessage(BaseModel):
    """Single turn in client-owned conversation history."""

    role: ChatRole
    content: str = Field(default="", max_length=120_000)


class SuggestedCondition(BaseModel):
    name: str
    likelihood: Literal["LOW", "MEDIUM", "HIGH"]
    rationale: str


class ReportInsight(BaseModel):
    """Structured insight from an uploaded medical report."""

    category: str  # e.g., "Findings", "Lab Results", "Medical Jargon"
    detail: str  # The original text or finding
    simplified_explanation: str  # Layman-friendly explanation


class ClinicResult(BaseModel):
    """Normalized web search hit for nearby clinics (informational only)."""

    title: str
    snippet: str | None = None
    url: str | None = None


class TriageResult(BaseModel):
    """LLM triage payload matching SystemPrompt.md Section 9."""

    tier: Literal[
        "EMERGENCY",
        "URGENT",
        "SOON",
        "ROUTINE",
        "SELF_CARE",
        "INSUFFICIENT_INFO",
    ]
    confidence: Literal["LOW", "MEDIUM", "HIGH"]
    locale: str
    pincode: str | None = None
    red_flags_detected: list[str] = Field(default_factory=list)
    suggested_conditions: list[SuggestedCondition] = Field(default_factory=list)
    recommended_action: str
    emergency_contact: str | None = None
    follow_up_questions: list[str] = Field(default_factory=list)
    needs_more_info: bool
    mental_health_flag: bool = False
    report_analysis: list[ReportInsight] = Field(default_factory=list)
    user_message: str
    disclaimer: str


class TriageJsonRequest(BaseModel):
    """JSON body for POST /api/triage (no file uploads)."""

    message: str | None = Field(default=None, max_length=12000)
    messages: list[ChatMessage] = Field(default_factory=list)
    locale: str | None = Field(default=None, max_length=16)
    pincode: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=512)
    conversation_id: str | None = Field(default=None, max_length=128)


class TriageResponse(BaseModel):
    """API response: validated triage plus optional clinic search results."""

    triage: TriageResult
    clinic_results: list[ClinicResult] = Field(default_factory=list)
    clinic_search_status: Literal["skipped", "ok", "disabled", "error"] = "skipped"
    error_detail: str | None = None
