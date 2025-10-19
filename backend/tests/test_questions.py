import pytest

pytestmark = pytest.mark.asyncio


async def test_questions_respect_requested_level(client):
    response = await client.get(
        "/api/v1/questions",
        params={
            "role": "software-developer",
            "category": "technical",
            "level": "internship",
            "limit": 1,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    question = payload[0]
    assert question["level"] == "internship"
    assert question["category"] == "technical"
    assert question["requires_code"] is True


async def test_questions_fallback_when_level_missing(client):
    response = await client.get(
        "/api/v1/questions",
        params={
            "role": "software-developer",
            "category": "role_specific",
            "level": "internship",
            "limit": 1,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    question = payload[0]
    assert question["category"] == "role_specific"
    assert question["level"] in {"entry", "internship"}
    # ensure we gracefully downgraded rather than erroring
    assert question["text"]

