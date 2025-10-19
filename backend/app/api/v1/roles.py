from typing import List

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.dependencies import DbSessionDep
from app.models.tables import Role
from app.schemas.role import RoleRead

router = APIRouter()


@router.get("", response_model=List[RoleRead], summary="List roles")
async def list_roles(session: DbSessionDep) -> List[RoleRead]:
    result = await session.execute(select(Role).order_by(Role.name))
    roles = result.scalars().all()
    return list(roles)
