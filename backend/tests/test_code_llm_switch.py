from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.api.v1.evaluate import llm_service
from app.core.config import settings
from app.services.evaluator_status import set_status

pytestmark = pytest.mark.asyncio


class _FakePart:
    def __init__(self, text: str) -> None:
        self.text = text


class _FakeBlock:
    def __init__(self, text: str) -> None:
        self.content = [_FakePart(text)]


class _FakeResponse:
    def __init__(self, text: str) -> None:
        self.output = [_FakeBlock(text)]
        self.output_text = text


class _FakeResponsesAPI:
    def __init__(self, text: str) -> None:
        self._text = text

    async def create(self, *args, **kwargs):
        return _FakeResponse(self._text)


class _FakeClient:
    def __init__(self, text: str) -> None:
        self.responses = _FakeResponsesAPI(text)
        self.chat = SimpleNamespace(completions=None)


async def _create_session_with_question(client, category: str = "technical", level: str = "mid"):
    create_response = await client.post(
        "/api/v1/sessions",
        json={"role_slug": "software-developer", "level": level},
    )
    create_response.raise_for_status()
    session_id = create_response.json()["id"]

    question_response = await client.get(
        "/api/v1/questions",
        params={
            "role": "software-developer",
            "category": category,
            "level": level,
            "limit": 1,
        },
    )
    question_response.raise_for_status()
    question = question_response.json()[0]
    return session_id, question


async def _submit_code_answer(client, session_id: int, question: dict[str, object], answer_text: str) -> int:
    start_time = datetime.now(tz=timezone.utc)
    end_time = start_time + timedelta(seconds=120)
    answer_payload = {
        "question_id": question["id"],
        "answer_text": answer_text,
        "started_at": start_time.isoformat(),
        "ended_at": end_time.isoformat(),
    }
    answer_response = await client.post(f"/api/v1/sessions/{session_id}/answers", json=answer_payload)
    answer_response.raise_for_status()
    return answer_response.json()["id"]


async def test_llm_path_used_when_code_allowed(client):
    original_client = llm_service._client
    original_use_llm = settings.use_llm
    original_allow = settings.allow_llm_for_code
    original_threshold = settings.code_detection_threshold
    original_debug_force = settings.debug_force_llm

    try:
        llm_service._client = _FakeClient('{"score": 7.0, "rubric": {}, "feedback_markdown": "LLM", "suggested_improvements": []}')
        llm_service._supports_responses = True
        settings.use_llm = True
        settings.allow_llm_for_code = True
        settings.code_detection_threshold = 0.75
        settings.debug_force_llm = False

        session_id, question = await _create_session_with_question(client)
        answer_id = await _submit_code_answer(
            client,
            session_id,
            question,
            """```python\ndef add(a, b):\n    return a + b\n```""",
        )

        set_status(path="unknown", reason="reset", model=None)
        evaluation_response = await client.post("/api/v1/evaluate", json={"answer_id": answer_id})
        evaluation_response.raise_for_status()

        diagnostics = await client.get("/api/v1/diagnostics")
        diagnostics.raise_for_status()
        payload = diagnostics.json()
        assert payload["status"]["path"] == "llm"
        assert payload["status"]["reason"] == "llm_code_allowed"
        assert payload["status"]["mode"] == "llm_json_mode"
    finally:
        llm_service._client = original_client
        settings.use_llm = original_use_llm
        settings.allow_llm_for_code = original_allow
        settings.code_detection_threshold = original_threshold
        settings.debug_force_llm = original_debug_force
        set_status(path="unknown", reason="reset", model=None)


async def test_heuristic_path_used_when_code_disallowed(client):
    original_client = llm_service._client
    original_allow = settings.allow_llm_for_code
    original_threshold = settings.code_detection_threshold
    original_use_llm = settings.use_llm

    try:
        settings.allow_llm_for_code = False
        settings.code_detection_threshold = 0.5
        settings.use_llm = True

        session_id, question = await _create_session_with_question(client)
        answer_id = await _submit_code_answer(
            client,
            session_id,
            question,
            """```python\nfor i in range(3):\n    print(i)\n```""",
        )

        set_status(path="unknown", reason="reset", model=None)
        evaluation_response = await client.post("/api/v1/evaluate", json={"answer_id": answer_id})
        evaluation_response.raise_for_status()

        diagnostics = await client.get("/api/v1/diagnostics")
        diagnostics.raise_for_status()
        payload = diagnostics.json()
        assert payload["status"]["path"] == "heuristic"
        assert payload["status"]["reason"] == "code_question_forced"
        assert payload["status"].get("mode") is None
    finally:
        llm_service._client = original_client
        settings.allow_llm_for_code = original_allow
        settings.code_detection_threshold = original_threshold
        settings.use_llm = original_use_llm
        set_status(path="unknown", reason="reset", model=None)


class _RaisingResponses:
    async def create(self, *args, **kwargs):
        raise TypeError("response_format not supported")


class _ChatCompletions:
    def __init__(self, text: str) -> None:
        self._text = text

    async def create(self, *args, **kwargs):
        message = SimpleNamespace(content=self._text)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class _FallbackClient:
    def __init__(self, text: str) -> None:
        self.responses = _RaisingResponses()
        self.chat = SimpleNamespace(completions=_ChatCompletions(text))


async def test_llm_chat_fallback_when_responses_unavailable(client):
    original_client = llm_service._client
    original_use_llm = settings.use_llm
    original_allow = settings.allow_llm_for_code
    original_threshold = settings.code_detection_threshold

    try:
        llm_service._client = _FallbackClient('{"score": 6.5, "rubric": {}, "feedback_markdown": "chat fallback", "suggested_improvements": []}')
        llm_service._supports_responses = True
        settings.use_llm = True
        settings.allow_llm_for_code = True
        settings.code_detection_threshold = 0.5

        session_id, question = await _create_session_with_question(client)
        answer_id = await _submit_code_answer(
            client,
            session_id,
            question,
            "```js\nconsole.log('hi')\n```",
        )

        set_status(path="unknown", reason="reset", model=None)
        evaluation_response = await client.post("/api/v1/evaluate", json={"answer_id": answer_id})
        evaluation_response.raise_for_status()

        diagnostics = await client.get("/api/v1/diagnostics")
        diagnostics.raise_for_status()
        payload = diagnostics.json()
        assert payload["status"]["path"] == "llm"
        assert payload["status"]["reason"] == "llm_code_allowed"
        assert payload["status"]["mode"] == "llm_chat_fallback"
    finally:
        llm_service._client = original_client
        settings.use_llm = original_use_llm
        settings.allow_llm_for_code = original_allow
        settings.code_detection_threshold = original_threshold
        set_status(path="unknown", reason="reset", model=None)
