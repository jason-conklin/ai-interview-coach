from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import session_context


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with session_context.session() as session:
        yield session


DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
