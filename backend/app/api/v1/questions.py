from __future__ import annotations

from typing import List, Optional

try:  # pragma: no cover - Python <3.9 compatibility
    from typing import Annotated
except ImportError:  # pragma: no cover
    from typing_extensions import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.dependencies import DbSessionDep
from app.models.enums import QuestionCategory
from app.models.tables import Question, Role
from app.schemas.question import QuestionRead

router = APIRouter()


@router.get("", response_model=List[QuestionRead], summary="Fetch interview questions")
async def list_questions(
    session: DbSessionDep,
    role: Annotated[str, Query(description="Role slug to filter questions")],
    category: Annotated[Optional[QuestionCategory], Query(description="Question category filter")] = None,
    limit: Annotated[int, Query(ge=1, le=10, description="Number of questions to return")] = 1,
) -> List[QuestionRead]:
    role_stmt = select(Role).where(Role.slug == role)
    role_result = await session.execute(role_stmt)
    role_obj = role_result.scalar_one_or_none()
    if not role_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role '{role}' not found.")

    query = select(Question).where(Question.role_id == role_obj.id).order_by(func.random()).limit(limit)
    if category:
        query = query.where(Question.category == category)

    questions_result = await session.execute(query)
    questions = questions_result.scalars().all()
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No questions available for the specified filters.",
        )
    return list(questions)
