"""Minimal LLM client. Swappable so tests (and other providers) can stand in."""

from typing import Annotated, Protocol

import httpx
from fastapi import Depends

from app.core.config import get_settings


class LLMError(RuntimeError):
    pass


class LLMClient(Protocol):
    model: str

    def complete_json(self, prompt: str) -> str:
        """Return the model's reply, which should be a JSON document."""
        ...


class GeminiClient:
    URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def __init__(self, api_key: str, model: str, timeout: float = 60.0):
        self.api_key, self.model, self.timeout = api_key, model, timeout

    def complete_json(self, prompt: str) -> str:
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
        }
        try:
            r = httpx.post(
                self.URL.format(model=self.model),
                headers={"x-goog-api-key": self.api_key},
                json=body,
                timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise LLMError(f"Could not reach the LLM API: {e}") from e
        if r.status_code != 200:
            raise LLMError(f"LLM API returned {r.status_code}: {r.text[:300]}")
        try:
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, ValueError) as e:
            raise LLMError("LLM API returned an unexpected response shape") from e


def get_llm_client() -> LLMClient | None:
    s = get_settings()
    return GeminiClient(s.llm_api_key, s.llm_model) if s.llm_api_key else None


LLM = Annotated[LLMClient | None, Depends(get_llm_client)]
