import pytest

from app.core.config import settings

pytestmark = pytest.mark.asyncio


async def test_diagnostics_reflects_llm_when_key_present(client):
    original_key = settings.openai_api_key
    original_use_llm = settings.use_llm
    original_env = settings.app_env
    original_ci = settings.ci_mode
    original_provider = settings.llm_provider
    original_base = settings.llm_base_url
    original_llm_key = settings.llm_api_key
    try:
        settings.openai_api_key = "sk-test"
        settings.app_env = "local"
        settings.ci_mode = False
        settings.use_llm = True
        settings.llm_provider = "openai"
        settings.llm_base_url = None
        settings.llm_api_key = None

        response = await client.get("/api/v1/diagnostics")
        assert response.status_code == 200
        payload = response.json()
        assert payload["config"]["openai_key_present"] is True
        assert payload["config"]["use_llm"] is True
        assert payload["env"]["app_env"] == "local"
        assert payload["models"]["provider"] == "openai"
        assert payload["models"]["base_url"] is None
    finally:
        settings.openai_api_key = original_key
        settings.use_llm = original_use_llm
        settings.app_env = original_env
        settings.ci_mode = original_ci
        settings.llm_provider = original_provider
        settings.llm_base_url = original_base
        settings.llm_api_key = original_llm_key


async def test_diagnostics_reports_custom_provider(client):
    from app.services import llm as llm_module
    from app.services.evaluator_status import set_status

    original_provider = settings.llm_provider
    original_base = settings.llm_base_url
    original_llm_key = settings.llm_api_key
    original_openai_key = settings.openai_api_key
    original_use_llm = settings.use_llm
    original_async_class = llm_module.AsyncOpenAI

    class _DummyAsyncOpenAI:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
            self.responses = None
            self.chat = None

    try:
        settings.llm_provider = "custom"
        settings.llm_base_url = "http://127.0.0.1:1234/v1"
        settings.llm_api_key = "lmstudio"
        settings.openai_api_key = None
        settings.use_llm = True

        llm_module.AsyncOpenAI = _DummyAsyncOpenAI
        service = llm_module.LLMEvaluationService()
        assert isinstance(service._client, _DummyAsyncOpenAI)
        assert service._client.kwargs.get("base_url") == settings.llm_base_url

        set_status(
            path="unknown",
            reason="not_evaluated",
            model=None,
            provider=settings.llm_provider,
            base_url=settings.llm_base_url,
        )

        response = await client.get("/api/v1/diagnostics")
        assert response.status_code == 200
        payload = response.json()
        assert payload["models"]["provider"] == "custom"
        assert payload["models"]["base_url"] == settings.llm_base_url
    finally:
        settings.llm_provider = original_provider
        settings.llm_base_url = original_base
        settings.llm_api_key = original_llm_key
        settings.openai_api_key = original_openai_key
        settings.use_llm = original_use_llm
        llm_module.AsyncOpenAI = original_async_class
        set_status(path="unknown", reason="reset", model=None)
