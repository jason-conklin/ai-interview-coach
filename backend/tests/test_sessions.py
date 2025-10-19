from datetime import datetime, timedelta, timezone

import pytest

pytestmark = pytest.mark.asyncio


async def test_session_creation_and_evaluation_flow(client):
    create_response = await client.post("/api/v1/sessions", json={"role_slug": "software-developer"})
    assert create_response.status_code == 201
    session_payload = create_response.json()
    session_id = session_payload["id"]

    question_response = await client.get(
        "/api/v1/questions",
        params={"role": "software-developer", "limit": 1, "category": "behavioral"},
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
    assert len(detail_payload["answers"]) == 1
    assert detail_payload["answers"][0]["evaluation"]["score"] == evaluation["score"]
