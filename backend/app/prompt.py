"""Load canonical system prompt from repo SystemPrompt.md."""

from pathlib import Path

from app.config import settings


def load_system_prompt() -> str:
    """
    Read SystemPrompt.md from the repository root.

    Raises:
        FileNotFoundError: If the file is missing (misconfigured deploy).
    """
    path: Path = settings.system_prompt_path
    if not path.is_file():
        raise FileNotFoundError(f"SystemPrompt.md not found at {path}")
    return path.read_text(encoding="utf-8")


_SYSTEM_PROMPT_CACHE: str | None = None


def get_system_prompt() -> str:
    """Return cached system prompt text."""
    global _SYSTEM_PROMPT_CACHE
    if _SYSTEM_PROMPT_CACHE is None:
        _SYSTEM_PROMPT_CACHE = load_system_prompt()
    return _SYSTEM_PROMPT_CACHE
