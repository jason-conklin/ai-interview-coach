from datetime import datetime, timedelta, timezone

import pytest

pytestmark = pytest.mark.asyncio


async def test_session_creation_and_evaluation_flow(client):
    create_response = await client.post(
        "/api/v1/sessions",
        json={"role_slug": "software-developer", "level": "entry"},
    )
    assert create_response.status_code == 201
    session_payload = create_response.json()
    session_id = session_payload["id"]

    question_response = await client.get(
        "/api/v1/questions",
        params={
            "role": "software-developer",
            "limit": 1,
            "category": "behavioral",
            "level": "entry",
        },
    )
    assert question_response.status_code == 200
    questions = question_response.json()
    assert len(questions) == 1
    question = questions[0]

    start_time = datetime.now(tz=timezone.utc)
    end_time = start_time + timedelta(seconds=75)

    answer_response = await client.post(
        f"/api/v1/sessions/{session_id}/answers",
        json={
            "question_id": question["id"],
            "answer_text": "I led a migration project and documented learned lessons.",
            "started_at": start_time.isoformat(),
            "ended_at": end_time.isoformat(),
        },
    )
    assert answer_response.status_code == 201
    answer = answer_response.json()

    evaluation_response = await client.post("/api/v1/evaluate", json={"answer_id": answer["id"]})
    assert evaluation_response.status_code == 200
    evaluation = evaluation_response.json()
    assert 0 <= evaluation["score"] <= 10
    assert evaluation["feedback_markdown"]
    assert evaluation["suggested_improvements"]

    session_detail = await client.get(f"/api/v1/sessions/{session_id}")
    assert session_detail.status_code == 200
    detail_payload = session_detail.json()
    assert detail_payload["level"] == "entry"
    assert len(detail_payload["answers"]) == 1
    assert detail_payload["answers"][0]["evaluation"]["score"] == evaluation["score"]


async def test_code_question_evaluates_without_llm(client):
    create_response = await client.post(
        "/api/v1/sessions",
        json={"role_slug": "software-developer", "level": "mid"},
    )
    assert create_response.status_code == 201
    session_id = create_response.json()["id"]

    question_response = await client.get(
        "/api/v1/questions",
        params={
            "role": "software-developer",
            "level": "mid",
            "category": "technical",
            "limit": 1,
        },
    )
    assert question_response.status_code == 200
    question = question_response.json()[0]

    start_time = datetime.now(tz=timezone.utc)
    end_time = start_time + timedelta(seconds=180)

    answer_payload = {
        "question_id": question["id"],
        "answer_text": """
        def reverse_words(sentence: str) -> str:
            parts = sentence.split()
            return " ".join(reversed(parts))

        # simple demonstration
        assert reverse_words("hello world") == "world hello"
        """,
        "started_at": start_time.isoformat(),
        "ended_at": end_time.isoformat(),
    }
    answer_response = await client.post(f"/api/v1/sessions/{session_id}/answers", json=answer_payload)
    assert answer_response.status_code == 201
    answer_id = answer_response.json()["id"]

    evaluation_response = await client.post("/api/v1/evaluate", json={"answer_id": answer_id})
    assert evaluation_response.status_code == 200
    evaluation = evaluation_response.json()
    assert evaluation["score"] >= 5
    assert evaluation["feedback_markdown"]
    assert evaluation["suggested_improvements"]


async def test_answer_allows_level_fallback(client):
    create_response = await client.post(
        "/api/v1/sessions",
        json={"role_slug": "software-developer", "level": "internship"},
    )
    assert create_response.status_code == 201
    session_id = create_response.json()["id"]

    question_response = await client.get(
        "/api/v1/questions",
        params={
            "role": "software-developer",
            "category": "behavioral",
            "level": "internship",
            "limit": 1,
        },
    )
    assert question_response.status_code == 200
    question = question_response.json()[0]
    # Dataset only has entry-level behavioral questions, so fallback is expected.
    assert question["level"] in {"internship", "entry"}

    start_time = datetime.now(tz=timezone.utc)
    end_time = start_time + timedelta(seconds=120)
    answer_response = await client.post(
        f"/api/v1/sessions/{session_id}/answers",
        json={
            "question_id": question["id"],
            "answer_text": "I walked through the bug and paired with a mentor to deliver a safe fix.",
            "started_at": start_time.isoformat(),
            "ended_at": end_time.isoformat(),
        },
    )
    assert answer_response.status_code == 201


async def test_multiple_answers_handle_timezone_awareness(client):
    create_response = await client.post(
        "/api/v1/sessions",
        json={"role_slug": "software-developer", "level": "entry"},
    )
    assert create_response.status_code == 201
    session_id = create_response.json()["id"]

    question_response = await client.get(
        "/api/v1/questions",
        params={
            "role": "software-developer",
            "level": "entry",
            "category": "technical",
            "limit": 1,
        },
    )
    assert question_response.status_code == 200
    question = question_response.json()[0]

    start_one = datetime.now(tz=timezone.utc)
    end_one = start_one + timedelta(seconds=90)
    answer_one = await client.post(
        f"/api/v1/sessions/{session_id}/answers",
        json={
            "question_id": question["id"],
            "answer_text": "First attempt discussing arrays and complexity.",
            "started_at": start_one.isoformat(),
            "ended_at": end_one.isoformat(),
        },
    )
    assert answer_one.status_code == 201

    start_two = end_one + timedelta(seconds=5)
    end_two = start_two + timedelta(seconds=120)
    answer_two = await client.post(
        f"/api/v1/sessions/{session_id}/answers",
        json={
            "question_id": question["id"],
            "answer_text": "Second attempt elaborating on edge cases.",
            "started_at": start_two.isoformat(),
            "ended_at": end_two.isoformat(),
        },
    )
    assert answer_two.status_code == 201
