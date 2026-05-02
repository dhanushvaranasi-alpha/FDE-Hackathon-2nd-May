"""Parse LLM output JSON and apply safety normalization."""

import json
import re
from typing import Any

from pydantic import ValidationError

from app.schemas import TriageResult

REQUIRED_DISCLAIMER = (
    "This is informational triage guidance, not a medical diagnosis. "
    "Please consult a qualified clinician for any health concerns."
)

_JSON_FENCE = re.compile(r"^\s*```(?:json)?\s*", re.IGNORECASE)
_JSON_FENCE_END = re.compile(r"\s*```\s*$")


def strip_markdown_fences(raw: str) -> str:
    """Remove optional ```json fences if the model wraps JSON."""
    s = raw.strip()
    s = _JSON_FENCE.sub("", s)
    s = _JSON_FENCE_END.sub("", s)
    return s.strip()


def parse_triage_json(raw: str) -> TriageResult:
    """Parse model output into TriageResult; raises ValueError on failure."""
    cleaned = strip_markdown_fences(raw)
    try:
        data: Any = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}") from e
    return normalize_triage(data)


def normalize_triage(data: Any) -> TriageResult:
    """
    Validate with Pydantic and enforce disclaimer / basic hygiene.

    Coerces wrong disclaimer text to the required string.
    """
    if not isinstance(data, dict):
        raise ValueError("Triage payload must be a JSON object")

    if data.get("disclaimer") != REQUIRED_DISCLAIMER:
        data["disclaimer"] = REQUIRED_DISCLAIMER

    try:
        result = TriageResult.model_validate(data)
    except ValidationError as e:
        raise ValueError(str(e)) from e

    # Strip obviously risky patterns from display strings (lightweight)
    result = scrub_strings(result)
    return result


def scrub_strings(result: TriageResult) -> TriageResult:
    """Remove script-like fragments from user-facing fields."""
    dangerous = re.compile(r"<\s*script|javascript:|on\w+\s*=", re.IGNORECASE)

    def clean(s: str) -> str:
        if dangerous.search(s):
            return "[removed unsafe content]"
        return s

    result.user_message = clean(result.user_message)
    result.recommended_action = clean(result.recommended_action)
    return result


def validate_needs_more_info_consistency(result: TriageResult) -> TriageResult:
    """If needs_more_info and conditions populated, clear conditions (safe default)."""
    if result.needs_more_info and result.suggested_conditions:
        result = result.model_copy(
            update={"suggested_conditions": []},
            deep=True,
        )
    return result
