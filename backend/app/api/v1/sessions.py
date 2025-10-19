from __future__ import annotations

from datetime import datetime

try:  # pragma: no cover - Python <3.9 compatibility
    from typing import Annotated
except ImportError:  # pragma: no cover
    from typing_extensions import Annotated

from fastapi import APIRouter, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.dependencies import DbSessionDep
from app.models.tables import Answer, Question, Role, Session
from app.schemas.session import AnswerCreate, AnswerRead, SessionCreate, SessionDetail, SessionRead

router = APIRouter()


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    db: DbSessionDep,
) -> SessionRead:
    role_stmt = select(Role).where(Role.slug == payload.role_slug)
    role_result = await db.execute(role_stmt)
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    new_session = Session(role_id=role.id)
    db.add(new_session)
    await db.flush()
    await db.refresh(new_session, attribute_names=["role"])
    await db.commit()
    return new_session


@router.post(
    "/{session_id}/answers",
    response_model=AnswerRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an answer for a session",
)
async def submit_answer(
    payload: AnswerCreate,
    db: DbSessionDep,
    session_id: Annotated[int, Path(description="Session identifier")],
) -> AnswerRead:
    session_stmt = (
        select(Session)
        .options(selectinload(Session.role))
        .where(Session.id == session_id)
    )
    session_result = await db.execute(session_stmt)
    session_obj = session_result.scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    question_stmt = select(Question).where(Question.id == payload.question_id)
    question_result = await db.execute(question_stmt)
    question = question_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
    if question.role_id != session_obj.role_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question does not belong to the session role.",
        )

    duration_ms = int((payload.ended_at - payload.started_at).total_seconds() * 1000)
    if duration_ms <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Answer duration must be positive.",
        )

    answer = Answer(
        session_id=session_id,
        question_id=payload.question_id,
        answer_text=payload.answer_text,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        duration_ms=duration_ms,
        transcript_text=payload.transcript_text,
    )
    db.add(answer)

    if not session_obj.ended_at or payload.ended_at > session_obj.ended_at:
        session_obj.ended_at = payload.ended_at

    await db.flush()
    await db.refresh(answer, attribute_names=["question", "evaluation"])
    await db.commit()
    return answer


@router.get(
    "/{session_id}",
    response_model=SessionDetail,
    summary="Retrieve a session with answers and evaluations",
)
async def get_session_detail(
    session_id: Annotated[int, Path(description="Session identifier")],
    db: DbSessionDep,
) -> SessionDetail:
    stmt = (
        select(Session)
        .where(Session.id == session_id)
        .options(
            selectinload(Session.role),
            selectinload(Session.answers)
            .selectinload(Answer.question),
            selectinload(Session.answers)
            .selectinload(Answer.evaluation),
        )
    )
    result = await db.execute(stmt)
    session_obj = result.scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return session_obj
