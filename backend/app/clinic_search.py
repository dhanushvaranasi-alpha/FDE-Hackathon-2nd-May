"""Nearby clinic discovery via optional MCP HTTP bridge or Google Custom Search."""

import logging
from typing import Any

import httpx

from app.config import settings
from app.schemas import ClinicResult

logger = logging.getLogger(__name__)


async def search_nearby_clinics(address: str, locale: str | None) -> tuple[list[ClinicResult], str]:
    """
    Fetch clinic-related web results for dashboard display.

    Returns:
        (results, status) where status is ok | disabled | error
    """
    addr = address.strip()
    if len(addr) < 4:
        return [], "skipped"

    # 1. Try MCP Bridge if configured
    if settings.clinic_search_mcp_http_url:
        results, status = await _search_via_mcp_http(addr, locale)
        if status == "ok" and results:
            return results, "ok"

    # 2. Try Google Custom Search (CSE) if configured
    if settings.google_cse_api_key and settings.google_cse_cx:
        results, status = await _search_google_cse(addr, locale)
        if status == "ok" and results:
            return results, "ok"

    # 3. Fallback to Demo results if enabled (useful for hackathon showcases)
    if settings.enable_demo_clinics:
        logger.info("Clinic search: falling back to demo clinics for address '%s'", addr)
        return _get_mock_clinics(addr), "ok"

    logger.info("Clinic search: no MCP URL or Google CSE configured; skipping.")
    return [], "disabled"


async def _search_via_mcp_http(address: str, locale: str | None) -> tuple[list[ClinicResult], str]:
    """POST to an MCP-compatible HTTP adapter if deployed."""
    query = _build_query(address, locale)
    payload: dict[str, Any] = {"query": query, "address": address, "locale": locale}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(settings.clinic_search_mcp_http_url, json=payload)
            r.raise_for_status()
            body = r.json()
    except Exception as e:
        logger.warning("MCP HTTP clinic search failed: %s", e)
        return [], "error"

    items = body.get("results") or body.get("items") or []
    return _normalize_hits(items), "ok"


async def _search_google_cse(address: str, locale: str | None) -> tuple[list[ClinicResult], str]:
    """Use Google Custom Search JSON API (programmatic Google Search)."""
    query = _build_query(address, locale)
    params = {
        "key": settings.google_cse_api_key,
        "cx": settings.google_cse_cx,
        "q": query,
        "num": 8,
    }
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            r = await client.get("https://www.googleapis.com/customsearch/v1", params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning("Google CSE clinic search failed: %s", e)
        return [], "error"

    items = data.get("items") or []
    hits: list[ClinicResult] = []
    for it in items[:8]:
        hits.append(
            ClinicResult(
                title=str(it.get("title") or "Result"),
                snippet=it.get("snippet"),
                url=it.get("link"),
            )
        )
    return hits, "ok"


def _build_query(address: str, locale: str | None) -> str:
    """Construct a high-intent search query for nearby medical facilities."""
    loc = (locale or "").strip().upper()
    # Scoped search terms for clinics
    terms = "walk-in clinic OR urgent care OR general practitioner OR medical centre"
    
    # Improve localization if locale is provided
    location_context = f'"{address}"'
    if loc:
        location_context += f", {loc}"
        
    return f"{terms} near {location_context}"


def _normalize_hits(items: list[Any]) -> list[ClinicResult]:
    """Clean up and normalize varying JSON formats from different search providers."""
    out: list[ClinicResult] = []
    for it in items[:8]:
        if isinstance(it, dict):
            # Try to find title/snippet/url in common fields
            title = str(it.get("title") or it.get("name") or it.get("label") or "Medical Facility")
            snippet = str(
                it.get("snippet")
                or it.get("description")
                or it.get("formatted_address")
                or it.get("address")
                or ""
            )
            url = str(it.get("url") or it.get("link") or it.get("website") or "")

            # If no website is provided, generate a Google Maps search link for the user's convenience
            if not url and title:
                # Basic escaping for the query
                query = f"{title} {snippet}".strip().replace(" ", "+")
                url = f"https://www.google.com/maps/search/?api=1&query={query}"

            if title:
                out.append(ClinicResult(title=title, snippet=snippet or None, url=url or None))
    return out


def _get_mock_clinics(address: str) -> list[ClinicResult]:
    """Provide realistic mock clinics for hackathon demonstrations."""
    # We use the address to make it look responsive
    area = address.split(",")[-1].strip() if "," in address else "Your Area"

    def _map_url(name: str) -> str:
        query = f"{name} {address}".strip().replace(" ", "+")
        return f"https://www.google.com/maps/search/?api=1&query={query}"

    return [
        ClinicResult(
            title=f"Central Medical Centre - {area}",
            snippet=f"Located near {address}. Walk-ins welcome. Hours: 8am - 8pm.",
            url=_map_url(f"Central Medical Centre {area}"),
        ),
        ClinicResult(
            title="Urgent Care Pro",
            snippet="Fast-track medical services for non-life-threatening conditions. No appointment needed.",
            url=_map_url("Urgent Care Pro"),
        ),
        ClinicResult(
            title="St. Jude Family Practice",
            snippet="General practitioners serving the local community. Same-day appointments often available.",
            url=_map_url("St. Jude Family Practice"),
        ),
        ClinicResult(
            title="HealthFirst QuickClinic",
            snippet="Convenient location with minimal wait times. Most insurance plans accepted.",
            url=_map_url("HealthFirst QuickClinic"),
        ),
    ]
