from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.dependencies import DbSessionDep
from app.models.enums import SessionTier
from app.models.tables import Answer, Evaluation, Session
from app.schemas.session import EvaluationRead, EvaluationRequest
from app.services.evaluation import tier_for_score
from app.services.llm import LLMEvaluationService

router = APIRouter()
llm_service = LLMEvaluationService()


@router.post("", response_model=EvaluationRead, status_code=status.HTTP_200_OK)
async def evaluate_answer(payload: EvaluationRequest, db: DbSessionDep) -> EvaluationRead:
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

    evaluation_payload = await llm_service.evaluate_answer(
        answer_text=answer.answer_text,
        question_text=question.text,
        category=question.category,
        role_name=role.name,
        requires_code=question.requires_code,
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

    return EvaluationRead.model_validate(answer.evaluation)


async def _update_session_rollup(*, db: AsyncSession, session_obj: Session) -> None:
    await db.refresh(
        session_obj,
        attribute_names=["answers"],
    )
    scores = [
        answer.evaluation.score
        for answer in session_obj.answers
        if answer.evaluation
    ]
    if not scores:
        return
    avg_score = sum(scores) / len(scores)
    session_obj.overall_score = round(avg_score, 2)
    session_obj.summary_tier = tier_for_score(avg_score)
