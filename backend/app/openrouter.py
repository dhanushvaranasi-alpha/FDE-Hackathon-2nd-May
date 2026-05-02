"""OpenRouter chat completions for triage JSON."""

import logging
from typing import Any

import httpx

from app.config import settings
from app.prompt import get_system_prompt

logger = logging.getLogger(__name__)


async def complete_triage_json(
    chat_messages: list[dict[str, Any]],
    clinic_results: list[Any] | None = None,
) -> str:
    """
    Send system prompt + chat messages to OpenRouter; return assistant message content.

    Raises:
        RuntimeError: missing API key or HTTP failure after retries.
        ValueError: empty model response.
    """
    if not settings.openrouter_api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. Add it to backend/.env for live triage."
        )

    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/fde-hackathon/symptom-triage",
        "X-Title": "Symptom Triage Assistant",
    }
    system_prompt = get_system_prompt()
    if clinic_results:
        clinic_list = "\n".join([
            f"- {c.title}: {c.snippet or ''} (URL: {c.url or 'N/A'})" 
            for c in clinic_results
        ])
        system_prompt += (
            "\n\n## NEARBY CLINIC CONTEXT\n"
            "The following clinics were found near the user's location. "
            "If appropriate, mention that you've found these clinics in your `user_message` "
            "to help the user know they can find care nearby in the dashboard results:\n"
            f"{clinic_list}"
        )

    body: dict[str, Any] = {
        "model": settings.openrouter_model,
        "messages": [{"role": "system", "content": system_prompt}, *chat_messages],
        "temperature": 0.2,
        "max_tokens": 4096,
    }

    body_json_mode = {**body, "response_format": {"type": "json_object"}}

    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        for payload in (body_json_mode, body):
            try:
                r = await client.post(url, headers=headers, json=payload)
                if r.status_code >= 400:
                    logger.warning("OpenRouter HTTP %s: %s", r.status_code, r.text[:500])
                    r.raise_for_status()
                data = r.json()
                content = (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content")
                )
                if not content or not str(content).strip():
                    raise ValueError("Empty model content")
                return str(content).strip()
            except Exception as e:
                last_err = e
                logger.warning("OpenRouter payload retry after failure: %s", e)

    raise RuntimeError(f"OpenRouter request failed: {last_err}")


async def complete_triage_json_repair(
    chat_messages: list[dict[str, Any]], 
    bad_reply: str,
    clinic_results: list[Any] | None = None
) -> str:
    """Second call asking only for valid JSON fixing the previous output."""
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set.")

    extended = [
        *chat_messages,
        {"role": "assistant", "content": bad_reply[:8000]},
        {
            "role": "user",
            "content": (
                "Your previous reply was not valid JSON or did not match the schema. "
                "Respond with ONE JSON object only, no markdown, matching the schema in your instructions."
            ),
        },
    ]

    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/fde-hackathon/symptom-triage",
        "X-Title": "Symptom Triage Assistant",
    }
    system_prompt = get_system_prompt()
    if clinic_results:
        # Re-inject context for repair as well
        clinic_list = "\n".join([f"- {c.title}" for c in clinic_results])
        system_prompt += f"\n\n## NEARBY CLINIC CONTEXT\n{clinic_list}"

    base_body: dict[str, Any] = {
        "model": settings.openrouter_model,
        "messages": [{"role": "system", "content": system_prompt}, *extended],
        "temperature": 0.1,
        "max_tokens": 4096,
    }
    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        for payload in ({**base_body, "response_format": {"type": "json_object"}}, base_body):
            try:
                r = await client.post(url, headers=headers, json=payload)
                r.raise_for_status()
                data = r.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content")
                if not content or not str(content).strip():
                    raise ValueError("Empty model content on repair")
                return str(content).strip()
            except Exception as e:
                last_err = e
                logger.warning("Repair attempt failed: %s", e)
    raise RuntimeError(f"OpenRouter repair failed: {last_err}")