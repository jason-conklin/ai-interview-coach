from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.dependencies import DbSessionDep
from app.models.tables import Answer, Evaluation, Session
from app.schemas.session import EvaluationRead, EvaluationRequest, EvaluationResponse
from app.services.evaluation import tier_for_score
from app.services.llm import LLMEvaluationService
from app.core.config import settings

router = APIRouter()
llm_service = LLMEvaluationService()


@router.post("", response_model=EvaluationResponse, status_code=status.HTTP_200_OK)
async def evaluate_answer(payload: EvaluationRequest, db: DbSessionDep) -> EvaluationResponse:
    answer_stmt = (
        select(Answer)
        .where(Answer.id == payload.answer_id)
        .options(
            selectinload(Answer.question),
            selectinload(Answer.session).selectinload(Session.role),
            selectinload(Answer.evaluation),
        )
    )
    answer_result = await db.execute(answer_stmt)
    answer = answer_result.scalar_one_or_none()
    if not answer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found.")

    question = answer.question
    session_obj = answer.session
    role = session_obj.role

    debug_force = settings.debug_force_llm
    if payload.debug_force_llm and settings.app_env != "production":
        debug_force = True

    evaluation_payload, meta = await llm_service.evaluate_answer(
        answer_text=answer.answer_text,
        question_text=question.text,
        category=question.category,
        role_name=role.name,
        requires_code=question.requires_code,
        question_keywords=question.keywords,
        debug_force_llm=debug_force,
    )

    if answer.evaluation:
        answer.evaluation.score = evaluation_payload.score
        answer.evaluation.rubric = evaluation_payload.rubric
        answer.evaluation.feedback_markdown = evaluation_payload.feedback_markdown
        answer.evaluation.suggested_improvements = evaluation_payload.suggested_improvements
    else:
        answer.evaluation = Evaluation(
            score=evaluation_payload.score,
            rubric=evaluation_payload.rubric,
            feedback_markdown=evaluation_payload.feedback_markdown,
            suggested_improvements=evaluation_payload.suggested_improvements,
        )

    await db.flush()

    await _update_session_rollup(db=db, session_obj=session_obj)

    await db.commit()
    await db.refresh(answer, attribute_names=["evaluation"])

    evaluation_read = EvaluationRead.model_validate(answer.evaluation)
    response_meta = meta or {}
    if evaluation_payload.debug and settings.quality_debug_enabled:
        response_meta.setdefault("debug", evaluation_payload.debug)

    return EvaluationResponse(evaluation=evaluation_read, meta=response_meta or None)


async def _update_session_rollup(*, db: AsyncSession, session_obj: Session) -> None:
    stmt = (
        select(Session)
        .options(
            selectinload(Session.answers).selectinload(Answer.evaluation),
        )
        .where(Session.id == session_obj.id)
    )
    result = await db.execute(stmt)
    session_with_answers = result.scalar_one_or_none()
    if not session_with_answers:
        return

    scores = [
        answer.evaluation.score
        for answer in session_with_answers.answers
        if answer.evaluation
    ]
    if not scores:
        return
    avg_score = sum(scores) / len(scores)
    session_obj.overall_score = round(avg_score, 2)
    session_obj.summary_tier = tier_for_score(avg_score)
