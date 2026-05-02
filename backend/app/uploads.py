"""Decode multipart uploads: images for vision, PDF text extraction."""

import base64
import io
from dataclasses import dataclass

from pypdf import PdfReader

from app.config import settings


@dataclass
class PreparedAttachment:
    """Either base64 image data URL or extracted/plain text for the LLM."""

    kind: str  # "image" | "pdf_text"
    mime: str
    payload: str  # data URL or plain text


def prepare_upload(content: bytes, mime: str) -> PreparedAttachment | None:
    """
    Turn raw upload bytes into a form usable in the multimodal chat payload.

    Returns None if type unsupported or PDF read fails.
    """
    if mime.startswith("image/") and mime in settings.allowed_upload_mime:
        b64 = base64.standard_b64encode(content).decode("ascii")
        return PreparedAttachment(kind="image", mime=mime, payload=f"data:{mime};base64,{b64}")

    if mime == "application/pdf":
        try:
            reader = PdfReader(io.BytesIO(content))
            texts: list[str] = []
            for page in reader.pages[:8]:
                t = page.extract_text()
                if t:
                    texts.append(t.strip())
            combined = "\n\n".join(texts).strip()
            if not combined:
                return None
            # Cap extracted text to limit tokens
            max_chars = 8000
            if len(combined) > max_chars:
                combined = combined[:max_chars] + "\n… [truncated]"
            return PreparedAttachment(kind="pdf_text", mime=mime, payload=combined)
        except Exception:
            return None

    return None
