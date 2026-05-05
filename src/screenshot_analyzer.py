"""
Screenshot Analyzer

Uses OpenAI's GPT-4o vision capabilities to describe the visible UI elements
in a screenshot.  Falls back gracefully when:
  - The OpenAI client is not configured / not installed
  - The screenshot file does not exist or is not readable
  - The API call fails

The result is a plain-English description of what is visible in the image
(e.g. "A web browser showing a login form with username and password fields
and a blue Login button").  This description is later injected into the
tutorial-generation prompt to improve instruction quality.
"""

from __future__ import annotations

import base64
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def _encode_image(path: str) -> str:
    """Return the base-64-encoded content of an image file."""
    with open(path, "rb") as fh:
        return base64.b64encode(fh.read()).decode("utf-8")


def _is_url(value: str) -> bool:
    return value.startswith(("http://", "https://"))


class ScreenshotAnalyzer:
    """
    Analyses screenshots to extract a natural-language description of the UI.

    Parameters
    ----------
    client:
        An already-constructed ``openai.OpenAI`` (or ``AsyncOpenAI``) client.
        If *None*, analysis is silently skipped and an empty string is returned.
    model:
        Vision-capable model to use.  Defaults to ``"gpt-4o"``.
    """

    def __init__(
        self,
        client: Optional[object] = None,
        model: str = "gpt-4o",
    ) -> None:
        self._client = client
        self._model = model

    # ------------------------------------------------------------------

    def describe(self, screenshot: str) -> str:
        """
        Return a brief English description of the UI shown in *screenshot*.

        *screenshot* may be:
          - An absolute or relative file path
          - An HTTP/HTTPS URL

        Returns an empty string on any error or when the client is absent.
        """
        if not screenshot:
            return ""
        if self._client is None:
            return ""

        try:
            return self._call_vision(screenshot)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Screenshot analysis failed for %r: %s", screenshot, exc)
            return ""

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _call_vision(self, screenshot: str) -> str:
        prompt = (
            "You are a UI analyst. Look at this screenshot and briefly describe "
            "the visible UI elements: buttons, input fields, menus, headings, etc. "
            "Focus on interactive elements and their apparent purpose. "
            "Be concise — two or three sentences maximum. "
            "Reply in English regardless of the language shown in the UI."
        )

        if _is_url(screenshot):
            image_content: dict = {
                "type": "image_url",
                "image_url": {"url": screenshot, "detail": "low"},
            }
        else:
            path = Path(screenshot)
            if not path.exists():
                logger.warning("Screenshot file not found: %s", screenshot)
                return ""
            ext = path.suffix.lower().lstrip(".")
            mime = f"image/{ext}" if ext in ("png", "jpg", "jpeg", "gif", "webp") else "image/png"
            b64 = _encode_image(str(path))
            image_content = {
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "low"},
            }

        response = self._client.chat.completions.create(  # type: ignore[attr-defined]
            model=self._model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        image_content,
                    ],
                }
            ],
            max_tokens=256,
        )
        return response.choices[0].message.content.strip()
