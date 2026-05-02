"""Runtime configuration from environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from env and optional `.env` file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.0-flash-001"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    request_timeout_seconds: float = 90.0

    # Google Custom Search (optional) — clinic discovery when MCP bridge not used
    google_cse_api_key: str = ""
    google_cse_cx: str = ""

    # Optional HTTP bridge compatible with Google Search MCP-style POST JSON
    clinic_search_mcp_http_url: str = ""  # CLINIC_SEARCH_MCP_HTTP_URL

    # Enable mock results for demo purposes if search is unconfigured
    enable_demo_clinics: bool = True

    max_message_length: int = 12000
    max_upload_bytes: int = 5 * 1024 * 1024  # 5 MB per file
    allowed_upload_mime: frozenset[str] = frozenset(
        {
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "application/pdf",
        }
    )

    @property
    def repo_root(self) -> Path:
        return Path(__file__).resolve().parents[2]

    @property
    def system_prompt_path(self) -> Path:
        return self.repo_root / "SystemPrompt.md"


settings = Settings()
