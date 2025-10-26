import pytest

from app.models.enums import QuestionCategory
from app.core.config import settings
from app.services.llm import (
    CODE_BLOCK_PLACEHOLDER,
    LLMEvaluationService,
    _redact_code_snippets,
    _truncate_text,
)

pytestmark = pytest.mark.asyncio


async def test_llm_stub_respects_test_env(monkeypatch):
    monkeypatch.setenv("CI", "true")
    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(settings, "use_llm", False)

    service = LLMEvaluationService(api_key="real-key")

    result, meta = await service.evaluate_answer(
        answer_text="I handled an outage and communicated clearly.",
        question_text="Tell me about a time you resolved a production issue.",
        category=QuestionCategory.BEHAVIORAL,
        role_name="Software Developer",
    )

    assert meta is None
    assert 0 <= result.score <= 10
    assert result.feedback_markdown
    assert result.suggested_improvements

    # Cleanup environment for subsequent tests
    monkeypatch.delenv("CI", raising=False)
    monkeypatch.setattr(settings, "app_env", "development")


async def test_evaluation_debug_payload_when_enabled():
    original_flag = getattr(settings, "quality_debug_enabled", False)
    original_use_llm = settings.use_llm
    settings.quality_debug_enabled = True
    try:
        settings.use_llm = False
        service = LLMEvaluationService(api_key=None)
        result, meta = await service.evaluate_answer(
            answer_text="We enabled feature flags and reduced p95 latency from 320ms to 140ms within two deploys.",
            question_text="Share a time you delivered a risky launch safely.",
            category=QuestionCategory.BEHAVIORAL,
            role_name="Software Developer",
        )
        assert meta is None
        assert result.debug is not None
        assert "sampling" in result.debug
        assert "weights" in result.debug
        assert result.debug["fallback"] is True
    finally:
        settings.quality_debug_enabled = original_flag
        settings.use_llm = original_use_llm


async def test_redact_code_snippets_masks_code():
    sample = """Consider this snippet:
```python
def hello():
    print("hi")
```
"""
    redacted = _redact_code_snippets(sample)
    assert CODE_BLOCK_PLACEHOLDER in redacted
    assert "print" not in redacted


async def test_truncate_text_handles_multibyte_characters():
    sample = "🚀" * 20 + " mission accomplished"
    limit = 25
    truncated = _truncate_text(sample, limit)
    assert len(truncated) == limit
    assert truncated.endswith("...")
    # Ensure no replacement characters introduced
    assert "\ufffd" not in truncated
