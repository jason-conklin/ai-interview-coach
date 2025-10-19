from typing import List, Optional

from app.schemas.common import ORMModel


class RoleRead(ORMModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None


class RoleListResponse(ORMModel):
    roles: List[RoleRead]
