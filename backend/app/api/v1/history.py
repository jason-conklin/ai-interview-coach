from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.dependencies import DbSessionDep
from app.models.tables import Role, Session
from app.schemas.session import HistoryItem

router = APIRouter()


@router.get("", response_model=list[HistoryItem], summary="List recent interview sessions")
async def list_session_history(
    db: DbSessionDep,
    role: Annotated[str | None, Query(description="Filter by role slug")] = None,
    limit: Annotated[int, Query(ge=1, le=50, description="Maximum sessions to return")] = 25,
) -> list[HistoryItem]:
    stmt = (
        select(Session)
        .options(selectinload(Session.role))
        .order_by(Session.started_at.desc())
        .limit(limit)
    )
    if role:
        stmt = stmt.join(Session.role).where(Role.slug == role)

    result = await db.execute(stmt)
    sessions = result.scalars().all()
    return list(sessions)
