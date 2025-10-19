import pytest

from app.models.enums import QuestionCategory
from app.core.config import settings
from app.services.llm import LLMEvaluationService

pytestmark = pytest.mark.asyncio


async def test_llm_stub_respects_test_env(monkeypatch):
    monkeypatch.setenv("CI", "true")
    monkeypatch.setattr(settings, "app_env", "test")

    service = LLMEvaluationService(api_key="real-key")

    result = await service.evaluate_answer(
        answer_text="I handled an outage and communicated clearly.",
        question_text="Tell me about a time you resolved a production issue.",
        category=QuestionCategory.BEHAVIORAL,
        role_name="Software Developer",
    )

    assert 0 <= result.score <= 10
    assert result.feedback_markdown
    assert result.suggested_improvements

    # Cleanup environment for subsequent tests
    monkeypatch.delenv("CI", raising=False)
    monkeypatch.setattr(settings, "app_env", "development")
